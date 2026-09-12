<?php

namespace App\Http\Middleware;

use App\Support\Access\ClientContext;
use App\Support\Access\Platforms;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Attaches the request's platform context (`web` | `mobile` | `api` | `unknown`) and exposes it to
 * policies, the AI tool registry and every controller that has to know *how* the caller arrived.
 *
 * Registered on the whole `api` group, so even public and self-scoped routes can answer
 * "which platform is this", without any of them trusting it for a privilege.
 */
class ResolveClientContext
{
    public function handle(Request $request, Closure $next): Response
    {
        // The request itself is carried so the principal can be resolved lazily: this middleware runs
        // before auth:sanctum, so $request->user() is still null here and only answers later.
        $context = new ClientContext(null, Platforms::fromRequest($request), $request);

        $request->attributes->set('campusflow.context', $context);
        app()->instance(ClientContext::class, $context);

        return $next($request);
    }
}
