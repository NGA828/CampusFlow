<?php

namespace App\Services\Notifications;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Writes the notifications people actually see.
 *
 * Publishing something is the moment a campus tells its audience; without a writer here the
 * `notifications` table stays empty and the bell in the client has nothing to show. One row per
 * recipient, inserted in batches: an announcement to the whole campus is a thousand rows and the
 * request that created it should not pay for a thousand round trips.
 *
 * The audience is resolved here, in the backend. A client may ask for a role list, but it cannot
 * decide who is told what.
 */
class NotificationFanOut
{
    /** Rows per INSERT. Large enough to keep queries few, small enough to stay memory-friendly. */
    private const CHUNK = 500;

    /**
     * Notify every active user holding one of these roles.
     *
     * @param  list<string>  $roles
     * @param  array<string, mixed>  $data  Deep-link context carried to the client.
     * @param  int|null  $exceptUserId  The author does not need telling about their own post.
     */
    public function toRoles(
        array $roles,
        string $type,
        string $title,
        ?string $body = null,
        array $data = [],
        ?int $exceptUserId = null,
    ): int {
        $userIds = User::query()
            ->where('status', 'active')
            ->whereIn('role', $roles)
            ->when($exceptUserId !== null, fn ($query) => $query->where('id', '!=', $exceptUserId))
            ->pluck('id')
            ->all();

        return $this->toUsers($userIds, $type, $title, $body, $data);
    }

    /**
     * Notify a specific set of users.
     *
     * @param  list<string>  $userIds
     * @param  array<string, mixed>  $data
     */
    public function toUsers(array $userIds, string $type, string $title, ?string $body = null, array $data = []): int
    {
        $userIds = array_values(array_unique(array_filter($userIds, fn ($id) => filled($id))));

        if ($userIds === []) {
            return 0;
        }

        $now = now();
        $context = $data === [] ? null : json_encode($data);
        $sent = 0;

        foreach (array_chunk($userIds, self::CHUNK) as $chunk) {
            DB::table('notifications')->insert(array_map(fn (string $userId) => [
                'id'         => (string) Str::uuid(),
                'user_id'    => $userId,
                'type'       => $type,
                'title'      => $title,
                'body'       => $body,
                'data'       => $context,
                'read_at'    => null,
                'created_at' => $now,
                'updated_at' => $now,
            ], $chunk));

            $sent += count($chunk);
        }

        return $sent;
    }
}