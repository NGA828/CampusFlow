<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Term;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AcademicController extends Controller
{
    /**
     * GET /campus/courses — the course catalogue with its scheduled meetings.
     *
     * This is reference data, not anybody's personal schedule. The catalogue says which rooms a course
     * uses and when; "when do *I* have class" is answered by the role workspace that owns the principal
     * (student, staff, admin all read the same rows through different scopes).
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

    // enroll() moved to AdminController::createEnrollment — a student may never enrol themselves,
    // and there is no other role that should. See POST /admin/enrollments.
}
