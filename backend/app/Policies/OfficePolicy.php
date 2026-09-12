<?php

namespace App\Policies;

use App\Models\Office;
use App\Models\OfficeTicket;
use App\Models\User;
use App\Support\Access\ClientContext;
use App\Support\Access\Permissions;
use App\Support\Access\Roles;
use App\Support\Access\StaffScope;

/**
 * Administrative offices: the directory is open, the line is staffed, the configuration is governed.
 */
class OfficePolicy
{
    public function __construct(private readonly ClientContext $context)
    {
    }

    public function view(?User $user, Office $office): bool
    {
        if (! $user) {
            return false; // public visitors use the /public projection, not this model
        }

        return $this->context->may(Permissions::OFFICE_VIEW);
    }

    /** Students request from their own account; staff/admin never take a ticket. */
    public function requestTicket(?User $user, Office $office): bool
    {
        if (! $user || $user->role !== Roles::STUDENT) {
            return false;
        }

        return $this->context->may(Permissions::OFFICE_TICKET_REQUEST);
    }

    public function operate(?User $user, Office $office): bool
    {
        if (! $user || ! $this->context->may(Permissions::OFFICE_OPERATE_ASSIGNED)) {
            return false;
        }

        return StaffScope::canOperateOffice($user, $office);
    }

    public function configure(?User $user, Office $office): bool
    {
        return $user !== null
            && $user->role === Roles::ADMIN
            && $this->context->may(Permissions::OFFICE_CONFIGURE);
    }

    public function create(?User $user): bool
    {
        return $this->configureAny($user);
    }

    public function delete(?User $user, Office $office): bool
    {
        return $this->configure($user, $office);
    }

    public function configureAny(?User $user): bool
    {
        return $user !== null
            && $user->role === Roles::ADMIN
            && $this->context->may(Permissions::OFFICE_CONFIGURE);
    }

    /** The waiting list, with names and registration numbers: operators only. */
    public function viewLine(?User $user, Office $office): bool
    {
        return $this->operate($user, $office);
    }
}
