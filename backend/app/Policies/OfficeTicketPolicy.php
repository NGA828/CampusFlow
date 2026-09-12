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
 * Office tickets — the student's proof of a place in a service line.
 *
 * Same separation as room queues: the holder can watch, cancel and check in; only the staff on
 * duty at that office can call, start, complete or no-show.
 */
class OfficeTicketPolicy
{
    public function __construct(private readonly ClientContext $context)
    {
    }

    public function view(?User $user, OfficeTicket $ticket): bool
    {
        if (! $user) {
            return false;
        }

        return $this->owner($user, $ticket)
            || $this->operator($user, $ticket)
            || $user->role === Roles::ADMIN;
    }

    public function cancel(?User $user, OfficeTicket $ticket): bool
    {
        return $this->owner($user, $ticket) || $this->operator($user, $ticket);
    }

    public function checkIn(?User $user, OfficeTicket $ticket): bool
    {
        if (! $this->owner($user, $ticket)) {
            return false;
        }

        if (! $this->context->may(Permissions::OFFICE_TICKET_REQUEST)) {
            return false;
        }

        if (! config('campusflow.access.require_mobile_for_check_in', true)) {
            return true;
        }

        return ! $this->context->isWeb();
    }

    public function call(?User $user, OfficeTicket $ticket): bool
    {
        return $this->operator($user, $ticket);
    }

    public function startService(?User $user, OfficeTicket $ticket): bool
    {
        return $this->operator($user, $ticket);
    }

    public function complete(?User $user, OfficeTicket $ticket): bool
    {
        return $this->operator($user, $ticket);
    }

    public function noShow(?User $user, OfficeTicket $ticket): bool
    {
        return $this->operator($user, $ticket);
    }

    /** "I'm almost there" — a student act, on the platform that knows where they are. */
    public function approaching(?User $user, OfficeTicket $ticket): bool
    {
        return $this->owner($user, $ticket) && $this->context->isMobile();
    }

    private function owner(?User $user, OfficeTicket $ticket): bool
    {
        return $user !== null
            && $user->role === Roles::STUDENT
            && (string) $ticket->user_id === (string) $user->id;
    }

    private function operator(?User $user, OfficeTicket $ticket): bool
    {
        if (! $user || ! $this->context->may(Permissions::OFFICE_OPERATE_ASSIGNED)) {
            return false;
        }

        $office = $ticket->office ?? Office::find($ticket->office_id);

        return $office !== null && StaffScope::canOperateOffice($user, $office);
    }
}
