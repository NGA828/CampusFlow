<?php

namespace App\Policies;

use App\Models\User;
use App\Support\Access\ClientContext;
use App\Support\Access\Permissions;
use App\Support\Access\Roles;

/**
 * User-account administration.
 *
 * Admin Web only, and deliberately without an "admin can edit other admins" free pass: the last
 * administrator must not be deletable or demotable in place, so the platform cannot be locked out
 * by an accidental click. Students and staff see nothing of this surface, and the API says so with
 * a 403 rather than a hidden menu item.
 */
class UserPolicy
{
    public function __construct(private readonly ClientContext $context)
    {
    }

    public function viewAny(?User $actor): bool
    {
        return $this->manage($actor);
    }

    public function view(?User $actor, User $subject): bool
    {
        if (! $this->manage($actor)) {
            return false;
        }

        // Admin may read any account, including their own; nobody else reads another account here.
        return true;
    }

    public function create(?User $actor): bool
    {
        return $this->manage($actor);
    }

    public function update(?User $actor, User $subject): bool
    {
        if (! $this->manage($actor)) {
            return false;
        }

        // A disabled administrator account cannot be edited by itself — it must be reactivated by
        // another administrator, which keeps a suspended principal from reviving its own access.
        if ($actor->status && $actor->status !== 'active') {
            return false;
        }

        return true;
    }

    /** Changing *who* someone is, is the most sensitive action in the product. */
    public function assignRole(?User $actor, User $subject): bool
    {
        if (! $this->manage($actor) || ! $this->context->may(Permissions::ROLES_MANAGE)) {
            return false;
        }

        return ! $this->wouldRemoveLastAdmin($subject);
    }

    public function resetPassword(?User $actor, User $subject): bool
    {
        if (! $this->manage($actor)) {
            return false;
        }

        // Users change their own password via PUT /auth/password; this path is for the other case.
        return true;
    }

    public function setStatus(?User $actor, User $subject): bool
    {
        if (! $this->manage($actor)) {
            return false;
        }

        if ($actor->is($subject)) {
            return false; // never disable your own account from the console
        }

        return ! $this->wouldRemoveLastAdmin($subject, $actor);
    }

    public function delete(?User $actor, User $subject): bool
    {
        if (! $this->manage($actor)) {
            return false;
        }

        if ($actor->is($subject)) {
            return false;
        }

        return ! $this->wouldRemoveLastAdmin($subject);
    }

    /** Staff and students have no read path into the user directory at all. */
    public function viewDirectory(?User $actor): bool
    {
        return $this->manage($actor);
    }

    private function manage(?User $actor): bool
    {
        return $actor !== null
            && $actor->role === Roles::ADMIN
            && $this->context->may(Permissions::USERS_MANAGE);
    }

    private function wouldRemoveLastAdmin(User $subject, ?User $actor = null): bool
    {
        $adminsRemaining = User::query()
            ->where('role', Roles::ADMIN)
            ->where('status', 'active')
            ->when($actor, fn ($q) => $q->where('id', '!=', $actor->id))
            ->count();

        return $subject->role === Roles::ADMIN && $adminsRemaining <= 1;
    }
}
