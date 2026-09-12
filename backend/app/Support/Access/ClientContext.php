<?php

namespace App\Support\Access;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * Per-request authorization context: who the caller is, which platform they arrived from, and
 * what that combination may exercise.
 *
 * Policies ask this object instead of re-deriving the platform, so "web may not open a live
 * navigation session" is stated once (here) rather than in every controller.
 *
 * The principal is resolved lazily: {@see \App\Http\Middleware\ResolveClientContext} attaches this
 * to every API request and runs before `auth:sanctum`, so `$request->user()` only answers once the
 * guard has authenticated. `$resolvedUser` is the eager path used by `EnsureRole`, which runs after.
 */
final class ClientContext
{
    public function __construct(
        private readonly ?User $resolvedUser,
        public readonly string $platform,
        private readonly ?Request $request = null,
    ) {
    }

    public static function fromRequest(Request $request): self
    {
        /** @var self|null $existing */
        $existing = $request->attributes->get('campusflow.context');
        if ($existing instanceof self) {
            return $existing;
        }

        return new self($request->user(), Platforms::fromRequest($request), $request);
    }

    public function isMobile(): bool
    {
        return $this->platform === Platforms::MOBILE;
    }

    public function isWeb(): bool
    {
        return $this->platform === Platforms::WEB;
    }

    public function actor(): ?User
    {
        return $this->resolvedUser ?? $this->request?->user();
    }

    public function role(): ?string
    {
        return $this->actor()?->role;
    }

    public function isRole(string ...$roles): bool
    {
        $role = $this->role();

        return $role !== null && in_array($role, $roles, true);
    }

    /** Role holds the permission *and* the platform is allowed to exercise it. */
    public function may(string $permission): bool
    {
        $actor = $this->actor();

        if (! $actor) {
            return false;
        }

        if ($actor->status && $actor->status !== 'active') {
            return false;
        }

        return Permissions::roleMayOn($actor->role, $permission, $this->platform);
    }

    /** @return list<string> */
    public function permissions(): array
    {
        return Platforms::allowedPermissions($this->role(), $this->platform);
    }

    public function toArray(): array
    {
        return [
            'platform'    => $this->platform,
            'role'        => $this->role(),
            'permissions' => $this->permissions(),
        ];
    }
}
