<?php

namespace Tests\Feature;

use App\Jobs\SendExpoPushNotifications;
use App\Models\DeviceToken;
use App\Models\User;
use App\Services\Notifications\NotificationFanOut;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class PushNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_fanout_persists_inbox_rows_and_queues_push_delivery(): void
    {
        Queue::fake();
        $user = User::factory()->create(['role' => 'student']);

        $count = app(NotificationFanOut::class)->toUsers(
            [$user->id],
            'queue_called',
            'It is your turn',
            'Please head to the room.',
            ['ticket_id' => 'ticket-123'],
        );

        $this->assertSame(1, $count);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'queue_called',
            'title' => 'It is your turn',
        ]);
        Queue::assertPushed(SendExpoPushNotifications::class);
    }

    public function test_expo_delivery_sends_to_registered_devices_and_removes_dead_tokens(): void
    {
        Http::fake([
            'https://exp.host/--/api/v2/push/send' => Http::response([
                'data' => [
                    ['status' => 'ok', 'id' => 'receipt-1'],
                    ['status' => 'error', 'details' => ['error' => 'DeviceNotRegistered']],
                ],
            ]),
        ]);

        $user = User::factory()->create(['role' => 'student']);
        $active = DeviceToken::create([
            'user_id' => $user->id,
            'token' => 'ExponentPushToken[active-device]',
            'platform' => 'android',
            'last_seen_at' => now(),
        ]);
        $dead = DeviceToken::create([
            'user_id' => $user->id,
            'token' => 'ExponentPushToken[dead-device]',
            'platform' => 'ios',
            'last_seen_at' => now(),
        ]);

        (new SendExpoPushNotifications(
            [$user->id],
            'It is your turn',
            'Please head to the room.',
            ['ticket_id' => 'ticket-123'],
        ))->handle();

        Http::assertSent(function ($request) use ($active, $dead) {
            $body = $request->data();

            return $request->url() === 'https://exp.host/--/api/v2/push/send'
                && count($body) === 2
                && in_array($active->token, array_column($body, 'to'), true)
                && in_array($dead->token, array_column($body, 'to'), true)
                && $body[0]['data']['ticket_id'] === 'ticket-123';
        });
        $this->assertDatabaseHas('device_tokens', ['id' => $active->id]);
        $this->assertDatabaseMissing('device_tokens', ['id' => $dead->id]);
    }
}
