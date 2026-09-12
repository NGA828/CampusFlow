<?php

namespace App\Policies;

use App\Models\Announcement;
use App\Models\CampusEvent;
use App\Models\User;
use App\Support\Access\ClientContext;
use App\Support\Access\Permissions;
use App\Support\Access\Roles;

/**
 * Events and announcements.
 *
 * Reading is open — published content is public information, and events are also on the visitor
 * surface. Authoring is Staff Web (or Admin Web), and a staff author may only publish into the
 * scopes they own, so the operations console can run campus life without becoming a CMS admin.
 *
 * Students never get a create/edit route, on either platform.
 */
class ContentPolicy
{
    public function __construct(private readonly ClientContext $context)
    {
    }

    public function viewAny(?User $user): bool
    {
        return true; // published content is public; the projection strips drafts
    }

    public function create(?User $user): bool
    {
        return $this->author($user);
    }

    public function update(?User $user, object $record): bool
    {
        if (! $this->author($user)) {
            return false;
        }

        if ($user->role === Roles::ADMIN) {
            return true;
        }

        // Own work first, then any assignment-scoped authority.
        $ownedByActor = (property_exists($record, 'author_id') && (string) $record->author_id === (string) $user->id)
            || (property_exists($record, 'created_by') && (string) $record->created_by === (string) $user->id);

        return $ownedByActor || $this->context->may(Permissions::CONTENT_PUBLISH);
    }

    public function delete(?User $user, object $record): bool
    {
        return $this->update($user, $record);
    }

    public function publish(?User $user): bool
    {
        return $this->author($user) && $this->context->may(Permissions::CONTENT_PUBLISH);
    }

    /** A student may register for an event; that is a personal, self-scoped write. */
    public function register(?User $user, CampusEvent $event): bool
    {
        return $user !== null
            && $user->role === Roles::STUDENT
            && $this->context->may(Permissions::CONTENT_VIEW);
    }

    private function author(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        return $user->role === Roles::ADMIN
            || $this->context->may(Permissions::CONTENT_MANAGE_OWN_SCOPE);
    }
}
