<?php

namespace App\Support\Access;

/**
 * The four primary CampusFlow roles.
 *
 * A role is identity, not a capability bag: capabilities come from {@see Permissions}
 * and resource scope comes from the policies in App\Policies. Nothing in the application
 * may infer a role from request input — the role is read from the authenticated principal only.
 */
final class Roles
{
    public const VISITOR = 'visitor';
    public const STUDENT = 'student';
    public const STAFF   = 'staff';
    public const ADMIN   = 'admin';

    /** @return list<string> */
    public static function all(): array
    {
        return [self::VISITOR, self::STUDENT, self::STAFF, self::ADMIN];
    }

    /** Roles that may open an authenticated workspace at all. */
    public static function residents(): array
    {
        return [self::STUDENT, self::STAFF, self::ADMIN];
    }

    public static function isKnown(?string $role): bool
    {
        return in_array($role, self::all(), true);
    }

    /** Human label used in dashboards and audit output. */
    public static function label(string $role): string
    {
        return [
            self::VISITOR => 'Visitor',
            self::STUDENT => 'Student',
            self::STAFF   => 'Staff',
            self::ADMIN   => 'Administrator',
        ][$role] ?? ucfirst($role);
    }

    /**
     * The single home surface for a role. Clients must not invent their own landing route:
     * a student landing on a staff dashboard (or vice versa) is a routing defect, and this
     * map is what both the API redirect hints and the web role guards use.
     */
    public static function homeRoute(string $role): string
    {
        return [
            self::VISITOR => '/',
            self::STUDENT => '/student/dashboard',
            self::STAFF   => '/staff/dashboard',
            self::ADMIN   => '/admin/dashboard',
        ][$role] ?? '/';
    }
}
