<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

/**
 * Handles all authentication operations:
 *  POST /api/v1/auth/register
 *  POST /api/v1/auth/login
 *  POST /api/v1/auth/logout
 *  GET  /api/v1/auth/me          (alias: /api/v1/me)
 *  POST /api/v1/auth/password    (change password)
 *  POST /api/v1/auth/forgot-password
 *  POST /api/v1/auth/reset-password
 *  PATCH /api/v1/me              (update profile)
 *
 * Every response uses the standard CampusFlow envelope:
 *   { success: true, data: {...}, message: "..." }
 *   { success: false, message: "...", errors: {...} }
 */
class AuthController extends Controller
{
    // ---------------------------------------------------------------- register

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'            => ['required', 'string', 'max:255'],
            'email'           => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password'        => ['required', 'confirmed', PasswordRule::min(8)],
            'role'            => ['sometimes', 'string', 'in:student,staff'],
            'registration_no' => ['sometimes', 'nullable', 'string', 'max:50', 'unique:users'],
            'department'      => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        // Default role is student; admin accounts are created only by admins.
        $role = $validated['role'] ?? 'student';

        $user = User::create([
            'name'            => $validated['name'],
            'email'           => $validated['email'],
            'password'        => $validated['password'],
            'role'            => $role,
            'registration_no' => $validated['registration_no'] ?? null,
            'department'      => $validated['department'] ?? null,
        ]);

        $token = $user->createToken('web')->plainTextToken;

        return response()->json([
            'success' => true,
            'data'    => [
                'user'  => $user->toApiArray(),
                'token' => $token,
            ],
            'message' => 'Account created successfully.',
        ], 201);
    }

    // ------------------------------------------------------------------ login

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email'    => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Revoke all previous tokens to enforce single-session; adjust if
        // multi-device is required later.
        $user->tokens()->delete();

        $token = $user->createToken('web')->plainTextToken;

        return response()->json([
            'success' => true,
            'data'    => [
                'user'  => $user->toApiArray(),
                'token' => $token,
            ],
            'message' => 'Logged in successfully.',
        ]);
    }

    // ----------------------------------------------------------------- logout

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'data'    => ['revoked' => true],
            'message' => 'Logged out successfully.',
        ]);
    }

    // --------------------------------------------------------------------- me

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data'    => [
                'user'        => $user->toApiArray(),
                'assignments' => $user->assignments,
            ],
        ]);
    }

    // --------------------------------------------------------- update profile

    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'       => ['sometimes', 'string', 'max:255'],
            'phone'      => ['sometimes', 'nullable', 'string', 'max:30'],
            'department' => ['sometimes', 'nullable', 'string', 'max:120'],
            'avatar_url' => ['sometimes', 'nullable', 'url', 'max:500'],
        ]);

        $request->user()->update($validated);

        return response()->json([
            'success' => true,
            'data'    => ['user' => $request->user()->fresh()->toApiArray()],
            'message' => 'Profile updated.',
        ]);
    }

    // --------------------------------------------------------- change password

    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password'         => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        if (! Hash::check($validated['current_password'], $request->user()->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $request->user()->update(['password' => $validated['password']]);

        // Invalidate all tokens so other sessions are forced to re-authenticate.
        $request->user()->tokens()->delete();

        return response()->json([
            'success' => true,
            'data'    => ['changed' => true],
            'message' => 'Password changed. Please log in again.',
        ]);
    }

    // ------------------------------------------------------- forgot password

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        $status = Password::sendResetLink($request->only('email'));

        // In development mode return the reset token directly so the UI can
        // deep-link without needing a real mail server.
        $extra = [];
        if (config('app.debug')) {
            // Grab the raw token from the broker — safe in dev, never in prod.
            $user = User::where('email', $request->email)->first();
            if ($user) {
                $token = Password::broker()->createToken($user);
                $extra['reset_token'] = $token;
            }
        }

        return response()->json([
            'success' => true,
            'data'    => array_merge(['sent' => $status === Password::RESET_LINK_SENT], $extra),
            'message' => __($status),
        ]);
    }

    // -------------------------------------------------------- reset password

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token'    => ['required', 'string'],
            'email'    => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $status = Password::reset(
            $validated,
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])
                     ->setRememberToken(Str::random(60));
                $user->save();
                event(new PasswordReset($user));
                $user->tokens()->delete();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'token' => [__($status)],
            ]);
        }

        return response()->json([
            'success' => true,
            'data'    => ['reset' => true],
            'message' => __($status),
        ]);
    }
}
