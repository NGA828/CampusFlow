<?php

namespace App\Policies;

use App\Models\User;
use App\Support\Access\ClientContext;
use App\Support\Access\Permissions;
use App\Support\Access\Roles;
use App\Support\Access\StaffScope;

/**
 * Campus and spatial infrastructure: buildings, floors, rooms, QR anchors, navigation nodes and
 * edges, geofences and floor plans.
 *
 * Reading is broad (every resident role, plus a separate unauthenticated public projection for
 * visitors). Writing is Admin Web only, with one narrow staff exception: a staff member may edit
 * the *room record* inside their own assignment scope (capacity/availability notes), never the
 * spatial graph, QR issuance or geofences — those three define how the whole campus routes and
 * checks people in, so they stay with administration.
 */
class CampusInfrastructurePolicy
{
    public function __construct(private readonly ClientContext $context)
    {
    }

    /** Any signed-in role may read spatial structure; visitors get the public projection instead. */
    public function viewAny(?User $user): bool
    {
        if (! $user) {
            return true; // guests are served by the /public/* endpoints only
        }

        return $this->context->may(Permissions::CAMPUS_VIEW_PRIVATE)
            || $this->context->may(Permissions::SPATIAL_VIEW);
    }

    public function view(?User $user): bool
    {
        return $this->viewAny($user);
    }

    /** Spatial graph, anchors and plans — inspectable by staff/admin, editable by admin only. */
    public function viewSpatial(?User $user): bool
    {
        return $this->context->may(Permissions::SPATIAL_VIEW);
    }

    public function create(?User $user): bool
    {
        return $this->manage($user);
    }

    public function update(?User $user, object $record): bool
    {
        if ($this->manage($user)) {
            return true;
        }

        // Staff may amend a room record they are responsible for; nothing else.
        if (! $user || $user->role !== Roles::STAFF) {
            return false;
        }

        if (! str_ends_with($record::class, 'Room')) {
            return false;
        }

        return $this->context->may(Permissions::CAMPUS_VIEW_PRIVATE)
            && StaffScope::canManageRoom($user, $record);
    }

    public function delete(?User $user, ?object $record = null): bool
    {
        return $this->manage($user);
    }

    /** QR payload issuance/revocation is governance: an anchor is a credential. */
    public function issueQr(?User $user): bool
    {
        return $this->manage($user);
    }

    public function regenerateQr(?User $user): bool
    {
        return $this->manage($user);
    }

    public function editFloorPlan(?User $user): bool
    {
        return $this->manage($user);
    }

    public function editGeofence(?User $user): bool
    {
        return $this->manage($user);
    }

    private function manage(?User $user): bool
    {
        return $user !== null
            && $user->role === Roles::ADMIN
            && $this->context->may(Permissions::ROOMS_MANAGE)
            && $this->context->may(Permissions::SPATIAL_MANAGE);
    }
}
