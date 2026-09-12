<?php

namespace App\Support\Access;

/**
 * Authoritative role → permission registry.
 *
 * This is the source of truth for `GET /auth/me` → `user.permissions`, for the `role:` route
 * guards, for the policies in App\Policies, and for the admin "Roles & permissions" screen
 * (which renders this registry — it must never hard-code its own copy).
 *
 * Deliberately code-based rather than table-based at this stage: CampusFlow has exactly four
 * roles and their capability sets are a product decision, not a per-tenant configuration. If a
 * later milestone needs per-institution roles, the registry becomes a `permissions` table joined
 * through `role_permissions` and this class becomes the seeder — the callers do not change.
 *
 * Invariants:
 *  - a visitor has no permissions at all (public reads are unauthenticated projections, not grants);
 *  - `*` in the web/mobile "platforms" list means the permission is platform-neutral, NOT that any
 *    client may call it: platform can only narrow a decision (see {@see Platforms}).
 */
final class Permissions
{
    // Academic
    public const TIMETABLE_VIEW_OWN      = 'timetable.view.own';
    public const TIMETABLE_MANAGE_ASSIGNED = 'timetable.manage.assigned';
    public const TIMETABLE_MANAGE_ALL      = 'timetable.manage.all';
    public const ENROLMENTS_MANAGE         = 'enrolments.manage';
    public const COURSES_VIEW              = 'courses.view';

    // Campus / spatial
    public const CAMPUS_VIEW_PUBLIC   = 'campus.view.public';
    public const CAMPUS_VIEW_PRIVATE  = 'campus.view.private';
    public const ROOMS_MANAGE         = 'rooms.manage';
    /**
     * The one campus write an operator may make from the room screen: a status correction at the door
     * ("this room is occupied", "closed for the afternoon"). Everything else about a room — its capacity,
     * its admission rule, its visibility, its geometry — is estate work under `rooms.manage`.
     */
    public const ROOMS_UPDATE_OWN_SCOPE = 'rooms.update.own_scope';
    public const SPATIAL_VIEW         = 'spatial.view';
    public const SPATIAL_MANAGE       = 'spatial.manage';
    public const POSITIONING_UPDATE_OWN = 'positioning.update.own';
    public const NAVIGATION_LIVE      = 'navigation.live';
    public const NAVIGATION_PREVIEW   = 'navigation.preview';
    public const QR_SCAN              = 'qr.scan';

    // Queues
    public const QUEUE_VIEW            = 'queue.view';
    public const QUEUE_JOIN            = 'queue.join';
    public const QUEUE_OPERATE_ASSIGNED = 'queue.operate.assigned';
    public const QUEUE_CONFIGURE       = 'queue.configure';

    // Offices
    public const OFFICE_VIEW             = 'office.view';
    public const OFFICE_TICKET_REQUEST   = 'office.ticket.request';
    public const OFFICE_TICKET_VIEW_OWN  = 'office.ticket.view.own';
    public const OFFICE_OPERATE_ASSIGNED = 'office.operate.assigned';
    public const OFFICE_CONFIGURE        = 'office.configure';

    // Content
    public const CONTENT_VIEW     = 'content.view';
    public const CONTENT_MANAGE_OWN_SCOPE = 'content.manage.own_scope';
    public const CONTENT_PUBLISH  = 'content.publish';

    // Governance
    public const USERS_MANAGE        = 'users.manage';
    public const ROLES_MANAGE        = 'roles.manage';
    public const ANALYTICS_OPERATIONAL = 'analytics.operational';
    public const ANALYTICS_SYSTEM    = 'analytics.system';
    public const AUDIT_VIEW          = 'audit.view';
    public const SETTINGS_MANAGE     = 'settings.manage';

    // AI
    public const AI_BASIC          = 'ai.assistant.basic';
    public const AI_OPERATIONS     = 'ai.assistant.operations';
    public const AI_ADMINISTRATION = 'ai.assistant.administration';

