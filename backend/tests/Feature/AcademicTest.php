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
            ->getJson('/api/v1/student/timetable');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_can_list_courses(): void
    {
        // The catalogue is a resident read: a course list is campus truth, and it is mounted under
        // `/campus` for every signed-in role rather than under a student path.
        $response = $this->actingAs(User::where('role', 'student')->firstOrFail(), 'sanctum')
            ->getJson('/api/v1/campus/academic/courses');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }
}
