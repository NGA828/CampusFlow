<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\OfficeTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OfficeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_can_list_offices(): void
    {
        $response = $this->getJson('/api/v1/public/offices');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertNotEmpty($response->json('data'));
    }

    public function test_student_can_take_office_ticket(): void
    {
        $student = User::where('role', 'student')->first();
        $office = Office::first();

        $response = $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/student/offices/{$office->id}/tickets", [
                'service_type' => 'Transcripts',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);
    }

    public function test_client_office_ticket_contract_can_be_read_by_its_owner(): void
    {
        $student = User::where('role', 'student')->firstOrFail();
        $office = Office::firstOrFail();

        $created = $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/student/offices/{$office->id}/tickets", ['subject' => 'Transcripts']);

        $created->assertCreated()->assertJsonPath('success', true);
        $ticketId = $created->json('data.ticket.id');

        $this->actingAs($student, 'sanctum')
            ->getJson("/api/v1/student/office-tickets/{$ticketId}")
            ->assertOk()
            ->assertJsonPath('data.ticket.id', $ticketId)
            ->assertJsonStructure(['data' => ['office', 'people_ahead', 'can_cancel']]);
    }

    public function test_office_call_past_its_grace_period_is_marked_no_show(): void
    {
        $student = User::where('role', 'student')->firstOrFail();
        $office = Office::firstOrFail();
        $office->forceFill([
            'requires_appointment' => false,
            'requires_proximity_to_request' => false,
            'daily_capacity' => null,
            'grace_period_seconds' => 60,
        ])->save();

        $ticketId = $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/student/offices/{$office->id}/tickets", ['subject' => 'Timeout test'])
            ->assertCreated()
            ->json('data.ticket.id');

        OfficeTicket::whereKey($ticketId)->update([
            'status' => 'called',
            'called_at' => now()->subMinutes(5),
        ]);

        $this->artisan('campusflow:tickets:expire')->assertExitCode(0);

        $this->assertDatabaseHas('office_tickets', [
            'id' => $ticketId,
            'status' => 'no_show',
            'cancelled_by' => 'system',
        ]);
        $this->assertDatabaseHas('office_events', ['ticket_id' => $ticketId, 'type' => 'no_show']);
    }

    public function test_student_can_view_office_by_code(): void
    {
        $student = User::where('role', 'student')->firstOrFail();
        $office = Office::firstOrFail();

        $this->actingAs($student, 'sanctum')
            ->getJson("/api/v1/student/offices/{$office->code}")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.office.id', $office->id)
            ->assertJsonPath('data.office.code', $office->code);
    }
}


