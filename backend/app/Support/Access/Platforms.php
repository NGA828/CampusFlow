<?php

namespace App\Support\Access;

/**
 * Platform identity for a request.
 *
 * IMPORTANT — what this is and is not:
 *
 * It is a *narrowing* signal. A client declaring `mobile` can never gain a capability that its
 * role does not have; it can only lose one (e.g. `queue.join` from `web` is allowed, while
 * `positioning.update.own` is mobile-only, so a web client gets 403 for it). The value is derived
 * from an explicit header and is therefore advisory — it must never be the sole reason to *allow*
 * anything, and no policy in App\Policies uses it to widen a decision.
 *
 * The header exists because the product rule ("Campus map on mobile is the primary experience; the
 * scanner is not a web feature") has to be enforced somewhere, and enforcing it server-side is the
 * difference between a design principle and a preference.
 */
final class Platforms
{
    public const WEB    = 'web';
    public const MOBILE = 'mobile';
    public const API    = 'api';
    public const UNKNOWN = 'unknown';

    /** Header a client may send to declare its platform. */
    public const HEADER = 'X-CampusFlow-Client';

    public static function normalize(?string $value): string
    {
        $value = strtolower(trim((string) $value));

        return match (true) {
            $value === self::WEB, $value === 'webapp', $value === 'next' => self::WEB,
            $value === self::MOBILE, $value === 'app', $value === 'expo', $value === 'ios', $value === 'android' => self::MOBILE,
            $value === self::API, $value === 'test', $value === 'cli' => self::API,
            default => self::UNKNOWN,
        };
    }

    /**
     * Fallback detection when a client forgets the header. This is best-effort and conservative:
     * an unrecognised caller is `unknown`, which keeps its role's rights rather than assuming any.
     */
    public static function fromRequest(?\Illuminate\Http\Request $request): string
    {
        if (! $request) {
            return self::UNKNOWN;
        }

        $declared = self::normalize($request->header(self::HEADER));
        if ($declared !== self::UNKNOWN) {
            return $declared;
        }

        $agent = strtolower((string) $request->userAgent());
        if (str_contains($agent, 'expo') || str_contains($agent, 'okhttp') || str_contains($agent, 'cfmobile')) {
            return self::MOBILE;
        }
        if (str_contains($agent, 'curl') || str_contains($agent, 'symfony') || str_contains($agent, 'pest') || str_contains($agent, 'phpunit')) {
            return self::API;
        }
        if ($agent !== '') {
            return self::WEB;
        }

        return self::UNKNOWN;
    }

    /** @return list<string> */
    public static function all(): array
    {
        return [self::WEB, self::MOBILE, self::API];
    }

    /**
     * The capability ceiling for a role+platform pair, used by `/auth/me` so a client can render
     * its navigation from an authoritative answer instead of guessing from its own viewport.
     *
     * @return list<string>
     */
    public static function allowedPermissions(?string $role, string $platform): array
    {
        $platform = self::normalize($platform);

        if (!Roles::isKnown($role)) {
            return [];
        }

        $grants = Permissions::GRANTS[$role] ?? [];
        $allowed = [];

        foreach ($grants as $permission => $platforms) {
            if ($platform === self::UNKNOWN || $platform === self::API || in_array($platform, $platforms, true)) {
                $allowed[] = $permission;
            }
        }

        return $allowed;
    }
}
