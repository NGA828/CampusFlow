<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AcademicTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_student_can_fetch_timetable(): void
    {
        $student = User::where('role', 'student')->first();

        $response = $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/academic/timetable');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_can_list_courses(): void
    {
        $response = $this->getJson('/api/v1/academic/courses');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }
}
