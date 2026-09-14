<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\Building;
use App\Models\CampusEvent;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Floor;
use App\Models\NavigationEdge;
use App\Models\NavigationNode;
use App\Models\Office;
use App\Models\OfficeServiceWindow;
use App\Models\QrNode;
use App\Models\Room;
use App\Models\RoomQueue;
use App\Models\Term;
use App\Models\TimetableEntry;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        // 1. Users
        $admin = User::updateOrCreate(
            ['email' => 'admin@campusflow.edu'],
            [
                'name' => 'System Administrator',
                'password' => Hash::make('password123'),
                'role' => 'admin',
                'department' => 'IT Operations',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $staff = User::updateOrCreate(
            ['email' => 'staff@campusflow.edu'],
            [
                'name' => 'Dr. Jane Smith',
                'password' => Hash::make('password123'),
                'role' => 'staff',
                'staff_id' => 'STF-9901',
                'department' => 'Computer Science',
                'phone' => '+15550199',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $student = User::updateOrCreate(
            ['email' => 'student@campusflow.edu'],
            [
                'name' => 'Alex Rivera',
                'password' => Hash::make('password123'),
                'role' => 'student',
                'student_id' => 'CS-2026-042',
                'program' => 'B.S. Computer Science',
                'year_level' => 3,
                'phone' => '+15550142',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $visitor = User::updateOrCreate(
            ['email' => 'visitor@campusflow.edu'],
            [
                'name' => 'Guest Visitor',
                'password' => Hash::make('password123'),
                'role' => 'visitor',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        // 2. Spatial Infrastructure
        $stb = Building::create([
            'code'        => 'STB',
            'name'        => 'Science & Technology Building',
            'short_name'  => 'SciTech',
            'lat'         => 37.774929,
            'lng'         => -122.419416,
            'description' => 'Main engineering labs, computer science department, and interactive lecture centers.',
            'status'      => 'active',
        ]);

        $sub = Building::create([
            'code'        => 'SUB',
            'name'        => 'Student Union Building',
            'short_name'  => 'StudentUnion',
            'lat'         => 37.775200,
            'lng'         => -122.418800,
            'description' => 'Administrative services, registrar office, financial aid, food court, and student lounge.',
            'status'      => 'active',
        ]);

        // Floors for STB
        $stbF1 = Floor::create([
            'building_id' => $stb->id,
            'code'        => 'F1',
            'name'        => 'First Floor — Computer Science Labs',
            'level'       => 1,
            'status'      => 'active',
        ]);

        $stbF2 = Floor::create([
            'building_id' => $stb->id,
            'code'        => 'F2',
            'name'        => 'Second Floor — Lecture Halls',
            'level'       => 2,
            'status'      => 'active',
        ]);

        // Floors for SUB
        $subF1 = Floor::create([
            'building_id' => $sub->id,
            'code'        => 'F1',
            'name'        => 'First Floor — Student Services Plaza',
            'level'       => 1,
            'status'      => 'active',
        ]);

        // Rooms in STB Floor 1
        $lab101 = Room::create([
            'floor_id'           => $stbF1->id,
            'code'               => 'STB-101',
            'name'               => 'Advanced AI & Robotics Lab',
            'type'               => 'lab',
            'capacity'           => 40,
            'status'             => 'available',
            'requires_admission' => true,
            'features'           => ['GPUs', 'Smartboard', 'VR Stations', 'Power Pods'],
        ]);

        $lab102 = Room::create([
            'floor_id'           => $stbF1->id,
            'code'               => 'STB-102',
            'name'               => 'Software Engineering Studio',
            'type'               => 'lab',
            'capacity'           => 30,
            'status'             => 'available',
            'requires_admission' => false,
            'features'           => ['Dual Monitors', 'Whiteboards', 'Agile Pods'],
        ]);

        // Rooms in STB Floor 2
        $hall201 = Room::create([
            'floor_id'           => $stbF2->id,
            'code'               => 'STB-201',
            'name'               => 'Turing Memorial Auditorium',
            'type'               => 'hall',
            'capacity'           => 150,
            'status'             => 'available',
            'requires_admission' => false,
            'features'           => ['Tiered Seating', 'Live Streaming', 'Mic Array'],
        ]);

        // Room Queue for Lab 101
        $queue101 = RoomQueue::create([
            'room_id'             => $lab101->id,
            'is_open'              => true,
            'capacity'            => 40,
            'max_capacity'        => 40,
            'current_count'        => 0,
            'call_window_minutes' => 10,
            'proximity_radius_m'  => 50.0,
            'mode'                => 'fifo',
            'welcome_message'     => 'Welcome to AI Lab 101. Please join queue and wait for your call number.',
        ]);

        // 3. QR Positioning Anchors
        QrNode::create([
            'building_id' => $stb->id,
            'floor_id'    => $stbF1->id,
            'code'        => 'QR-STB-F1-MAIN',
            'label'       => 'STB Floor 1 Main Entrance Anchor',
            'plan_x'      => 10.0,
            'plan_y'      => 5.0,
            'type'        => 'room_entry',
            'is_active'   => true,
        ]);

        QrNode::create([
            'building_id' => $stb->id,
            'floor_id'    => $stbF1->id,
            'room_id'     => $lab101->id,
            'code'        => 'QR-STB-F1-LAB101',
            'label'       => 'Outside Lab 101 Entrance',
            'plan_x'      => 25.0,
            'plan_y'      => 15.0,
            'type'        => 'room_entry',
            'is_active'   => true,
        ]);

        // 4. Navigation Graph (Nodes & Edges)
        $nodeEntrance = NavigationNode::create([
            'building_id'  => $stb->id,
            'floor_id'     => $stbF1->id,
            'label'        => 'Main Entrance lobby',
            'type'         => 'exit',
            'plan_x'       => 10.0,
            'plan_y'       => 5.0,
            'is_accessible'=> true,
        ]);

        $nodeHallway1 = NavigationNode::create([
            'building_id'  => $stb->id,
            'floor_id'     => $stbF1->id,
            'label'        => 'West Hallway Junction',
            'type'         => 'waypoint',
            'plan_x'       => 20.0,
            'plan_y'       => 5.0,
            'is_accessible'=> true,
        ]);

        $nodeLab101 = NavigationNode::create([
            'building_id'  => $stb->id,
            'floor_id'     => $stbF1->id,
            'room_id'      => $lab101->id,
            'label'        => 'Doorway to Lab 101',
            'type'         => 'room_entry',
            'plan_x'       => 25.0,
            'plan_y'       => 15.0,
            'is_accessible'=> true,
        ]);

        // Edge between Entrance and Hallway
        NavigationEdge::create([
            'from_node_id' => $nodeEntrance->id,
            'to_node_id'   => $nodeHallway1->id,
            'weight'       => 10.0,
            'bidirectional'=> true,
            'accessible'   => true,
            'edge_type'    => 'corridor',
        ]);

        // Edge between Hallway and Lab 101
        NavigationEdge::create([
            'from_node_id' => $nodeHallway1->id,
            'to_node_id'   => $nodeLab101->id,
            'weight'       => 11.2,
            'bidirectional'=> true,
            'accessible'   => true,
            'edge_type'    => 'corridor',
        ]);

        // 5. Administrative Offices
        $registrar = Office::create([
            'code'               => 'REG',
            'name'               => 'Office of the Registrar',
            'description'        => 'Transcripts, course registration, student record verifications, and graduation services.',
            'status'             => 'active',
            'is_open'            => true,
            'avg_service_minutes'=> 8,
            'opening_hours'      => 'Mon-Fri 08:00 - 17:00',
        ]);

        $finAid = Office::create([
            'code'               => 'FIN',
            'name'               => 'Student Financial Aid Office',
            'description'        => 'Scholarships, student loans, tuition payments, and financial advising.',
            'status'             => 'active',
            'is_open'            => true,
            'avg_service_minutes'=> 12,
            'opening_hours'      => 'Mon-Fri 09:00 - 16:30',
        ]);

        // Service Windows
        OfficeServiceWindow::create([
            'office_id' => $registrar->id,
            'name'      => 'Transcripts & Diplomas (Window 1)',
            'status'    => 'active',
        ]);

        OfficeServiceWindow::create([
            'office_id' => $registrar->id,
            'name'      => 'Registration & Enrollment (Window 2)',
            'status'    => 'active',
        ]);

        OfficeServiceWindow::create([
            'office_id' => $finAid->id,
            'name'      => 'General Counseling (Window 1)',
            'status'    => 'active',
        ]);

        // 6. Academic Terms & Courses
        $termFall = Term::create([
            'code'       => '2026-FALL',
            'name'       => 'Fall Semester 2026',
            'starts_at'  => '2026-09-01',
            'ends_at'    => '2026-12-20',
            'is_current' => true,
        ]);

        $cs101 = Course::create([
            'code'        => 'CS-101',
            'name'        => 'Introduction to Computer Science & Algorithms',
            'description' => 'Fundamental principles of programming, algorithm analysis, and problem-solving techniques.',
            'credits'     => 4,
            'department'  => 'Computer Science',
        ]);

        $cs305 = Course::create([
            'code'        => 'CS-305',
            'name'        => 'Advanced Artificial Intelligence',
            'description' => 'Neural networks, machine learning paradigms, probabilistic reasoning, and multi-agent systems.',
            'credits'     => 4,
            'department'  => 'Computer Science',
        ]);

        // Student Enrollment
        Enrollment::create([
            'student_id' => $student->id,
            'course_id'  => $cs305->id,
            'term_code'  => $termFall->code,
            'status'     => 'enrolled',
        ]);

        // Timetable Entries
        TimetableEntry::create([
            'course_id'      => $cs305->id,
            'term_code'      => $termFall->code,
            'lecturer_id'    => $staff->id,
            'room_id'        => $lab101->id,
            'day_of_week'    => 1, // Monday
            'starts_at'      => '10:00:00',
            'ends_at'        => '11:30:00',
            'type'           => 'lecture',
            'effective_from' => '2026-09-01',
        ]);

        TimetableEntry::create([
            'course_id'      => $cs305->id,
            'term_code'      => $termFall->code,
            'lecturer_id'    => $staff->id,
            'room_id'        => $lab101->id,
            'day_of_week'    => 3, // Wednesday
            'starts_at'      => '10:00:00',
            'ends_at'        => '11:30:00',
            'type'           => 'lab',
            'effective_from' => '2026-09-01',
        ]);

        // 7. Campus Events & Announcements
        CampusEvent::create([
            'title'       => 'Campus Annual AI & Innovation Hackathon 2026',
            'description' => '36-hour hackathon bringing together students, faculty, and industry leaders to build smart campus solutions.',
            'category'    => 'hackathon',
            'room_id'     => $hall201->id,
            'created_by'  => $staff->id,
            'starts_at'   => now()->addDays(5)->setHour(9)->setMinute(0),
            'ends_at'     => now()->addDays(6)->setHour(21)->setMinute(0),
            'capacity'    => 120,
            'status'      => 'published',
        ]);

        Announcement::create([
            'title'        => 'Welcome to CampusFlow Fall 2026!',
            'body'         => 'Experience smart indoor navigation, live queue tracking for labs and student offices, and interactive timetables on CampusFlow.',
            'priority'     => 'high',
            'created_by'   => $admin->id,
            'published_at' => now(),
        ]);

        // System Settings
        DB::table('settings')->insertOrIgnore([
            ['key' => 'system_name', 'value' => json_encode('CampusFlow Platform'), 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'campus_location', 'value' => json_encode('Main Campus - San Francisco'), 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'queue_auto_expire_mins', 'value' => json_encode(10), 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
