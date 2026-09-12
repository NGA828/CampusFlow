<?php

namespace App\Http\Middleware;

use App\Support\Access\ClientContext;
use App\Support\Access\Platforms;
use App\Support\Access\Roles;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * `role:student` / `role:staff,admin`
 *
 * The only place role access is decided for a route group. This is not a UI concern: a request
 * that reaches a student-only route from a staff or admin principal is rejected here, before the
 * controller runs, so a forgotten `if` in a controller can never become a hole.
 *
 * `permission:queue.join` (see {@see EnsurePermission}) layers on top of this when a route needs a
 * capability rather than an identity.
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required.',
                'code'    => 'UNAUTHENTICATED',
            ], 401);
        }

        if ($user->status && $user->status !== 'active') {
            return response()->json([
                'success' => false,
                'message' => 'This account is ' . $user->status . '. Contact an administrator.',
                'code'    => 'ACCOUNT_' . strtoupper($user->status),
            ], 403);
        }

        if (! Roles::isKnown($user->role)) {
            return $this->deny($user->role, $roles);
        }

        if (! in_array($user->role, $roles, true)) {
            return $this->deny($user->role, $roles);
        }

        // Publish the platform context for policies, the AI tool registry and /auth/me.
        $context = new ClientContext($user, Platforms::fromRequest($request));
        $request->attributes->set('campusflow.context', $context);
        $this->bindContext($context);

        return $next($request);
    }

    private function bindContext(ClientContext $context): void
    {
        // app() is used rather than constructor injection in the constructor binding so the
        // container always resolves the *current* request's context inside policies.
        app()->instance(ClientContext::class, $context);
    }

    private function deny(?string $role, array $allowed): Response
    {
        return response()->json([
            'success'  => false,
            'message'  => sprintf(
                'This capability belongs to the %s workspace; your account (%s) has no access to it.',
                implode(' or ', array_map(static fn ($r) => Roles::label($r), $allowed)) ?: 'another',
                Roles::label((string) $role),
            ),
            'code'         => 'ROLE_NOT_PERMITTED',
            'required_roles' => $allowed,
            'your_role'      => $role,
            'your_home'      => Roles::homeRoute((string) $role),
        ], 403);
    }
}
