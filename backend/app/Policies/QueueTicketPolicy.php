<?php

namespace App\Policies;

use App\Models\QueueTicket;
use App\Models\RoomQueue;
use App\Models\User;
use App\Support\Access\ClientContext;
use App\Support\Access\Permissions;
use App\Support\Access\Roles;
use App\Support\Access\StaffScope;

/**
 * Room-queue ticket authorization.
 *
 * A ticket has exactly two kinds of interested party, and they are *not* interchangeable:
 *
 *   the student who holds it  — may look at it, cancel it, mark themselves navigating, check in;
 *   the staff member on duty  — may call it, admit, complete, mark a no-show.
 *
 * A staff member can never take a ticket and a student can never release one, regardless of what a
 * client renders. Ownership is checked here (not in the controller) so every route touching a
 * ticket inherits it.
 */
class QueueTicketPolicy
{
    public function __construct(private readonly ClientContext $context)
    {
    }

    /** Anyone authenticated may read a queue board's public state; a ticket's detail is private. */
    public function view(?User $user, QueueTicket $ticket): bool
    {
        if (! $user) {
            return false;
        }

        return $this->owner($user, $ticket) || $this->operator($user, $ticket);
    }

    /** Students only — and never from a staff/admin principal, even if they are curious. */
    public function join(?User $user, RoomQueue $queue): bool
    {
        if (! $user || $user->role !== Roles::STUDENT) {
            return false;
        }

        return $this->context->may(Permissions::QUEUE_JOIN);
    }

    public function cancel(?User $user, QueueTicket $ticket): bool
    {
        return $this->owner($user, $ticket) || $this->operator($user, $ticket);
    }

    /**
     * Check-in needs a device at the door: the QR/GPS act is a mobile act. Web may request a
     * ticket and watch it, but it cannot claim physical presence.
     */
    public function checkIn(?User $user, QueueTicket $ticket): bool
    {
        if (! $this->owner($user, $ticket)) {
            return false;
        }

        return $this->context->may(Permissions::QUEUE_JOIN) && $this->presenceCheckAllowed();
    }

    public function markNavigating(?User $user, QueueTicket $ticket): bool
    {
        return $this->owner($user, $ticket)
            && $this->context->may(Permissions::NAVIGATION_LIVE);
    }

    public function call(?User $user, QueueTicket $ticket): bool
    {
        return $this->operator($user, $ticket);
    }

    public function admit(?User $user, QueueTicket $ticket): bool
    {
        return $this->operator($user, $ticket);
    }

    public function complete(?User $user, QueueTicket $ticket): bool
    {
        return $this->operator($user, $ticket);
    }

    public function noShow(?User $user, QueueTicket $ticket): bool
    {
        return $this->operator($user, $ticket);
    }

    /** Proximity validation is a mobile, student-held-ticket operation. */
    public function proximityCheck(?User $user, QueueTicket $ticket): bool
    {
        return $this->owner($user, $ticket) && $this->context->isMobile();
    }

    /** Presence cannot be asserted from a browser; the config makes that a switchable product rule. */
    private function presenceCheckAllowed(): bool
    {
        if (! config('campusflow.access.require_mobile_for_check_in', true)) {
            return true;
        }

        return ! $this->context->isWeb();
    }

    private function owner(?User $user, QueueTicket $ticket): bool
    {
        return $user !== null
            && $user->role === Roles::STUDENT
            && (string) $ticket->user_id === (string) $user->id;
    }

    private function operator(?User $user, QueueTicket $ticket): bool
    {
        if (! $user || ! $this->context->may(Permissions::QUEUE_OPERATE_ASSIGNED)) {
            return false;
        }

        $queue = $ticket->queue ?? RoomQueue::find($ticket->queue_id);

        return $queue !== null && StaffScope::canOperateQueue($user, $queue);
    }
}
