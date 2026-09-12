<?php

namespace App\Models;

use App\Support\Access\ClientContext;
use App\Support\Access\Permissions;
use App\Support\Access\Platforms;
use App\Support\Access\Roles;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * CampusFlow User model.
 *
 * Roles: visitor | student | staff | admin
 * Role checks are always authoritative here — never trust role from a request.
 *
 * @property int         $id
 * @property string      $name
 * @property string      $email
 * @property string      $role
 * @property string|null $registration_no
 * @property string|null $department
 * @property string|null $phone
 * @property string|null $avatar_url
 * @property \Carbon\Carbon|null $email_verified_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property \Carbon\Carbon|null $deleted_at
 */
#[Fillable(['name', 'email', 'password', 'role', 'registration_no', 'department', 'phone', 'avatar_url'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    // ----------------------------------------------------------------- casts

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
        ];
    }

    // ----------------------------------------------------------- role helpers
    //
    // Identity only. Capability questions go through hasPermission()/permissionsForContext(), and
    // resource questions go through the policies in App\Policies. `isStaff()` must never be used to
    // decide whether a request is allowed — it decides which *workspace* a human belongs to.

    public function isStudent(): bool
    {
        return $this->role === Roles::STUDENT;
    }

    public function isStaff(): bool
    {
        return $this->role === Roles::STAFF;
    }

    public function isAdmin(): bool
    {
        return $this->role === Roles::ADMIN;
    }

    public function isVisitor(): bool
    {
        return $this->role === Roles::VISITOR;
    }

    public function isActive(): bool
    {
        return ($this->status ?? 'active') === 'active';
    }

    /** Raw role grant, ignoring platform. Prefer {@see permissionsForContext()}. */
    public function permissions(): array
    {
        return Permissions::forRole($this->role);
    }

    /**
     * The permissions this account may exercise *from the client that asked*, which is what a
     * navigation model must be built from. A student on the web therefore does not receive
     * `qr.scan` or `navigation.live` even though the student role holds them.
     */
    public function permissionsForContext(?ClientContext $context = null): array
    {
        $context ??= app(ClientContext::class);

        return Platforms::allowedPermissions($this->role, $context->platform);
    }

    public function hasPermission(string $permission): bool
    {
        return $this->isActive()
            && Permissions::roleHas($this->role, $permission);
    }

    /** Where the client should send this human after sign-in. Never guessed by the client. */
    public function homeRoute(): string
    {
        return Roles::homeRoute($this->role ?? Roles::VISITOR);
    }

    // ----------------------------------------------------------------- academic

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class, 'student_id');
    }

    public function taughtTimetableEntries()
    {
        return $this->hasMany(TimetableEntry::class, 'lecturer_id');
    }

    public function staffAssignments()
    {
        return $this->hasMany(StaffAssignment::class);
    }

    public function notifications()
    {
        return $this->hasMany(UserNotification::class);
    }

    // --------------------------------------------------------- staff assignments
    //
    // Real scope rows from `staff_assignments`. Staff dashboards and the queue/office policies read
    // this, so "which line may I run?" is a data question answered by administration, not a
    // hard-coded assumption about anyone holding the staff role.

    public function getAssignmentsAttribute(): array
    {
        if (array_key_exists('assignments', $this->relations)) {
            return $this->relations['assignments']->map(fn (StaffAssignment $a) => $a->toApiArray())->all();
        }

        if (! $this->isStaff() && ! $this->isAdmin()) {
            return [];
        }

        return $this->staffAssignments()->get()
            ->map(fn (StaffAssignment $a) => $a->toApiArray())
            ->all();
    }

    // ---------------------------------------------------------------- toArray

    /**
     * The attributes included in the public API representation.
     * Matches the `User` type in frontend/lib/api/types.ts.
     */
    public function toApiArray(): array
    {
        return [
            'id'              => $this->id,
            'name'            => $this->name,
            'email'           => $this->email,
            'role'            => $this->role,
            'role_code'       => $this->role,
            'status'          => $this->status ?? 'active',
            'registration_no' => $this->registration_no,
            'department'      => $this->department,
            'phone'           => $this->phone,
            'avatar_url'      => $this->avatar_url,
            'email_verified'  => $this->email_verified_at !== null,
            'assignments'     => $this->assignments,
            'permissions'     => $this->permissions(),
            'created_at'      => $this->created_at?->toIso8601String(),
        ];
    }
}
