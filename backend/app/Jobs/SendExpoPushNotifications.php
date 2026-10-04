<?php

namespace App\Jobs;

use App\Models\DeviceToken;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Http\Client\Response;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Best-effort delivery of inbox notifications to registered Expo devices.
 * The durable in-app notification is written before this job is queued; a push outage never
 * changes the result of the campus operation that caused the notification.
 */
class SendExpoPushNotifications implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 4;

    /** @param list<int|string> $userIds @param array<string, mixed> $data */
    public function __construct(
        public array $userIds,
        public string $title,
        public ?string $body,
        public array $data = [],
    ) {
        $this->onQueue('notifications');
    }

    /** @return list<int> */
    public function backoff(): array
    {
        return [10, 30, 90];
    }

    public function handle(): void
    {
        $devices = DeviceToken::query()
            ->whereIn('user_id', $this->userIds)
            ->whereIn('platform', ['ios', 'android'])
            ->get();

        foreach ($devices->chunk(100) as $chunk) {
            $messages = $chunk->map(fn (DeviceToken $device) => [
                'to' => $device->token,
                'title' => $this->title,
                'body' => $this->body ?? '',
                'sound' => 'default',
                'channelId' => 'default',
                'data' => $this->data,
            ])->values()->all();

            if ($messages === []) {
                continue;
            }

            $response = Http::acceptJson()
                ->asJson()
                ->timeout(10)
                ->post('https://exp.host/--/api/v2/push/send', $messages)
                ->throw();

            $this->removeRejectedTokens($response, $chunk->values()->all());
        }
    }

    /** @param list<DeviceToken> $devices */
    private function removeRejectedTokens(Response $response, array $devices): void
    {
        $receipts = $response->json('data', []);

        if (! is_array($receipts)) {
            return;
        }

        foreach ($receipts as $index => $receipt) {
            $device = $devices[$index] ?? null;
            $error = is_array($receipt) ? ($receipt['details']['error'] ?? null) : null;

            if (! $device || $error !== 'DeviceNotRegistered') {
                if (is_array($receipt) && ($receipt['status'] ?? null) === 'error') {
                    Log::warning('Expo push delivery rejected a notification.', [
                        'device_token_id' => $device?->id,
                        'error' => $error ?? ($receipt['message'] ?? 'unknown'),
                    ]);
                }
                continue;
            }

            $device->delete();
        }
    }
}