    /**
     * Platform reachability per permission. `web` and `mobile` are the only platforms; a permission
     * that omits a platform cannot be exercised from it even by a role that holds the permission.
     *
     * @return array<string, list<string>>
     */
    public const GRANTS = [
        self::VISITOR => [],

        self::STUDENT => [
            self::TIMETABLE_VIEW_OWN      => ['web', 'mobile'],
            self::COURSES_VIEW            => ['web', 'mobile'],
            self::CAMPUS_VIEW_PUBLIC      => ['web', 'mobile'],
            self::CAMPUS_VIEW_PRIVATE     => ['web', 'mobile'],
            self::SPATIAL_VIEW            => ['web', 'mobile'],
            self::POSITIONING_UPDATE_OWN  => ['mobile'],
            self::NAVIGATION_LIVE         => ['mobile'],
            self::NAVIGATION_PREVIEW      => ['web', 'mobile'],
            self::QR_SCAN                 => ['mobile'],
            self::QUEUE_VIEW              => ['web', 'mobile'],
            self::QUEUE_JOIN              => ['web', 'mobile'],
            self::OFFICE_VIEW             => ['web', 'mobile'],
            self::OFFICE_TICKET_REQUEST   => ['web', 'mobile'],
            self::OFFICE_TICKET_VIEW_OWN  => ['web', 'mobile'],
            self::CONTENT_VIEW            => ['web', 'mobile'],
            self::AI_BASIC                => ['web', 'mobile'],
        ],

        self::STAFF => [
            self::TIMETABLE_VIEW_OWN        => ['web', 'mobile'],
            self::TIMETABLE_MANAGE_ASSIGNED => ['web'],
            self::COURSES_VIEW              => ['web', 'mobile'],
            self::CAMPUS_VIEW_PUBLIC        => ['web', 'mobile'],
            self::CAMPUS_VIEW_PRIVATE       => ['web', 'mobile'],
            self::SPATIAL_VIEW              => ['web'],
            self::NAVIGATION_PREVIEW        => ['web'],
            self::ROOMS_UPDATE_OWN_SCOPE    => ['web'],
            self::QUEUE_VIEW                => ['web', 'mobile'],
            self::QUEUE_OPERATE_ASSIGNED    => ['web', 'mobile'],
            self::OFFICE_VIEW               => ['web', 'mobile'],
            self::OFFICE_OPERATE_ASSIGNED   => ['web', 'mobile'],
            self::CONTENT_VIEW              => ['web', 'mobile'],
            self::CONTENT_MANAGE_OWN_SCOPE  => ['web'],
            self::CONTENT_PUBLISH           => ['web'],
            self::ANALYTICS_OPERATIONAL     => ['web'],
            self::AI_BASIC                  => ['web', 'mobile'],
            self::AI_OPERATIONS             => ['web', 'mobile'],
        ],

        self::ADMIN => [
            self::TIMETABLE_VIEW_OWN        => ['web'],
            self::TIMETABLE_MANAGE_ALL      => ['web'],
            self::ENROLMENTS_MANAGE         => ['web'],
            self::COURSES_VIEW              => ['web'],
            self::CAMPUS_VIEW_PUBLIC        => ['web', 'mobile'],
            self::CAMPUS_VIEW_PRIVATE       => ['web', 'mobile'],
            self::ROOMS_MANAGE              => ['web'],
            self::ROOMS_UPDATE_OWN_SCOPE    => ['web'],
            self::SPATIAL_VIEW              => ['web'],
            self::SPATIAL_MANAGE            => ['web'],
            self::NAVIGATION_PREVIEW        => ['web'],
            self::QUEUE_VIEW                => ['web', 'mobile'],
            self::QUEUE_OPERATE_ASSIGNED    => ['web'],
            self::QUEUE_CONFIGURE           => ['web'],
            self::OFFICE_VIEW               => ['web', 'mobile'],
            self::OFFICE_OPERATE_ASSIGNED   => ['web'],
            self::OFFICE_CONFIGURE          => ['web'],
            self::CONTENT_VIEW              => ['web'],
            self::CONTENT_MANAGE_OWN_SCOPE  => ['web'],
            self::CONTENT_PUBLISH           => ['web'],
            self::USERS_MANAGE              => ['web'],
            self::ROLES_MANAGE              => ['web'],
            self::ANALYTICS_OPERATIONAL     => ['web', 'mobile'],
            self::ANALYTICS_SYSTEM          => ['web', 'mobile'],
            self::AUDIT_VIEW                => ['web'],
            self::SETTINGS_MANAGE           => ['web'],
            self::AI_BASIC                  => ['web'],
            self::AI_ADMINISTRATION         => ['web'],
        ],
    ];

    /** @return list<string> permissions granted to a role (empty for visitors) */
    public static function forRole(?string $role): array
    {
        if (!Roles::isKnown($role)) {
            return [];
        }

        return array_keys(self::GRANTS[$role] ?? []);
    }

    public static function roleHas(?string $role, string $permission): bool
    {
        return array_key_exists($permission, self::GRANTS[$role] ?? []);
    }

    /**
     * A permission is exercisable when the role holds it *and* the platform is allowed for it.
     * This is the only place platform enters an authorization decision, and it can only remove.
     */
    public static function roleMayOn(?string $role, string $permission, ?string $platform): bool
    {
        if (!self::roleHas($role, $permission)) {
            return false;
        }

        if ($platform === null || $platform === Platforms::UNKNOWN) {
            // An unidentified client keeps the role's own rights; it never gains any.
            return true;
        }

        return in_array($platform, self::GRANTS[$role][$permission], true);
    }

    /** @return list<string> every permission name, for the admin registry screen */
    public static function all(): array
    {
        return array_keys(self::labels());
    }

