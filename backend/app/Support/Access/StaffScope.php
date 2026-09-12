<?php

namespace App\Support\Access;

use App\Models\Floor;
use App\Models\Office;
use App\Models\Room;
use App\Models\RoomQueue;
use App\Models\StaffAssignment;
use App\Models\TimetableEntry;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Resolves *which* rooms, queues, offices and timetable entries a staff member may operate.
 *
 * Role answers identity; this answers resource scope, which is the third leg of the
 * "role + permission + resource ownership" rule. It reads `staff_assignments`:
 *
 *   scope_type = campus | building | floor | room | office | course
 *   scope_id   = the entity's id
 *   can_call_tickets / can_manage_timetable / can_publish_content = the verbs inside that scope
 *
 * Bootstrap rule: a staff member with **no** assignment rows yet is treated as campus-wide when
 * `campusflow.access.unassigned_staff_scope` is `campus` (the default in development, because the
 * current seeder does not create assignments). Setting it to `none` locks every unprovisioned
 * staff member out of operations, which is what a production deployment should run.
 */
final class StaffScope
{
    /** @return Collection<int, StaffAssignment> */
    public static function assignments(?User $user): Collection
    {
        if (! $user) {
            return collect();
        }

        return StaffAssignment::query()
            ->where('user_id', $user->id)
            ->get();
    }

    public static function isOperator(?User $user): bool
    {
        return $user !== null && in_array($user->role, [Roles::STAFF, Roles::ADMIN], true);
    }

    /** Admin and campus-scoped staff see every queue/office; nobody else is promoted. */
    public static function unrestricted(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        if ($user->role === Roles::ADMIN) {
            return true;
        }

        if ($user->role !== Roles::STAFF) {
            return false;
        }

        $assignments = self::assignments($user);

        if ($assignments->isEmpty()) {
            return self::unassignedStaffScope() === 'campus';
        }

        return $assignments->contains(fn (StaffAssignment $a) => $a->scope_type === 'campus');
    }

    public static function canOperateQueue(?User $user, RoomQueue $queue): bool
    {
        if (! self::isOperator($user) || ! self::holdsQueueVerb($user)) {
            return false;
        }

        if (self::unrestricted($user)) {
            return true;
        }

        $room = $queue->room ?? Room::find($queue->room_id);
        if (! $room) {
            return false;
        }

        return self::matchesRoom(self::assignments($user), $room, 'can_call_tickets');
    }

    public static function canOperateOffice(?User $user, Office $office): bool
    {
        if (! self::isOperator($user)) {
            return false;
        }

        if (self::unrestricted($user)) {
            return true;
        }

        // An explicit office assignment, or an assignment on the room the office sits in.
        return self::assignments($user)->contains(function (StaffAssignment $a) use ($office) {
            if ($a->scope_type === 'office' && (string) $a->scope_id === (string) $office->id) {
                return true;
            }

            if ($a->scope_type === 'room' && $office->room_id && (string) $a->scope_id === (string) $office->room_id) {
                return true;
            }

            return false;
        });
    }

    public static function canManageTimetableEntry(?User $user, TimetableEntry $entry): bool
    {
        if (! self::isOperator($user)) {
            return false;
        }

        if ($user->role === Roles::ADMIN) {
            return true;
        }

        if (self::unrestricted($user)) {
            return true;
        }

        $assignments = self::assignments($user);

        return $assignments->contains(function (StaffAssignment $a) use ($entry) {
            if (! (bool) $a->can_manage_timetable) {
                return false;
            }

            if ($a->scope_type === 'course' && (string) $a->scope_id === (string) $entry->course_id) {
                return true;
            }

            if ($a->scope_type === 'room' && $entry->room_id && (string) $a->scope_id === (string) $entry->room_id) {
                return true;
            }

            return false;
        }) || (string) $entry->lecturer_id === (string) $user->id;
    }

    /** Staff may edit room records only inside their own building/floor/room scope (§ matrix: ○ where assigned). */
    public static function canManageRoom(?User $user, Room $room): bool
    {
        if (! self::isOperator($user)) {
            return false;
        }

        if ($user->role === Roles::ADMIN) {
            return true;
        }

        return self::matchesRoom(self::assignments($user), $room, null);
    }

    public static function visibleRoomIds(?User $user): ?array
    {
        if (! $user || self::unrestricted($user)) {
            return null; // null = no restriction
        }

        $ids = [];
        $assignments = self::assignments($user);

        foreach ($assignments as $a) {
            switch ($a->scope_type) {
                case 'room':
                    $ids[] = $a->scope_id;
                    break;
                case 'floor':
                    $ids = array_merge($ids, Room::where('floor_id', $a->scope_id)->pluck('id')->all());
                    break;
                case 'building':
                    $floorIds = Floor::where('building_id', $a->scope_id)->pluck('id');
                    $ids = array_merge($ids, Room::whereIn('floor_id', $floorIds)->pluck('id')->all());
                    break;
            }
        }

        return array_values(array_unique(array_filter($ids)));
    }

    private static function matchesRoom(Collection $assignments, Room $room, ?string $verb): bool
    {
        $floor = $room->floor ?? Floor::find($room->floor_id);
        $buildingId = $floor?->building_id ?? null;

        return $assignments->contains(function (StaffAssignment $a) use ($room, $floor, $buildingId, $verb) {
            if ($verb !== null && ! (bool) $a->{$verb}) {
                return false;
            }

            return match ($a->scope_type) {
                'room'     => (string) $a->scope_id === (string) $room->id,
                'floor'    => $floor && (string) $a->scope_id === (string) $floor->id,
                'building' => $buildingId && (string) $a->scope_id === (string) $buildingId,
                'campus'   => true,
                default    => false,
            };
        });
    }

    private static function holdsQueueVerb(?User $user): bool
    {
        if ($user->role === Roles::ADMIN) {
            return true;
        }

        $assignments = self::assignments($user);

        return $assignments->isEmpty() || $assignments->contains(fn (StaffAssignment $a) => (bool) $a->can_call_tickets);
    }

    public static function unassignedStaffScope(): string
    {
        $configured = config('campusflow.access.unassigned_staff_scope', 'campus');

        if (! in_array($configured, ['campus', 'none'], true)) {
            // Never let a typo widen access.
            return 'none';
        }

        return $configured;
    }

    /** Building ids a staff member may manage, or null when unrestricted. Admins pass through. */
    public static function visibleBuildingIds(?User $user): ?array
    {
        if (! $user) {
            return [];
        }

        if (self::unrestricted($user)) {
            return null;
        }

        $ids = self::assignments($user)
            ->where('scope_type', 'building')
            ->pluck('scope_id')
            ->all();

        $floorIds = self::assignments($user)->where('scope_type', 'floor')->pluck('scope_id')->all();
        if ($floorIds !== []) {
            $ids = array_merge($ids, Floor::whereIn('id', $floorIds)->pluck('building_id')->all());
        }

        $roomIds = self::assignments($user)->where('scope_type', 'room')->pluck('scope_id')->all();
        if ($roomIds !== []) {
            $floorIdsFromRooms = Room::whereIn('id', $roomIds)->pluck('floor_id')->all();
            $ids = array_merge($ids, Floor::whereIn('id', $floorIdsFromRooms)->pluck('building_id')->all());
        }

        return array_values(array_filter(array_unique($ids)));
    }
}
