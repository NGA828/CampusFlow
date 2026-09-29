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
        // Truncate non-user tables so the seeder can re-run safely without migrate:fresh.
        // CASCADE handles FK ordering in PostgreSQL.
        DB::statement('TRUNCATE TABLE announcements, campus_events, timetable_entries, enrollments, courses, terms, office_service_windows, office_tickets, offices, queue_tickets, room_queues, navigation_edges, navigation_nodes, qr_nodes, rooms, floors, buildings, settings CASCADE');

        // 1. Core Users
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

        // 2. Spatial Infrastructure — 7 Campus Buildings
        $stb = Building::create(['code' => 'STB', 'name' => 'Science & Technology Building', 'short_name' => 'SciTech', 'lat' => 37.774929, 'lng' => -122.419416, 'description' => 'Main engineering labs, CS department, and lecture halls.', 'status' => 'active']);
        $sub = Building::create(['code' => 'SUB', 'name' => 'Student Union Building', 'short_name' => 'StudentUnion', 'lat' => 37.775200, 'lng' => -122.418800, 'description' => 'Administrative offices, registrar, financial aid, and food court.', 'status' => 'active']);
        $lib = Building::create(['code' => 'LIB', 'name' => 'University Library & Learning Commons', 'short_name' => 'Library', 'lat' => 37.775600, 'lng' => -122.419100, 'description' => 'Study halls, digital archives, and technology help desk.', 'status' => 'active']);
        $eng = Building::create(['code' => 'ENG', 'name' => 'Engineering & Applied Sciences Complex', 'short_name' => 'Engineering', 'lat' => 37.774400, 'lng' => -122.420100, 'description' => '3D printing workshops, robotics lab, and circuits studios.', 'status' => 'active']);
        $bus = Building::create(['code' => 'BUS', 'name' => 'School of Business & Management', 'short_name' => 'Business', 'lat' => 37.776100, 'lng' => -122.418300, 'description' => 'Executive lecture halls, trading floor lab, and startup incubator.', 'status' => 'active']);
        $sac = Building::create(['code' => 'SAC', 'name' => 'Student Athletics & Recreation Center', 'short_name' => 'Athletics', 'lat' => 37.774100, 'lng' => -122.418100, 'description' => 'Main gym, fitness center, and athletic offices.', 'status' => 'active']);
        $adm = Building::create(['code' => 'ADM', 'name' => 'University Administration & Admissions', 'short_name' => 'AdminBlock', 'lat' => 37.776400, 'lng' => -122.419700, 'description' => 'Admissions welcome center, bursar desk, and administration.', 'status' => 'active']);

        // 3. Floors
        $stbF1 = Floor::create(['building_id' => $stb->id, 'code' => 'F1', 'name' => 'First Floor — CS & Robotics Labs', 'level' => 1, 'status' => 'active', 'plan_width_m' => 40.0, 'plan_height_m' => 30.0]);
        $stbF2 = Floor::create(['building_id' => $stb->id, 'code' => 'F2', 'name' => 'Second Floor — Lecture Halls', 'level' => 2, 'status' => 'active', 'plan_width_m' => 40.0, 'plan_height_m' => 30.0]);

        $subF1 = Floor::create(['building_id' => $sub->id, 'code' => 'F1', 'name' => 'First Floor — Student Services Plaza', 'level' => 1, 'status' => 'active', 'plan_width_m' => 40.0, 'plan_height_m' => 30.0]);
        $libF1 = Floor::create(['building_id' => $lib->id, 'code' => 'F1', 'name' => 'First Floor — Learning Commons & Tech Help', 'level' => 1, 'status' => 'active', 'plan_width_m' => 40.0, 'plan_height_m' => 30.0]);
        $libF2 = Floor::create(['building_id' => $lib->id, 'code' => 'F2', 'name' => 'Second Floor — Quiet Research Study Rooms', 'level' => 2, 'status' => 'active', 'plan_width_m' => 40.0, 'plan_height_m' => 30.0]);
        $engF1 = Floor::create(['building_id' => $eng->id, 'code' => 'F1', 'name' => 'First Floor — Fabrication & Circuit Labs', 'level' => 1, 'status' => 'active', 'plan_width_m' => 40.0, 'plan_height_m' => 30.0]);
        $busF1 = Floor::create(['building_id' => $bus->id, 'code' => 'F1', 'name' => 'First Floor — Trading Floor & Executive Amphitheater', 'level' => 1, 'status' => 'active', 'plan_width_m' => 40.0, 'plan_height_m' => 30.0]);
        $sacF1 = Floor::create(['building_id' => $sac->id, 'code' => 'F1', 'name' => 'First Floor — Arena & Fitness Complex', 'level' => 1, 'status' => 'active', 'plan_width_m' => 40.0, 'plan_height_m' => 30.0]);
        $admF1 = Floor::create(['building_id' => $adm->id, 'code' => 'F1', 'name' => 'First Floor — Admissions & Bursar Services', 'level' => 1, 'status' => 'active', 'plan_width_m' => 40.0, 'plan_height_m' => 30.0]);

        // 4. Rooms (plan_x/plan_y position the room dot on the floor plan SVG)
        $lab101  = Room::create(['floor_id' => $stbF1->id, 'code' => 'STB-101', 'name' => 'Advanced AI & Robotics Lab', 'type' => 'lab', 'capacity' => 40, 'status' => 'available', 'requires_admission' => true, 'plan_x' => 4.0, 'plan_y' => 6.0, 'features' => ['GPUs', 'Smartboard', 'VR Stations']]);
        $lab102  = Room::create(['floor_id' => $stbF1->id, 'code' => 'STB-102', 'name' => 'Software Engineering Studio', 'type' => 'lab', 'capacity' => 30, 'status' => 'available', 'requires_admission' => false, 'plan_x' => 22.0, 'plan_y' => 6.0, 'features' => ['Dual Monitors', 'Whiteboards']]);
        $hall201 = Room::create(['floor_id' => $stbF2->id, 'code' => 'STB-201', 'name' => 'Turing Memorial Auditorium', 'type' => 'auditorium', 'capacity' => 150, 'status' => 'available', 'requires_admission' => false, 'plan_x' => 6.0, 'plan_y' => 5.0, 'features' => ['Tiered Seating', 'Live Streaming']]);

        $sub101  = Room::create(['floor_id' => $subF1->id, 'code' => 'SUB-101', 'name' => 'Registrar & Student Services Desk', 'type' => 'office', 'capacity' => 25, 'status' => 'available', 'requires_admission' => true, 'plan_x' => 4.0, 'plan_y' => 5.0, 'features' => ['Ticket Kiosk', 'Waiting Lounge']]);
        $sub102  = Room::create(['floor_id' => $subF1->id, 'code' => 'SUB-102', 'name' => 'Financial Aid Counseling Lounge', 'type' => 'office', 'capacity' => 20, 'status' => 'available', 'requires_admission' => true, 'plan_x' => 22.0, 'plan_y' => 5.0, 'features' => ['Private Booths']]);

        $lib101  = Room::create(['floor_id' => $libF1->id, 'code' => 'LIB-101', 'name' => 'Digital Commons & IT Desk', 'type' => 'library', 'capacity' => 50, 'status' => 'available', 'requires_admission' => false, 'plan_x' => 4.0, 'plan_y' => 4.0, 'features' => ['Print Station', 'Mac Workstations']]);
        $lib201  = Room::create(['floor_id' => $libF2->id, 'code' => 'LIB-201', 'name' => 'Research Pod A', 'type' => 'study', 'capacity' => 12, 'status' => 'available', 'requires_admission' => true, 'plan_x' => 5.0, 'plan_y' => 5.0, 'features' => ['Projector', 'Quiet Zone']]);

        $eng101  = Room::create(['floor_id' => $engF1->id, 'code' => 'ENG-101', 'name' => 'Rapid Prototyping Workshop', 'type' => 'lab', 'capacity' => 25, 'status' => 'available', 'requires_admission' => true, 'plan_x' => 5.0, 'plan_y' => 5.0, 'features' => ['3D Printers', 'Laser Cutters']]);
        $bus101  = Room::create(['floor_id' => $busF1->id, 'code' => 'BUS-101', 'name' => 'Bloomberg Trading Floor Lab', 'type' => 'lecture', 'capacity' => 45, 'status' => 'available', 'requires_admission' => false, 'plan_x' => 4.0, 'plan_y' => 4.0, 'features' => ['Ticker Display', 'Bloomberg Terminals']]);
        $sac101  = Room::create(['floor_id' => $sacF1->id, 'code' => 'SAC-101', 'name' => 'Main Athletics Gymnasium', 'type' => 'auditorium', 'capacity' => 300, 'status' => 'available', 'requires_admission' => false, 'plan_x' => 4.0, 'plan_y' => 4.0, 'features' => ['Bleachers', 'Scoreboard']]);
        $adm101  = Room::create(['floor_id' => $admF1->id, 'code' => 'ADM-101', 'name' => 'Admissions Welcome Hall', 'type' => 'office', 'capacity' => 40, 'status' => 'available', 'requires_admission' => true, 'plan_x' => 4.0, 'plan_y' => 4.0, 'features' => ['Info Kiosk', 'Reception']]);
        $adm102  = Room::create(['floor_id' => $admF1->id, 'code' => 'ADM-102', 'name' => 'Bursar Cashier Counter', 'type' => 'office', 'capacity' => 15, 'status' => 'available', 'requires_admission' => true, 'plan_x' => 22.0, 'plan_y' => 4.0, 'features' => ['Payment Window']]);

        // 5. Queues
        RoomQueue::create(['room_id' => $lab101->id, 'is_open' => true, 'capacity' => 40, 'max_capacity' => 40, 'current_count' => 0, 'call_window_minutes' => 10, 'proximity_radius_m' => 50.0, 'mode' => 'fifo', 'welcome_message' => 'Welcome to AI Lab 101. Join queue for your lab station.']);
        RoomQueue::create(['room_id' => $lib201->id, 'is_open' => true, 'capacity' => 12, 'max_capacity' => 12, 'current_count' => 0, 'call_window_minutes' => 15, 'proximity_radius_m' => 30.0, 'mode' => 'fifo', 'welcome_message' => 'Quiet Research Pod A. Please wait for desk assignment.']);
        RoomQueue::create(['room_id' => $eng101->id, 'is_open' => true, 'capacity' => 25, 'max_capacity' => 25, 'current_count' => 0, 'call_window_minutes' => 10, 'proximity_radius_m' => 40.0, 'mode' => 'fifo', 'welcome_message' => '3D Print Workshop Queue. Ensure design files are prepared.']);

        // 6. QR Anchors across buildings
        $qrStbMain = QrNode::create(['building_id' => $stb->id, 'floor_id' => $stbF1->id, 'code' => 'QR-STB-F1-MAIN', 'label' => 'STB Main Entrance Anchor', 'plan_x' => 10.0, 'plan_y' => 5.0, 'type' => 'room_entry', 'is_active' => true]);
        $qrStbLab  = QrNode::create(['building_id' => $stb->id, 'floor_id' => $stbF1->id, 'room_id' => $lab101->id, 'code' => 'QR-STB-F1-LAB101', 'label' => 'Outside Lab 101 Entrance', 'plan_x' => 25.0, 'plan_y' => 15.0, 'type' => 'room_entry', 'is_active' => true]);

        $qrSubMain = QrNode::create(['building_id' => $sub->id, 'floor_id' => $subF1->id, 'code' => 'QR-SUB-F1-MAIN', 'label' => 'Student Union Main Plaza Entry', 'plan_x' => 8.0, 'plan_y' => 4.0, 'type' => 'room_entry', 'is_active' => true]);
        $qrLibMain = QrNode::create(['building_id' => $lib->id, 'floor_id' => $libF1->id, 'code' => 'QR-LIB-F1-MAIN', 'label' => 'Library Main Lobby Anchor', 'plan_x' => 12.0, 'plan_y' => 6.0, 'type' => 'room_entry', 'is_active' => true]);
        $qrEngMain = QrNode::create(['building_id' => $eng->id, 'floor_id' => $engF1->id, 'code' => 'QR-ENG-F1-MAIN', 'label' => 'Engineering Workshop Entrance', 'plan_x' => 15.0, 'plan_y' => 8.0, 'type' => 'room_entry', 'is_active' => true]);
        $qrBusMain = QrNode::create(['building_id' => $bus->id, 'floor_id' => $busF1->id, 'code' => 'QR-BUS-F1-MAIN', 'label' => 'Business School Lobby Anchor', 'plan_x' => 10.0, 'plan_y' => 5.0, 'type' => 'room_entry', 'is_active' => true]);
        $qrSacMain = QrNode::create(['building_id' => $sac->id, 'floor_id' => $sacF1->id, 'code' => 'QR-SAC-F1-MAIN', 'label' => 'Athletics Center Front Desk', 'plan_x' => 14.0, 'plan_y' => 7.0, 'type' => 'room_entry', 'is_active' => true]);
        $qrAdmMain = QrNode::create(['building_id' => $adm->id, 'floor_id' => $admF1->id, 'code' => 'QR-ADM-F1-MAIN', 'label' => 'Admissions Welcome Desk', 'plan_x' => 9.0, 'plan_y' => 4.5, 'type' => 'room_entry', 'is_active' => true]);

        // 7. Navigation Graph — Outdoor Central Campus Quad & Building Entrances
        $hubPlaza = NavigationNode::create([
            'label' => 'Campus Central Quad & Clocktower Plaza', 'type' => 'waypoint', 'lat' => 37.775000, 'lng' => -122.419000, 'plan_x' => 50.0, 'plan_y' => 50.0, 'is_accessible' => true, 'is_active' => true
        ]);

        $nStbOut = NavigationNode::create(['building_id' => $stb->id, 'floor_id' => $stbF1->id, 'label' => 'STB Main Entrance Plaza', 'type' => 'exit', 'lat' => 37.774929, 'lng' => -122.419416, 'plan_x' => 10.0, 'plan_y' => 5.0, 'is_accessible' => true, 'qr_node_id' => $qrStbMain->id]);
        $nSubOut = NavigationNode::create(['building_id' => $sub->id, 'floor_id' => $subF1->id, 'label' => 'SUB Main Entrance Plaza', 'type' => 'exit', 'lat' => 37.775200, 'lng' => -122.418800, 'plan_x' => 8.0, 'plan_y' => 4.0, 'is_accessible' => true, 'qr_node_id' => $qrSubMain->id]);
        $nLibOut = NavigationNode::create(['building_id' => $lib->id, 'floor_id' => $libF1->id, 'label' => 'Library Main Entrance Ramp', 'type' => 'exit', 'lat' => 37.775600, 'lng' => -122.419100, 'plan_x' => 12.0, 'plan_y' => 6.0, 'is_accessible' => true, 'qr_node_id' => $qrLibMain->id]);
        $nEngOut = NavigationNode::create(['building_id' => $eng->id, 'floor_id' => $engF1->id, 'label' => 'Engineering Complex Courtyard', 'type' => 'exit', 'lat' => 37.774400, 'lng' => -122.420100, 'plan_x' => 15.0, 'plan_y' => 8.0, 'is_accessible' => true, 'qr_node_id' => $qrEngMain->id]);
        $nBusOut = NavigationNode::create(['building_id' => $bus->id, 'floor_id' => $busF1->id, 'label' => 'Business School Atrium Entrance', 'type' => 'exit', 'lat' => 37.776100, 'lng' => -122.418300, 'plan_x' => 10.0, 'plan_y' => 5.0, 'is_accessible' => true, 'qr_node_id' => $qrBusMain->id]);
        $nSacOut = NavigationNode::create(['building_id' => $sac->id, 'floor_id' => $sacF1->id, 'label' => 'Athletics Center Front Concourse', 'type' => 'exit', 'lat' => 37.774100, 'lng' => -122.418100, 'plan_x' => 14.0, 'plan_y' => 7.0, 'is_accessible' => true, 'qr_node_id' => $qrSacMain->id]);
        $nAdmOut = NavigationNode::create(['building_id' => $adm->id, 'floor_id' => $admF1->id, 'label' => 'Admin Building Portico', 'type' => 'exit', 'lat' => 37.776400, 'lng' => -122.419700, 'plan_x' => 9.0, 'plan_y' => 4.5, 'is_accessible' => true, 'qr_node_id' => $qrAdmMain->id]);

        $nStbLab101 = NavigationNode::create(['building_id' => $stb->id, 'floor_id' => $stbF1->id, 'room_id' => $lab101->id, 'label' => 'Doorway to AI Lab 101', 'type' => 'room_entry', 'plan_x' => 11.0, 'plan_y' => 11.0, 'is_accessible' => true, 'qr_node_id' => $qrStbLab->id]);
        $nSub101    = NavigationNode::create(['building_id' => $sub->id, 'floor_id' => $subF1->id, 'room_id' => $sub101->id, 'label' => 'Registrar Counter Entry', 'type' => 'room_entry', 'plan_x' => 11.0, 'plan_y' => 10.0, 'is_accessible' => true]);
        $nLib101    = NavigationNode::create(['building_id' => $lib->id, 'floor_id' => $libF1->id, 'room_id' => $lib101->id, 'label' => 'Library Tech Desk Entry', 'type' => 'room_entry', 'plan_x' => 13.0, 'plan_y' => 10.0, 'is_accessible' => true]);
        $nEng101    = NavigationNode::create(['building_id' => $eng->id, 'floor_id' => $engF1->id, 'room_id' => $eng101->id, 'label' => '3D Print Workshop Doorway', 'type' => 'room_entry', 'plan_x' => 13.0, 'plan_y' => 10.0, 'is_accessible' => true]);
        $nBus101    = NavigationNode::create(['building_id' => $bus->id, 'floor_id' => $busF1->id, 'room_id' => $bus101->id, 'label' => 'Trading Lab Doorway', 'type' => 'room_entry', 'plan_x' => 12.0, 'plan_y' => 9.0, 'is_accessible' => true]);
        $nSac101    = NavigationNode::create(['building_id' => $sac->id, 'floor_id' => $sacF1->id, 'room_id' => $sac101->id, 'label' => 'Gymnasium Entry Portal', 'type' => 'room_entry', 'plan_x' => 19.0, 'plan_y' => 14.0, 'is_accessible' => true]);
        $nAdm101    = NavigationNode::create(['building_id' => $adm->id, 'floor_id' => $admF1->id, 'room_id' => $adm101->id, 'label' => 'Admissions Counter Portal', 'type' => 'room_entry', 'plan_x' => 11.0, 'plan_y' => 9.0, 'is_accessible' => true]);

        // Indoor Corridor Junction Nodes
        $nStbCorr = NavigationNode::create(['building_id' => $stb->id, 'floor_id' => $stbF1->id, 'label' => 'STB Main Concourse Corridor', 'type' => 'junction', 'plan_x' => 10.0, 'plan_y' => 11.0, 'is_accessible' => true]);
        $nSubCorr = NavigationNode::create(['building_id' => $sub->id, 'floor_id' => $subF1->id, 'label' => 'SUB Atrium Central Hallway', 'type' => 'junction', 'plan_x' => 8.0, 'plan_y' => 10.0, 'is_accessible' => true]);
        $nLibCorr = NavigationNode::create(['building_id' => $lib->id, 'floor_id' => $libF1->id, 'label' => 'Library Main Foyer Junction', 'type' => 'junction', 'plan_x' => 12.0, 'plan_y' => 10.0, 'is_accessible' => true]);
        $nEngCorr = NavigationNode::create(['building_id' => $eng->id, 'floor_id' => $engF1->id, 'label' => 'Engineering Hallway Corridor', 'type' => 'junction', 'plan_x' => 15.0, 'plan_y' => 10.0, 'is_accessible' => true]);
        $nBusCorr = NavigationNode::create(['building_id' => $bus->id, 'floor_id' => $busF1->id, 'label' => 'Business Executive Hallway', 'type' => 'junction', 'plan_x' => 10.0, 'plan_y' => 9.0, 'is_accessible' => true]);
        $nSacCorr = NavigationNode::create(['building_id' => $sac->id, 'floor_id' => $sacF1->id, 'label' => 'Sports Complex Concourse Corridor', 'type' => 'junction', 'plan_x' => 14.0, 'plan_y' => 14.0, 'is_accessible' => true]);
        $nAdmCorr = NavigationNode::create(['building_id' => $adm->id, 'floor_id' => $admF1->id, 'label' => 'Admissions Welcome Hall Corridor', 'type' => 'junction', 'plan_x' => 9.0, 'plan_y' => 9.0, 'is_accessible' => true]);

        // Connect Central Plaza Hub to Building Entrances
        $outdoorNodes = [$nStbOut, $nSubOut, $nLibOut, $nEngOut, $nBusOut, $nSacOut, $nAdmOut];
        foreach ($outdoorNodes as $index => $node) {
            NavigationEdge::create(['from_node_id' => $hubPlaza->id, 'to_node_id' => $node->id, 'weight' => 25.0 + ($index * 6.0), 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);
        }

        // Direct Outdoor Pathways between nearby buildings
        NavigationEdge::create(['from_node_id' => $nStbOut->id, 'to_node_id' => $nEngOut->id, 'weight' => 35.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);
        NavigationEdge::create(['from_node_id' => $nStbOut->id, 'to_node_id' => $nLibOut->id, 'weight' => 40.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);
        NavigationEdge::create(['from_node_id' => $nSubOut->id, 'to_node_id' => $nSacOut->id, 'weight' => 30.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);
        NavigationEdge::create(['from_node_id' => $nSubOut->id, 'to_node_id' => $nBusOut->id, 'weight' => 45.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);
        NavigationEdge::create(['from_node_id' => $nLibOut->id, 'to_node_id' => $nAdmOut->id, 'weight' => 38.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);

        // Indoor Edges via Hallway Corridors
        NavigationEdge::create(['from_node_id' => $nStbOut->id, 'to_node_id' => $nStbCorr->id, 'weight' => 6.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);
        NavigationEdge::create(['from_node_id' => $nStbCorr->id, 'to_node_id' => $nStbLab101->id, 'weight' => 2.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);

        NavigationEdge::create(['from_node_id' => $nSubOut->id, 'to_node_id' => $nSubCorr->id, 'weight' => 6.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);
        NavigationEdge::create(['from_node_id' => $nSubCorr->id, 'to_node_id' => $nSub101->id, 'weight' => 3.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);

        NavigationEdge::create(['from_node_id' => $nLibOut->id, 'to_node_id' => $nLibCorr->id, 'weight' => 4.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);
        NavigationEdge::create(['from_node_id' => $nLibCorr->id, 'to_node_id' => $nLib101->id, 'weight' => 2.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);

        NavigationEdge::create(['from_node_id' => $nEngOut->id, 'to_node_id' => $nEngCorr->id, 'weight' => 2.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);
        NavigationEdge::create(['from_node_id' => $nEngCorr->id, 'to_node_id' => $nEng101->id, 'weight' => 3.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);

        NavigationEdge::create(['from_node_id' => $nBusOut->id, 'to_node_id' => $nBusCorr->id, 'weight' => 4.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);
        NavigationEdge::create(['from_node_id' => $nBusCorr->id, 'to_node_id' => $nBus101->id, 'weight' => 3.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);

        NavigationEdge::create(['from_node_id' => $nSacOut->id, 'to_node_id' => $nSacCorr->id, 'weight' => 7.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);
        NavigationEdge::create(['from_node_id' => $nSacCorr->id, 'to_node_id' => $nSac101->id, 'weight' => 5.0, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);

        NavigationEdge::create(['from_node_id' => $nAdmOut->id, 'to_node_id' => $nAdmCorr->id, 'weight' => 4.5, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);
        NavigationEdge::create(['from_node_id' => $nAdmCorr->id, 'to_node_id' => $nAdm101->id, 'weight' => 2.5, 'bidirectional' => true, 'accessible' => true, 'edge_type' => 'corridor']);

        // 8. Administrative Offices
        $registrar = Office::create(['code' => 'REG', 'name' => 'Office of the Registrar', 'description' => 'Transcripts, enrollment verifications, and graduation services.', 'status' => 'active', 'is_open' => true, 'avg_service_minutes' => 8, 'opening_hours' => 'Mon-Fri 08:00 - 17:00']);
        $finAid    = Office::create(['code' => 'FIN', 'name' => 'Student Financial Aid Office', 'description' => 'Scholarships, grants, student loans, and counseling.', 'status' => 'active', 'is_open' => true, 'avg_service_minutes' => 12, 'opening_hours' => 'Mon-Fri 09:00 - 16:30']);
        $bursar    = Office::create(['code' => 'BUR', 'name' => 'Bursar & Student Accounts Desk', 'description' => 'Tuition payments, fee statements, and refund processing.', 'status' => 'active', 'is_open' => true, 'avg_service_minutes' => 6, 'opening_hours' => 'Mon-Fri 08:30 - 16:00']);
        $itHelp    = Office::create(['code' => 'ITH', 'name' => 'Campus IT Service Desk', 'description' => 'Student account resets, Wi-Fi support, and device loaners.', 'status' => 'active', 'is_open' => true, 'avg_service_minutes' => 10, 'opening_hours' => 'Mon-Sat 08:00 - 20:00']);

        OfficeServiceWindow::create(['office_id' => $registrar->id, 'name' => 'Transcripts & Diplomas (Window 1)', 'status' => 'active']);
        OfficeServiceWindow::create(['office_id' => $registrar->id, 'name' => 'Registration & Add/Drop (Window 2)', 'status' => 'active']);
        OfficeServiceWindow::create(['office_id' => $finAid->id, 'name' => 'General Financial Aid Counseling (Window 1)', 'status' => 'active']);
        OfficeServiceWindow::create(['office_id' => $bursar->id, 'name' => 'Tuition Cashier Counter (Window 1)', 'status' => 'active']);
        OfficeServiceWindow::create(['office_id' => $itHelp->id, 'name' => 'Hardware & Wi-Fi Support Desk (Window 1)', 'status' => 'active']);

        // 9. Academic Terms, Courses & Timetable Entries
        $termFall = Term::create(['code' => '2026-FALL', 'name' => 'Fall Semester 2026', 'starts_at' => '2026-09-01', 'ends_at' => '2026-12-20', 'is_current' => true]);

        $cs101  = Course::create(['code' => 'CS-101', 'name' => 'Intro to Computer Science', 'description' => 'Fundamentals of programming and computational thinking.', 'credits' => 4, 'department' => 'Computer Science']);
        $cs305  = Course::create(['code' => 'CS-305', 'name' => 'Advanced Artificial Intelligence', 'description' => 'Neural networks, probabilistic reasoning, and smart agents.', 'credits' => 4, 'department' => 'Computer Science']);
        $eng201 = Course::create(['code' => 'ENG-201', 'name' => 'Robotics & Automation Systems', 'description' => 'Kinematics, sensors, and microcontroller programming.', 'credits' => 4, 'department' => 'Engineering']);
        $bus110 = Course::create(['code' => 'BUS-110', 'name' => 'Global Finance & Market Analytics', 'description' => 'Financial modeling, trading strategies, and macroeconomics.', 'credits' => 3, 'department' => 'Business']);

        Enrollment::create(['student_id' => $student->id, 'course_id' => $cs305->id, 'term_code' => $termFall->code, 'status' => 'enrolled']);
        Enrollment::create(['student_id' => $student->id, 'course_id' => $eng201->id, 'term_code' => $termFall->code, 'status' => 'enrolled']);
        Enrollment::create(['student_id' => $student->id, 'course_id' => $bus110->id, 'term_code' => $termFall->code, 'status' => 'enrolled']);

        TimetableEntry::create(['course_id' => $cs305->id, 'term_code' => $termFall->code, 'lecturer_id' => $staff->id, 'room_id' => $lab101->id, 'day_of_week' => 1, 'starts_at' => '10:00:00', 'ends_at' => '11:30:00', 'type' => 'lecture', 'effective_from' => '2026-09-01']);
        TimetableEntry::create(['course_id' => $cs305->id, 'term_code' => $termFall->code, 'lecturer_id' => $staff->id, 'room_id' => $lab101->id, 'day_of_week' => 3, 'starts_at' => '10:00:00', 'ends_at' => '11:30:00', 'type' => 'lab', 'effective_from' => '2026-09-01']);
        TimetableEntry::create(['course_id' => $eng201->id, 'term_code' => $termFall->code, 'lecturer_id' => $staff->id, 'room_id' => $eng101->id, 'day_of_week' => 2, 'starts_at' => '14:00:00', 'ends_at' => '16:00:00', 'type' => 'lab', 'effective_from' => '2026-09-01']);
        TimetableEntry::create(['course_id' => $bus110->id, 'term_code' => $termFall->code, 'lecturer_id' => $staff->id, 'room_id' => $bus101->id, 'day_of_week' => 4, 'starts_at' => '09:00:00', 'ends_at' => '10:30:00', 'type' => 'lecture', 'effective_from' => '2026-09-01']);

        // 10. Campus Events & Announcements
        CampusEvent::create([
            'title' => 'Campus Annual AI & Innovation Hackathon 2026', 'description' => '36-hour hackathon bringing together students and industry leaders.', 'category' => 'hackathon', 'room_id' => $hall201->id, 'created_by' => $staff->id, 'starts_at' => now()->addDays(3)->setHour(9)->setMinute(0), 'ends_at' => now()->addDays(4)->setHour(21)->setMinute(0), 'capacity' => 150, 'status' => 'published'
        ]);
        CampusEvent::create([
            'title' => 'Fall Career & Internship Expo', 'description' => 'Meet recruiters from top tech, finance, and engineering firms at the main gym.', 'category' => 'expo', 'room_id' => $sac101->id, 'created_by' => $staff->id, 'starts_at' => now()->addDays(7)->setHour(10)->setMinute(0), 'ends_at' => now()->addDays(7)->setHour(17)->setMinute(0), 'capacity' => 300, 'status' => 'published'
        ]);

        Announcement::create([
            'title' => 'Welcome to CampusFlow Smart Campus Platform!', 'body' => 'Explore live turn-by-turn indoor & outdoor navigation across all 7 campus buildings, queue management, and timetable scheduling.', 'priority' => 'high', 'created_by' => $admin->id, 'published_at' => now()
        ]);

        DB::table('settings')->insertOrIgnore([
            ['key' => 'system_name', 'value' => json_encode('CampusFlow Platform'), 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'campus_location', 'value' => json_encode('Main Campus - San Francisco'), 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'queue_auto_expire_mins', 'value' => json_encode(10), 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
