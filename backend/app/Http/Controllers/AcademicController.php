<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Term;
use App\Models\TimetableEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AcademicController extends Controller
{
    /**
     * Get student or instructor timetable.
     */
    public function timetable(Request $request): JsonResponse
    {
        $user = $request->user();
        $termCode = $request->query('term_code');

        if (!$termCode) {
            $activeTerm = Term::where('is_current', true)->first();
            $termCode = $activeTerm ? $activeTerm->code : null;
        }

        $query = TimetableEntry::query()
            ->with(['course', 'room.floor.building', 'lecturer']);

        if ($termCode) {
            $query->where('term_code', $termCode);
        }

        if ($user->role === 'student') {
            $enrolledCourseIds = Enrollment::where('student_id', $user->id)
                ->where('status', 'enrolled')
                ->pluck('course_id');

            $query->whereIn('course_id', $enrolledCourseIds);
        } elseif ($user->role === 'staff') {
            $query->where('lecturer_id', $user->id);
        }

        $entries = $query->orderBy('day_of_week')
            ->orderBy('starts_at')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $entries->map(fn($e) => $e->toApiArray()),
        ]);
    }

    /**
     * Course catalog.
     */
    public function courses(Request $request): JsonResponse
    {
        $courses = Course::with(['timetableEntries.room.floor.building'])
            ->orderBy('code')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $courses,
        ]);
    }

    /**
     * Terms list.
     */
    public function terms(): JsonResponse
    {
        $terms = Term::orderBy('start_date', 'desc')->get();

        return response()->json([
            'success' => true,
            'data'    => $terms,
        ]);
    }

    /**
     * Enroll student into a course.
     */
    public function enroll(Request $request): JsonResponse
    {
        $request->validate([
            'course_id' => 'required|uuid|exists:courses,id',
            'term_code' => 'required|string|exists:terms,code',
        ]);

        $user = $request->user();

        $enrollment = Enrollment::firstOrCreate([
            'student_id' => $user->id,
            'course_id'  => $request->input('course_id'),
            'term_code'  => $request->input('term_code'),
        ], [
            'status'     => 'active',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Successfully enrolled in course',
            'data'    => $enrollment,
        ], 201);
    }
}
