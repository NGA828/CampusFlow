<?php

namespace App\Models;

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

    public function isStudent(): bool
    {
        return $this->role === 'student';
    }

    public function isStaff(): bool
    {
        return $this->role === 'staff';
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isVisitor(): bool
    {
        return $this->role === 'visitor';
    }

    // --------------------------------------------------------- staff assignments
    // Eager-loadable relationship populated once staff assignment table exists.
    // Returning an empty collection until that migration runs keeps auth/me
    // serialisation consistent from day one.

    public function getAssignmentsAttribute(): array
    {
        // Will be replaced by a real hasMany once the staff_assignments table exists.
        return [];
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
            'permissions'     => [],
            'created_at'      => $this->created_at?->toIso8601String(),
        ];
    }
}
