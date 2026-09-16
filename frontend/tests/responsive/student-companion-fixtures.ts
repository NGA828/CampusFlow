import type { Page } from '@playwright/test';
import { webSession } from './web-visual-fixtures';

/** Wire-shaped presentation/workflow fixtures. Never imported by the application. */
export const conversationId = 'c0ffee00-1234-4234-8234-123456789abc';
export const now = '2026-09-15T10:00:00Z';
export async function companionSession(page: Page, role: 'student' | 'staff' | 'admin' = 'student') {
  await webSession(page, role);
  const user = { id: 'review-user', name: role === 'student' ? 'Amina Yusuf' : role === 'staff' ? 'Daniel Nwosu' : 'Nadia Mensah', email: `${role}@example.test`, role_code: role, role, status: 'active', department: 'Computer Science', phone: '+237 6 00 00 00 00', registration_no: role === 'student' ? 'CF-2026-2048' : null, avatar_url: null, email_verified: true, permissions: ['campus.read', 'queue.join', 'ai.use', ...Array.from({ length: 29 }, (_, i) => `fixture.permission.${i}`)], created_at: '2024-10-02T08:30:00Z' };
  const queue = { id: 'q1', room_id: 'r1', room_code: 'B204', room_name: 'Interaction design studio', building_code: 'B', building_name: 'Science & design', floor_name: 'First floor', is_active: true, admission_capacity: 10, max_capacity: 20, avg_service_seconds: 300, requires_proximity_to_join: true, proximity_radius_m: 50, waiting: 3, serving: 1, my_ticket_id: 't1' as string | null };
  const ticket = { ticket: { id: 't1', queue_id: 'q1', room_id: 'r1', ticket_number: 'B-024', position: 24, status: 'waiting', issued_at: now, called_at: null as string | null }, queue: { ...queue }, people_ahead: 3, eta_seconds: 900, expected_service_at: '2026-09-15T10:15:00Z', check_in_deadline: null as string | null, seconds_until_deadline: null as number | null, can_check_in: false, can_navigate: false, can_cancel: true, counts: { waiting: 3, in_service: 1 } };
  const notifications = [
    { id: 'n1', type: 'queue.called', title: 'Your room ticket has been called', body: 'The campus team is ready at the interaction design studio. Check your ticket for arrival instructions.', data: null, priority: 'high', read_at: null as string | null, created_at: now },
    { id: 'n2', type: 'class.reminder', title: 'Interaction design starts at 11:00', body: 'Your next lecture is in room B204, Science & design. Check your timetable for the published session details.', data: null, priority: 'normal', read_at: null as string | null, created_at: '2026-09-15T09:30:00Z' },
    { id: 'n3', type: 'office.ticket_issued', title: 'Your student affairs request is recorded', body: 'Your office ticket is available in office services. Review the next steps before you visit.', data: null, priority: 'normal', read_at: now as string | null, created_at: '2026-09-14T15:00:00Z' },
    { id: 'n4', type: 'announcement.published', title: 'A new space to study', body: 'The learning centre welcomes students throughout the week. Read the announcement for details.', data: null, priority: 'normal', read_at: now as string | null, created_at: '2026-09-14T08:00:00Z' },
  ];
  const capabilities = { platform: 'web', role, tools: [{ id: 'my_schedule', label: 'Read my timetable', needs: 'timetable.read.own' }, { id: 'locate_room', label: 'Locate a room', needs: 'campus.read' }, { id: 'queue_status', label: 'Room queue status', needs: 'queue.read' }, { id: 'offices', label: 'Office services', needs: 'office.read' }, { id: 'announcements', label: 'Campus announcements', needs: 'campus.read' }, { id: 'campus_overview', label: 'Campus overview', needs: 'campus.read' }], tool_count: 6, total_tools: 11, note: 'Camera scanning and live navigation are not offered from the web client.' };
  const conversation = { id: conversationId, title: 'Planning my campus morning', created_at: now, last_message_at: now, message_count: 2, messages: [{ id: 'm1', role: 'user', content: 'How busy are the room queues?', metadata: { screen: 'student.assistant' }, created_at: now }, { id: 'm2', role: 'assistant', content: 'The interaction design studio has 3 students waiting. Check the queue board before you go; the line can change as the campus team serves students.', metadata: { intent: 'queue_status', authorized: true, platform: 'web', role: 'student', allowed_tools: ['queue_status', 'my_schedule'] }, created_at: now }] };
  const state = { user, assignments: role === 'student' ? [] : [{ id: 'a1', scope_type: 'building', scope_id: 'b1', scope_label: 'Science & design', role_in_scope: 'operator', can_call_tickets: true, can_manage_timetable: false, can_publish_content: false }], active: true, ticket, queues: [queue, { ...queue, id: 'q2', room_id: 'r2', room_code: 'A101', room_name: 'Learning commons', building_code: 'A', building_name: 'Learning centre', floor_name: 'Ground floor', waiting: 1, serving: 2, requires_proximity_to_join: false, my_ticket_id: null }, { ...queue, id: 'q3', room_id: 'r3', room_code: 'C102', room_name: 'Media workshop', building_code: 'C', building_name: 'Creative arts', floor_name: 'Ground floor', is_active: false, waiting: 0, serving: 0, my_ticket_id: null }], notifications, capabilities, conversations: [conversation], requests: [] as { path: string; method: string; body: Record<string, unknown> | null; idempotencyKey?: string }[] };
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v1', ''); const method = request.method();
    const body = method === 'POST' || method === 'PATCH' || method === 'PUT' ? request.postDataJSON() as Record<string, unknown> | null : null;
    state.requests.push({ path, method, body, idempotencyKey: request.headers()['idempotency-key'] });
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === '/me' && method === 'GET') return ok({ user: state.user, assignments: state.assignments });
    if (path === '/me' && method === 'PATCH') { Object.assign(state.user, body); return ok({ user: state.user }); }
    if (path === '/auth/password' && method === 'PUT') return ok({ changed: true });
    if (path === '/auth/logout') return ok({ revoked: true });
    if (path === '/me/notifications') {
      const number = Number(url.searchParams.get('page') ?? 1); const per = Number(url.searchParams.get('per_page') ?? 20);
      return ok({ items: state.notifications.slice((number - 1) * per, number * per), unread: state.notifications.filter(n => !n.read_at).length, meta: { current_page: number, last_page: Math.max(1, Math.ceil(state.notifications.length / per)), total: state.notifications.length, per_page: per } });
    }
    if (path === '/me/notifications/read-all') { state.notifications.forEach(n => { n.read_at = now; }); return ok({ unread: 0 }); }
    if (/\/me\/notifications\/[^/]+\/read$/.test(path)) { const n = state.notifications.find(n => n.id === path.split('/')[3]); if (n) n.read_at = now; return ok({ unread: state.notifications.filter(n => !n.read_at).length }); }
    if (path === '/student/queues/board') return ok({ queues: state.queues, generated_at: now });
    if (path === '/student/queue-tickets/active') return ok({ ticket: state.active ? state.ticket.ticket : null });
    if (/\/student\/queue-tickets\/[^/]+\/history$/.test(path)) return ok({ events: [{ id: 'e1', type: 'joined', created_at: now, metadata: null }] });
    if (path === `/student/queue-tickets/${state.ticket.ticket.id}`) return ok(state.ticket);
    if (/\/student\/queues\/[^/]+\/tickets$/.test(path)) {
      const q = state.queues.find(q => q.id === path.split('/')[3])!;
      state.ticket.queue = { ...q }; state.ticket.ticket = { ...state.ticket.ticket, id: 't2', queue_id: q.id, room_id: q.room_id, ticket_number: 'A-012', status: 'waiting' };
      state.ticket.can_cancel = true; state.ticket.can_check_in = false; state.active = true; q.my_ticket_id = 't2';
      return ok(state.ticket);
    }
    if (/\/student\/queue-tickets\/[^/]+\/(cancel|check-in|navigating)$/.test(path)) {
      const action = path.split('/').at(-1); state.ticket.ticket.status = action === 'cancel' ? 'cancelled' : action === 'check-in' ? 'checked_in' : 'navigating';
      if (action === 'cancel') { state.ticket.can_cancel = false; state.active = false; state.queues.forEach(q => { if (q.id === state.ticket.queue.id) q.my_ticket_id = null; }); }
      return ok(state.ticket);
    }
    if (path === '/ai/capabilities') return ok(state.capabilities);
    if (path === '/ai/conversations') return ok({ conversations: state.conversations });
    if (path.startsWith('/ai/conversations/')) {
      if (method === 'DELETE') { state.conversations = state.conversations.filter(c => c.id !== path.split('/').at(-1)); return ok({ deleted: path.split('/').at(-1) }); }
      return ok({ conversation: state.conversations.find(c => c.id === path.split('/').at(-1)) });
    }
    if (path === '/ai/chat') return ok({ conversation_id: body?.conversation_id ?? conversationId, message: { ...conversation.messages[1], id: `reply-${state.requests.length}` }, suggested_actions: [{ id: 'queues', label: 'Open queue board', href: '/student/queues', kind: 'queue' }], context: { platform: 'web', role } });
    return route.fallback();
  });
  return state;
}
