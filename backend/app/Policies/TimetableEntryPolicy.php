<?php

namespace App\Policies;

use App\Models\Enrollment;
use App\Models\TimetableEntry;
use App\Models\User;
use App\Support\Access\ClientContext;
use App\Support\Access\Permissions;
use App\Support\Access\Roles;
use App\Support\Access\StaffScope;

/**
 * Timetable access is ownership-scoped in three different directions:
 *
 *   student → the entries of the courses they are enrolled in (never another student's week);
 *   staff   → the entries they lecture, plus anything inside an assignment with `can_manage_timetable`;
 *   admin   → every entry, for conflict resolution and term administration.
 *
 * The `MeController`/`StudentController` queries apply the same filter, so a leaked id in a URL
 * returns 403 rather than somebody else's schedule.
 */
class TimetableEntryPolicy
{
    public function __construct(private readonly ClientContext $context)
    {
    }

    public function view(?User $user, TimetableEntry $entry): bool
    {
        if (! $user) {
            return false;
        }

        return match ($user->role) {
            Roles::STUDENT => $this->studentHolds($user, $entry),
            Roles::STAFF   => true, // scoped by the query; entries are class information
            Roles::ADMIN   => true,
            default        => false,
        };
    }

    public function manage(?User $user, TimetableEntry $entry): bool
    {
        if (! $user) {
            return false;
        }

        if ($user->role === Roles::ADMIN) {
            return $this->context->may(Permissions::TIMETABLE_MANAGE_ALL);
        }

        return $this->context->may(Permissions::TIMETABLE_MANAGE_ASSIGNED)
            && StaffScope::canManageTimetableEntry($user, $entry);
    }

    public function create(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        if ($user->role === Roles::ADMIN) {
            return $this->context->may(Permissions::TIMETABLE_MANAGE_ALL);
        }

        return $this->context->may(Permissions::TIMETABLE_MANAGE_ASSIGNED);
    }

    public function delete(?User $user, TimetableEntry $entry): bool
    {
        return $this->manage($user, $entry);
    }

    /** Students must pass through an enrolment, and enrolment itself is an admin action. */
    public function enrol(?User $user): bool
    {
        return $user !== null && $this->context->may(Permissions::ENROLMENTS_MANAGE);
    }

    private function studentHolds(User $user, TimetableEntry $entry): bool
    {
        return Enrollment::query()
            ->where('student_id', $user->id)
            ->where('course_id', $entry->course_id)
            ->where('status', 'enrolled')
            ->exists();
    }
}
