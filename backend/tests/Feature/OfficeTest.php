<?php

namespace Tests\Feature;

use App\Models\Office;
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
        $response = $this->getJson('/api/v1/offices');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertNotEmpty($response->json('data'));
    }

    public function test_student_can_take_office_ticket(): void
    {
        $student = User::where('role', 'student')->first();
        $office = Office::first();

        $response = $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/offices/{$office->id}/tickets", [
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
            ->postJson("/api/v1/offices/{$office->id}/tickets", ['subject' => 'Transcripts']);

        $created->assertCreated()->assertJsonPath('success', true);
        $ticketId = $created->json('data.ticket.id');

        $this->actingAs($student, 'sanctum')
            ->getJson("/api/v1/office-tickets/{$ticketId}")
            ->assertOk()
            ->assertJsonPath('data.ticket.id', $ticketId)
            ->assertJsonStructure(['data' => ['office', 'people_ahead', 'can_cancel']]);
    }
}
