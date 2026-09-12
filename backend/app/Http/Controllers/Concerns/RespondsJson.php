<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\JsonResponse;

/**
 * The CampusFlow response envelope, shared by the role-scoped controllers.
 *
 * `legacy` controllers (AdminController, StaffController) carry their own equivalent helper; they
 * are migrated to this trait screen by screen rather than in one sweep, so the envelope shape is
 * identical everywhere without touching working code in the same change that re-routes it.
 */
trait RespondsJson
{
    protected function ok(array $data, int $status = 200, ?string $message = null): JsonResponse
    {
        $payload = ['success' => true, 'data' => $data];

        if ($message !== null) {
            $payload['message'] = $message;
        }

        return response()->json($payload, $status);
    }

    protected function fail(string $message, int $status = 422, array $extra = [], ?string $code = null): JsonResponse
    {
        return response()->json(array_merge([
            'success' => false,
            'message' => $message,
        ], $code ? ['code' => $code] : [], $extra), $status);
    }

    /**
     * 403 for "this is not your workspace". The message names the role's own home route so a client
     * can recover by navigating there instead of showing a dead error screen.
     */
    protected function forbiddenTo(string $role, string $capability, string $home): JsonResponse
    {
        return response()->json([
            'success'  => false,
            'message'  => sprintf('The %s workspace has no access to %s.', $role, $capability),
            'code'     => 'ROLE_NOT_PERMITTED',
            'your_home' => $home,
        ], 403);
    }
}
