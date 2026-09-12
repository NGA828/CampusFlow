<?php

namespace App\Policies;

use App\Models\RoomQueue;
use App\Models\User;
use App\Support\Access\ClientContext;
use App\Support\Access\Permissions;
use App\Support\Access\Roles;
use App\Support\Access\StaffScope;

/**
 * Room queues: reading a board, operating a line, and configuring policy are three different
 * capabilities held by three different roles on two different platforms.
 */
class RoomQueuePolicy
{
    public function __construct(private readonly ClientContext $context)
    {
    }

    /** Queue status is visible to every resident role (student board, staff monitoring, admin). */
    public function view(?User $user, RoomQueue $queue): bool
    {
        if (! $user) {
            return false;
        }

        return in_array($user->role, Roles::residents(), true)
            && $this->context->may(Permissions::QUEUE_VIEW);
    }

    /** The live line, with student names: operators only, inside their scope. */
    public function viewLine(?User $user, RoomQueue $queue): bool
    {
        return $this->operate($user, $queue);
    }

    public function operate(?User $user, RoomQueue $queue): bool
    {
        if (! $user || ! $this->context->may(Permissions::QUEUE_OPERATE_ASSIGNED)) {
            return false;
        }

        return StaffScope::canOperateQueue($user, $queue);
    }

    /** Configuration is an Admin Web action; staff never rewrite capacity/timeout policy. */
    public function configure(?User $user, RoomQueue $queue): bool
    {
        return $user !== null
            && $user->role === Roles::ADMIN
            && $this->context->may(Permissions::QUEUE_CONFIGURE);
    }

    /** Creating a queue for a room is infrastructure work: admin, or staff inside their own scope. */
    public function create(?User $user, RoomQueue $queue): bool
    {
        if ($this->configure($user, $queue)) {
            return true;
        }

        return $this->operate($user, $queue);
    }

    public function delete(?User $user, RoomQueue $queue): bool
    {
        return $this->configure($user, $queue);
    }
}
