<?php

use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\EnsureRole;
use App\Exceptions\BusinessRuleException;
use App\Http\Middleware\ResolveClientContext;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // `role:` answers identity for a whole route group; `permission:` answers capability on a
        // single route. Both run before the controller, so a forgotten check inside a method cannot
        // become a hole. Every route in routes/api.php declares one or the other.
        $middleware->alias([
            'role'       => EnsureRole::class,
            'permission' => EnsurePermission::class,
        ]);

        // Every API request carries its platform context (web | mobile | api), which may only ever
        // narrow what a role is allowed to do — never widen it.
        $middleware->api(append: [
            ResolveClientContext::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // A product refusal (queue full, not in the geofence, wrong ticket state) must reach the client
        // as a code, not as prose to be string-matched.
        $exceptions->render(function (BusinessRuleException $e, Request $request) {
            return response()->json(array_merge([
                'success' => false,
                'message' => $e->getMessage(),
                'code'    => $e->code,
            ], $e->context ? ['data' => $e->context] : []), $e->status);
        });
    })->create();
