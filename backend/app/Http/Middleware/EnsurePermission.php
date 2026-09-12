<?php

namespace App\Http\Middleware;

use App\Support\Access\ClientContext;
use App\Support\Access\Permissions;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * `permission:queue.join` — capability gate on top of identity.
 *
 * Role answers "who are you"; permission answers "is this capability assigned to you on this
 * platform". Routes that protect a workflow (joining a queue, calling the next ticket, editing the
 * navigation graph) check a permission so a role change in one place updates every surface.
 */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $context = $request->attributes->get('campusflow.context') ?? ClientContext::fromRequest($request);
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required.',
                'code'    => 'UNAUTHENTICATED',
            ], 401);
        }

        $deniedByPlatform = [];

        foreach ($permissions as $permission) {
            if ($context->may($permission)) {
                continue;
            }

            // Distinguish "you are not this kind of user" from "your users may do this, but not
            // from this platform" so clients can explain the difference instead of showing 403.
            if (Permissions::roleHas($user->role, $permission)) {
                $deniedByPlatform[] = $permission;
            } else {
                return response()->json([
                    'success'  => false,
                    'message'  => 'Your role is not permitted to perform this action.',
                    'code'     => 'PERMISSION_DENIED',
                    'required_permission' => $permission,
                ], 403);
            }
        }

        if ($deniedByPlatform !== []) {
            return response()->json([
                'success' => false,
                'message' => sprintf(
                    'This action is not available from the %s client. %s',
                    $context->platform,
                    $context->isWeb()
                        ? 'It requires the CampusFlow mobile app.'
                        : 'It is a desktop-only management action.',
                ),
                'code'               => 'PLATFORM_NOT_SUPPORTED',
                'required_permission' => $deniedByPlatform[0],
                'platform'           => $context->platform,
            ], 403);
        }

        return $next($request);
    }
}