    /**
     * Grouped registry for the admin "Roles & permissions" screen:
     * `[domain => [[permission, student, staff, admin], …]]`.
     */
    public static function registry(): array
    {
        $labels = self::labels();
        $groups = [];

        foreach ($labels as $permission => $meta) {
            $groups[$meta['domain']][] = [
                'permission' => $permission,
                'label'      => $meta['label'],
                'student'    => self::roleHas(Roles::STUDENT, $permission),
                'staff'      => self::roleHas(Roles::STAFF, $permission),
                'admin'      => self::roleHas(Roles::ADMIN, $permission),
                'platforms'  => [
                    'student' => self::GRANTS[Roles::STUDENT][$permission] ?? [],
                    'staff'   => self::GRANTS[Roles::STAFF][$permission] ?? [],
                    'admin'   => self::GRANTS[Roles::ADMIN][$permission] ?? [],
                ],
            ];
        }

        return $groups;
    }

    /**
     * @return array<string, array{label: string, domain: string}>
     */
    private static function labels(): array
    {
        return [
            self::TIMETABLE_VIEW_OWN        => ['label' => 'View own timetable', 'domain' => 'Academic'],
            self::TIMETABLE_MANAGE_ASSIGNED => ['label' => 'Manage assigned timetable entries', 'domain' => 'Academic'],
            self::TIMETABLE_MANAGE_ALL      => ['label' => 'Manage all timetable entries', 'domain' => 'Academic'],
            self::ENROLMENTS_MANAGE         => ['label' => 'Manage enrolments', 'domain' => 'Academic'],
            self::COURSES_VIEW              => ['label' => 'View courses and terms', 'domain' => 'Academic'],

            self::CAMPUS_VIEW_PUBLIC        => ['label' => 'View public campus data', 'domain' => 'Campus'],
            self::CAMPUS_VIEW_PRIVATE       => ['label' => 'View private campus detail', 'domain' => 'Campus'],
            self::ROOMS_MANAGE              => ['label' => 'Create and edit buildings, floors, rooms', 'domain' => 'Campus'],
            self::SPATIAL_VIEW              => ['label' => 'Inspect QR nodes and navigation graph', 'domain' => 'Spatial'],
            self::SPATIAL_MANAGE            => ['label' => 'Edit QR nodes, graph, geofences, plans', 'domain' => 'Spatial'],
            self::POSITIONING_UPDATE_OWN    => ['label' => 'Write own location fixes', 'domain' => 'Spatial'],
            self::NAVIGATION_LIVE           => ['label' => 'Run live navigation sessions', 'domain' => 'Spatial'],
            self::NAVIGATION_PREVIEW        => ['label' => 'Compute a route', 'domain' => 'Spatial'],
            self::QR_SCAN                   => ['label' => 'Scan a QR anchor', 'domain' => 'Spatial'],

            self::QUEUE_VIEW                => ['label' => 'View queue status', 'domain' => 'Queues'],
            self::QUEUE_JOIN                => ['label' => 'Take a queue ticket', 'domain' => 'Queues'],
            self::QUEUE_OPERATE_ASSIGNED    => ['label' => 'Operate assigned queues', 'domain' => 'Queues'],
            self::QUEUE_CONFIGURE           => ['label' => 'Configure queues', 'domain' => 'Queues'],

            self::OFFICE_VIEW               => ['label' => 'View offices and service windows', 'domain' => 'Offices'],
            self::OFFICE_TICKET_REQUEST      => ['label' => 'Request an office ticket', 'domain' => 'Offices'],
            self::OFFICE_TICKET_VIEW_OWN     => ['label' => 'View own office tickets', 'domain' => 'Offices'],
            self::OFFICE_OPERATE_ASSIGNED   => ['label' => 'Operate assigned offices', 'domain' => 'Offices'],
            self::OFFICE_CONFIGURE          => ['label' => 'Configure offices and windows', 'domain' => 'Offices'],

            self::CONTENT_VIEW              => ['label' => 'Read events and announcements', 'domain' => 'Content'],
            self::CONTENT_MANAGE_OWN_SCOPE  => ['label' => 'Author events and announcements', 'domain' => 'Content'],
            self::CONTENT_PUBLISH           => ['label' => 'Publish content', 'domain' => 'Content'],

            self::USERS_MANAGE              => ['label' => 'Create, edit, disable users', 'domain' => 'Governance'],
            self::ROLES_MANAGE              => ['label' => 'Assign roles', 'domain' => 'Governance'],
            self::ANALYTICS_OPERATIONAL     => ['label' => 'Operational analytics', 'domain' => 'Analytics'],
            self::ANALYTICS_SYSTEM          => ['label' => 'System-wide analytics', 'domain' => 'Analytics'],
            self::AUDIT_VIEW                => ['label' => 'Read the audit log', 'domain' => 'Governance'],
            self::SETTINGS_MANAGE           => ['label' => 'Change system settings', 'domain' => 'Governance'],

            self::AI_BASIC                  => ['label' => 'AI assistant (campus questions)', 'domain' => 'AI'],
            self::AI_OPERATIONS             => ['label' => 'AI assistant (queue operations)', 'domain' => 'AI'],
            self::AI_ADMINISTRATION         => ['label' => 'AI assistant (system analytics)', 'domain' => 'AI'],
        ];
    }
}
