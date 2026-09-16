import type { Page } from '@playwright/test';

/** Deterministic presentation fixtures. Never bundled into either client. */
export async function mobileSession(page: Page, role: 'student' | 'staff' | 'admin', fail = false) {
  await page.addInitScript(() => localStorage.setItem('campusflow.token', 'visual-review-only'));
  const user = { id: 'review-user', name: role === 'student' ? 'Amina Yusuf' : role === 'staff' ? 'Daniel Nwosu' : 'Nadia Mensah', email: `${role}@example.test`, role_code: role, department: 'Computer Science', permissions: [] };
  const now = '2026-09-15T09:00:00Z';
  const entry = { id: 'session', course_code: 'CS204', course_title: 'Interaction design', starts_at_iso: now, ends_at_iso: '2026-09-15T11:00:00Z', room_code: 'B204', building_code: 'B', lecturer: 'Dr. Okafor', is_next: true, minutes_until: 20 };
  const queues = [{ id: 'queue-one', building_code: 'B', room_code: 'B204', room_name: 'Design studio', floor_name: 'First floor', is_active: true, waiting: 6, serving: 1, avg_service_seconds: 300, requires_proximity_to_join: true, proximity_radius_m: 25, max_capacity: 20, my_ticket_id: 'ticket-one' }];
  const active = { ticket: { id: 'ticket-one', ticket_number: 'B-024', status: 'waiting' }, queue: queues[0], people_ahead: 3, eta_seconds: 900, expected_service_at: '2026-09-15T09:15:00Z', seconds_until_deadline: null, counts: { in_service: 1 }, can_check_in: false, can_cancel: true };
  const buildings = [
    { id: 'b1', code: 'A', name: 'Learning centre', lat: 3.863, lng: 11.512, status: 'operational', floor_count: 3, room_count: 18, has_elevator: true },
    { id: 'b2', code: 'B', name: 'Science & design', lat: 3.864, lng: 11.514, status: 'operational', floor_count: 2, room_count: 12, has_elevator: true },
    { id: 'b3', code: 'C', name: 'Student services', lat: 3.862, lng: 11.515, status: 'maintenance', floor_count: 2, room_count: 8, has_elevator: false },
  ];
  const position = { id: 'pos', source: 'qr', updated_at: now, building_name: 'Science & design', floor_name: 'First floor', plan_x: null, plan_y: null };
  let alerts = [
    { key: 'queue-capacity', severity: 'critical', title: 'A queue needs attention', detail: 'The design studio line is above its configured waiting threshold.', target: '/admin/services' },
    { key: 'anchor-check', severity: 'warning', title: 'An anchor needs verification', detail: 'Review the entrance QR anchor before the next campus session.', target: '/admin/spatial' },
    { key: 'service-note', severity: 'info', title: 'Service schedule updated', detail: 'Check the student services desk schedule in your web console.', target: '/admin/services' },
  ];
  const requests: { path: string; method: string; body: unknown }[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const method = route.request().method();
    requests.push({ path, method, body: route.request().postDataJSON() });
    if (path !== '/me' && fail) return route.fulfill({ status: 503, json: { success: false, message: 'The campus service is temporarily unavailable.' } });
    let data: unknown;
    if (path === '/me') data = { user, assignments: [] };
    else if (path === '/student/dashboard') data = { user, next_class: entry, today: { entries: [entry] }, queue_ticket: active, office_ticket: null, unread_notifications: 2, position, building_alerts: [], announcements: [{ id: 'ann', title: 'A new space to study', body: 'The learning centre welcomes students throughout the week.', is_pinned: true }], events: [] };
    else if (path === '/student/queue-tickets/active') data = { ticket: active };
    else if (path === '/campus/queues') data = { queues };
    else if (path === '/campus/buildings') data = { buildings };
    else if (path === '/campus/buildings/b1') data = { building: buildings[0], floors: [], rooms: [{ id: 'r1', code: 'A101', name: 'Learning studio', building_code: 'A', floor_name: 'Ground floor', capacity: 35, requires_admission: true }] };
    else if (path === '/campus/rooms') data = { items: [{ id: 'r1', code: 'A101', name: 'Learning studio', building_code: 'A', floor_name: 'Ground floor', capacity: 35, requires_admission: true }] };
    else if (path === '/student/positioning/current') data = { position };
    else if (path === '/student/positioning/scan') data = { position };
    else if (path === '/me/notifications') data = { items: [{ id: 'n1', title: 'Your desk assignment', body: 'Student services is ready for your next session.', created_at: now, read_at: null }], unread: 1 };
    else if (path === '/me/notifications/read-all') data = { unread: 0 };
    else if (path === '/staff/dashboard') data = {
      kpis: { waiting_now: 9, served_today: 24, offices_open: 2 },
      queues: [{ ...queues[0], queue_id: 'queue-one', current: { ticket_number: 'B-023', student_name: 'Alex Rivera', status: 'called', check_in_deadline: '2026-09-15T09:10:00Z' } }],
      offices: [{ office_id: 'o1', code: 'SA', name: 'Student affairs', room_code: 'C101', waiting: 3, service_duration_minutes: 10, is_active: true }],
      pending_queue_actions: [{ id: 'ticket-one', ticket_number: 'B-024', student_name: 'Amina Yusuf', room_code: 'B204', status: 'checked_in', check_in_deadline: null }], pending_office_actions: [],
    };
    else if (path.startsWith('/staff/students/')) data = { student: { name: 'Amina Yusuf', registration_no: 'STU-001', program: 'Computer Science', year_level: 2, status: 'active' }, queue_tickets: [], office_tickets: [] };
    else if (path === '/admin/monitoring/summary') data = { generated_at: now, queues: { open: 8, waiting_now: 32, issued_today: 146, served_today: 108, no_show_rate_today: .04 }, offices: { open: 4, waiting_now: 12, completed_today: 37 }, platform: { active_queues: 8, navigation_today: 204, unacknowledged_alerts: 3, users: 1840 } };
    else if (path === '/admin/alerts') data = { alerts, counts: { critical: alerts.filter((a) => a.severity === 'critical').length, warning: 1, acknowledged: 0 }, generated_at: now };
    else if (path === '/admin/alerts/ack') { const { fingerprint } = route.request().postDataJSON(); alerts = alerts.filter((a) => a.key !== fingerprint); data = { acknowledged: fingerprint }; }
    else return route.fulfill({ status: 503, json: { success: false, message: 'Review fixture: this resource is unavailable.' } });
    return route.fulfill({ json: { success: true, data } });
  });
  return requests;
}
