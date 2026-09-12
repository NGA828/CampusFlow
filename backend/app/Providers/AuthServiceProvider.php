<?php

namespace App\Providers;

use App\Models\Announcement;
use App\Models\Building;
use App\Models\CampusEvent;
use App\Models\Floor;
use App\Models\NavigationEdge;
use App\Models\NavigationNode;
use App\Models\Office;
use App\Models\OfficeTicket;
use App\Models\QrNode;
use App\Models\QueueTicket;
use App\Models\Room;
use App\Models\RoomQueue;
use App\Models\TimetableEntry;
use App\Models\User;
use App\Policies\CampusInfrastructurePolicy;
use App\Policies\ContentPolicy;
use App\Policies\OfficePolicy;
use App\Policies\OfficeTicketPolicy;
use App\Policies\QueueTicketPolicy;
use App\Policies\RoomQueuePolicy;
use App\Policies\TimetableEntryPolicy;
use App\Policies\UserPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Binds every governed model to the policy that decides role + permission + resource ownership.
 *
 * There is intentionally **no** `Gate::before` super-user shortcut. An early return for `admin`
 * would silently grant administration-shaped routes to the same principal everywhere, which is the
 * exact failure this correction removes: an administrator is an administrator of *management*
 * surfaces, not a student with extra buttons.
 */
class AuthServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    public array $policies = [
        Building::class        => CampusInfrastructurePolicy::class,
        Floor::class           => CampusInfrastructurePolicy::class,
        Room::class            => CampusInfrastructurePolicy::class,
        QrNode::class          => CampusInfrastructurePolicy::class,
        NavigationNode::class  => CampusInfrastructurePolicy::class,
        NavigationEdge::class  => CampusInfrastructurePolicy::class,
        RoomQueue::class       => RoomQueuePolicy::class,
        QueueTicket::class     => QueueTicketPolicy::class,
        Office::class          => OfficePolicy::class,
        OfficeTicket::class    => OfficeTicketPolicy::class,
        TimetableEntry::class  => TimetableEntryPolicy::class,
        CampusEvent::class     => ContentPolicy::class,
        Announcement::class    => ContentPolicy::class,
        User::class            => UserPolicy::class,
    ];

    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        foreach ($this->policies as $model => $policy) {
            Gate::policy($model, $policy);
        }
    }
}
