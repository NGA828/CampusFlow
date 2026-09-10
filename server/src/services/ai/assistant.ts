import type { Db } from '../../db/client.js';
import { config } from '../../config.js';
import { ApiError } from '../../lib/errors.js';
import type { Principal } from '../../middleware/auth.js';
import { roleAtLeast } from '../../policies/rbac.js';
import { TOOLS, runTool, toolsForRole, type ToolResult } from './tools.js';

/**
 * AI Campus Assistant (PROMPT §30–§35).
 *
 * Two interchangeable planners:
 *   1. LLM planner — when LLM_API_KEY is configured, the model selects tools through
 *      OpenAI-compatible function calling. It can only choose from the audited tool list
 *      and every call is re-authorised server-side.
 *   2. Deterministic planner — the default. A rule-based intent classifier with entity
 *      extraction drives exactly the same tools, so the assistant is fully functional in
 *      an offline or credential-free environment, and its answers are reproducible.
 *
 * Neither planner touches the database directly, and neither can widen the caller's
 * permissions.
 */

export interface AssistantRequest {
  message: string;
  conversationId?: string;
}

export interface AssistantReply {
  conversation_id: string;
  provider: 'deterministic' | 'llm';
  model: string | null;
  intent: string;
  message: {
    id: string;
    role: 'assistant';
    content: string;
    data: unknown;
    actions: { label: string; href: string; kind?: string }[];
    tool_calls: { name: string; arguments: Record<string, unknown>; summary: string }[];
    created_at: string;
  };
  latency_ms: number;
}

interface IntentMatch {
  intent: string;
  tool: string | null;
  args: Record<string, unknown>;
  needsClarification?: string;
  refusal?: string;
  directReply?: string;
}

/* ------------------------------------------------------------- request guard */

const CROSS_USER_PATTERNS = [
  /(another|other|someone else'?s?|his|her|their)\s+(student|timetable|schedule|ticket|queue)/i,
  /(student|user)\s+(named\s+)?[A-Z][a-z]+\s*(?:'s)?\s+(timetable|schedule|ticket|queue|grades)/,
  /show me all (students|users|tickets)/i,
];

const ADMIN_PATTERNS = [
  /(change|set|edit|update|delete|create|add|remove)\s+(the\s+)?(room|building|floor|user|role|campus|capacity|queue|office)\b/i,
  /(make|promote)\s+me\s+(an?\s+)?(admin|staff)/i,
  /\b(sql|database|drop table|truncate)\b/i,
];

function guard(message: string, principal: Principal): string | null {
  if (CROSS_USER_PATTERNS.some((pattern) => pattern.test(message)) && !roleAtLeast(principal.role, 'staff')) {
    return 'I can only show your own timetable, tickets and queue positions. Staff and administrators can view other students from their dashboards.';
  }
  if (ADMIN_PATTERNS.some((pattern) => pattern.test(message)) && !roleAtLeast(principal.role, 'admin')) {
    return 'That is an administrative change, which I cannot perform. Campus infrastructure, users and queue rules are managed by administrators in the admin console.';
  }
  return null;
}

/* ----------------------------------------------------- deterministic planner */

const ROOM_CODE = /\b([A-Z]{1,3}\s?\d{1,4})\b/gi;
const BUILDING_CODE = /\bbuilding\s+([A-Z])\b/i;
const CAPACITY = /(\d{1,3})\s*(?:people|persons?|students?|seats?|pax)?/i;
const OFFICE_ALIASES: { pattern: RegExp; code: string; label: string }[] = [
  { pattern: /principal/i, code: 'PRINCIPAL', label: "Principal's Office" },
  { pattern: /secretar/i, code: 'SECRETARY', label: "Secretary's Office" },
  { pattern: /student affairs/i, code: 'AFFAIRS', label: 'Student Affairs Office' },
  { pattern: /\bdean\b/i, code: 'DEAN', label: "Dean's Office" },
  { pattern: /registrar|registration/i, code: 'REGISTRAR', label: 'Registrar' },
];

function extractRoomCode(message: string): string | null {
  const matches = [...message.matchAll(ROOM_CODE)].map((match) => match[1]!.replace(/\s+/g, '').toUpperCase());
  return matches[0] ?? null;
}

function extractOffice(message: string): { code: string; label: string } | null {
  for (const alias of OFFICE_ALIASES) {
    if (alias.pattern.test(message)) return { code: alias.code, label: alias.label };
  }
  return null;
}

function extractCapacity(message: string): number | null {
  const match = message.match(/for\s+(\d{1,3})\s*(people|persons?|students?|seats?)?/i) ?? message.match(CAPACITY);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 && value < 500 ? value : null;
}

export function classify(message: string, principal: Principal): IntentMatch {
  const text = message.trim();
  const lower = text.toLowerCase();
  const roomCode = extractRoomCode(text);
  const office = extractOffice(text);
  const capacity = capacityHint(lower);

  const guardMessage = guard(text, principal);
  if (guardMessage) {
    return { intent: 'REFUSED', tool: null, args: {}, refusal: guardMessage };
  }

  // Cancellation first: it must not be confused with "join".
  if (/\b(cancel|drop|withdraw|remove)\b/.test(lower)) {
    if (office || /office|registrar|principal|dean|affairs|secretary/.test(lower)) {
      return { intent: 'CANCEL_OFFICE_TICKET', tool: 'cancel_office_ticket', args: {} };
    }
    return { intent: 'CANCEL_QUEUE', tool: 'cancel_queue_ticket', args: {} };
  }

  if (/\b(next class|next lecture|what'?s next|next session)\b/.test(lower)) {
    return { intent: 'GET_NEXT_CLASS', tool: 'get_next_class', args: {} };
  }
  if (/\b(timetable|schedule|classes today|my classes|lectures)\b/.test(lower)) {
    const wantsWeek = /week|weekly|this week/.test(lower);
    return { intent: wantsWeek ? 'GET_WEEKLY_SCHEDULE' : 'GET_TODAYS_SCHEDULE', tool: 'get_student_schedule', args: { scope: wantsWeek ? 'week' : 'today' } };
  }

  if (/\b(where am i|my position|where am i now|current location)\b/.test(lower)) {
    return { intent: 'GET_CURRENT_POSITION', tool: 'get_current_position', args: {} };
  }

  if (/\b(queue position|my queue|queue status|my ticket|how long|waiting time|how long will i wait)\b/.test(lower) && !/join/.test(lower)) {
    return { intent: 'GET_QUEUE_STATUS', tool: 'get_queue_status', args: {} };
  }

  if (/\b(office ticket|my appointment|when is my appointment|office queue|my turn)\b/.test(lower)) {
    return { intent: 'GET_OFFICE_TICKET_STATUS', tool: 'get_office_ticket_status', args: {} };
  }

  if (/\b(join|get in|add me|book a place|reserve)\b/.test(lower) && /queue|room|seat/.test(lower)) {
    if (!roomCode) {
      return {
        intent: 'JOIN_QUEUE',
        tool: null,
        args: {},
        needsClarification: 'Which room would you like to join the queue for? For example: "Join the queue for B204".',
      };
    }
    return { intent: 'JOIN_QUEUE', tool: 'join_queue', args: { room_code: roomCode } };
  }

  if (/^\s*(join|enter)\b/.test(lower) && roomCode) {
    return { intent: 'JOIN_QUEUE', tool: 'join_queue', args: { room_code: roomCode } };
  }

  if (/\b(request|need|get|take|book)\b.*\b(ticket|appointment|visit|slot)\b/.test(lower) || (office && /\b(visit|ticket|appointment|see|meet)\b/.test(lower))) {
    if (!office) {
      return {
        intent: 'REQUEST_OFFICE_TICKET',
        tool: null,
        args: {},
        needsClarification: 'Which office do you need? For example: Principal\'s Office, Registrar, Student Affairs, Dean\'s Office or Secretary\'s Office.',
      };
    }
    return {
      intent: 'REQUEST_OFFICE_TICKET',
      tool: 'request_office_ticket',
      args: { office_code: office.code, subject: text.slice(0, 160) },
    };
  }

  if (/\b(navigate|directions?|how do i get|how to get|route|take me|walk me|guide me)\b/.test(lower)) {
    if (roomCode) {
      return { intent: 'START_NAVIGATION', tool: 'calculate_route', args: { room_code: roomCode, accessible: /accessib|wheelchair|step[- ]free|step free/.test(lower) } };
    }
    if (office) {
      return { intent: 'START_NAVIGATION', tool: 'calculate_route', args: { office_code: office.code, accessible: /accessib|wheelchair|step[- ]free/.test(lower) } };
    }
    return {
      intent: 'START_NAVIGATION',
      tool: null,
      args: {},
      needsClarification: 'Where would you like to go? Give me a room code such as B204, a building, or an office name.',
    };
  }

  if (/\b(where is|find|locate)\b/.test(lower) && roomCode) {
    return { intent: 'GET_ROOM_LOCATION', tool: 'get_room_details', args: { code: roomCode } };
  }

  if (/\b(available|free|availability|is .* open)\b/.test(lower) && roomCode) {
    return { intent: 'GET_ROOM_AVAILABILITY', tool: 'get_room_details', args: { code: roomCode } };
  }

  if (/\b(room|study space|space|lab|classroom|meeting room|hall)\b/.test(lower) && /(find|need|looking for|search|is there|available|free)/.test(lower)) {
    if (capacity === null && !/library|lab|study|meeting|lecture|any/.test(lower)) {
      return { intent: 'SEARCH_ROOM', tool: null, args: {}, needsClarification: 'What capacity do you need? For example: "Find me a study room for 15 people".' };
    }
    const buildingMatch = text.match(BUILDING_CODE);
    const type = /study/.test(lower)
      ? 'study'
      : /lab/.test(lower)
        ? 'lab'
        : /meeting/.test(lower)
          ? 'meeting'
          : /lecture|classroom|hall/.test(lower)
            ? 'lecture'
            : /library/.test(lower)
              ? 'library'
              : undefined;
    return {
      intent: 'SEARCH_ROOM',
      tool: 'search_available_rooms',
      args: {
        min_capacity: capacity ?? undefined,
        building_code: buildingMatch?.[1]?.toUpperCase(),
        room_type: type,
        available_now: true,
        limit: 5,
      },
    };
  }

  if (/\b(events?|what'?s on|happening)\b/.test(lower)) {
    return { intent: 'GET_EVENTS', tool: 'get_events', args: {} };
  }
  if (/\b(announcements?|news|notices?)\b/.test(lower)) {
    return { intent: 'GET_ANNOUNCEMENTS', tool: 'get_announcements', args: {} };
  }
  if (/\b(building|campus map|facilities|map)\b/.test(lower)) {
    return { intent: 'GET_CAMPUS_MAP', tool: 'get_campus_map_summary', args: {} };
  }
  if (office) {
    return { intent: 'GET_OFFICE_DETAILS', tool: 'get_office_details', args: { code: office.code } };
  }
  if (roomCode) {
    return { intent: 'GET_ROOM_DETAILS', tool: 'get_room_details', args: { code: roomCode } };
  }

  return {
    intent: 'UNKNOWN',
    tool: null,
    args: {},
    needsClarification:
      'I can help with your timetable, room availability, queues, office tickets, campus navigation, events and announcements. What would you like to do?',
  };
}

function capacityHint(lower: string): number | null {
  const match = lower.match(/for\s+(\d{1,3})/) ?? lower.match(/(\d{1,3})\s*(people|persons?|students?|seats?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/* ------------------------------------------------------------------ LLM planner */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  name?: string;
}

function systemPrompt(principal: Principal): string {
  return [
    'You are the CampusFlow Campus Assistant for a university campus.',
    'You answer using only the supplied tools, which read live campus data. Never invent rooms, times, tickets or queue positions.',
    `The user is ${principal.name}, role: ${principal.role}.`,
    'Respect the role strictly: never reveal other users\' data, never claim to have changed infrastructure, and never invent endpoints.',
    'If a tool returns an error, tell the user plainly what happened and what to try next.',
    'Keep answers short and concrete, and prefer the user\'s own wording for places (for example "B204").',
  ].join(' ');
}

async function callLlm(messages: ChatMessage[], tools: { type: 'function'; function: unknown }[]): Promise<{
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const response = await fetch(`${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        temperature: 0.2,
        messages,
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length ? 'auto' : undefined,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw ApiError.unavailable(`The language model provider responded with ${response.status}. ${detail.slice(0, 200)}`);
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] } }[];
    };
    const message = payload.choices?.[0]?.message;
    return { content: message?.content ?? null, tool_calls: message?.tool_calls };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.unavailable('The AI provider could not be reached. The deterministic assistant is still available.');
  } finally {
    clearTimeout(timeout);
  }
}

function toOpenAiTools(principal: Principal) {
  return toolsForRole(principal.role).map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/* ------------------------------------------------------------------ persistence */

async function ensureConversation(db: Db, userId: string, conversationId: string | undefined, title: string): Promise<string> {
  if (conversationId) {
    const existing = await db.one<{ id: string }>('SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2', [
      conversationId,
      userId,
    ]);
    if (!existing) throw ApiError.notFound('Conversation not found.');
    return existing.id;
  }
  const created = await db.one<{ id: string }>(
    'INSERT INTO ai_conversations (user_id, title) VALUES ($1, $2) RETURNING id',
    [userId, title.slice(0, 80) || 'New conversation'],
  );
  return created!.id;
}

async function loadHistory(db: Db, conversationId: string, limit = 10): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const rows = await db.query<{ role: 'user' | 'assistant'; content: string }>(
    `SELECT role, content FROM ai_messages
      WHERE conversation_id = $1 AND role IN ('user', 'assistant')
      ORDER BY created_at DESC LIMIT $2`,
    [conversationId, limit],
  );
  return rows.reverse();
}

/* --------------------------------------------------------------------- entry point */

export async function assistantRespond(db: Db, principal: Principal, request: AssistantRequest): Promise<AssistantReply> {
  const started = Date.now();
  const message = request.message.trim();
  if (!message) throw ApiError.validation({ message: ['Please type a question.'] });

  const conversationId = await ensureConversation(db, principal.id, request.conversationId, message);
  await db.query('INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)', [
    conversationId,
    'user',
    message,
  ]);

  const planner = config.ai.apiKey ? 'llm' : 'deterministic';
  const toolCalls: { name: string; arguments: Record<string, unknown>; summary: string }[] = [];
  let content = '';
  let data: unknown = null;
  let actions: { label: string; href: string; kind?: string }[] = [];
  let intent = 'UNKNOWN';
  let model: string | null = null;

  if (planner === 'llm') {
    model = config.ai.model;
    const history = await loadHistory(db, conversationId);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt(principal) },
      ...history.map((entry) => ({ role: entry.role, content: entry.content }) as ChatMessage),
    ];
    const tools = toOpenAiTools(principal);

    for (let iteration = 0; iteration < config.ai.maxToolIterations; iteration += 1) {
      const completion = await callLlm(messages, tools);
      if (completion.tool_calls?.length) {
        messages.push({ role: 'assistant', content: completion.content ?? '', tool_calls: completion.tool_calls });
        for (const call of completion.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = call.function.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {};
          } catch {
            args = {};
          }
          let result: ToolResult;
          try {
            result = await runTool(db, principal, call.function.name, args);
          } catch (error) {
            const apiError = error as ApiError;
            result = {
              data: { error: apiError.message ?? 'The action could not be completed.' },
              summary: apiError.message ?? 'That action could not be completed.',
            };
          }
          toolCalls.push({ name: call.function.name, arguments: args, summary: result.summary });
          data = result.data;
          actions = result.actions ?? [];
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify({ summary: result.summary, data: result.data }).slice(0, 6000),
          });
        }
        continue;
      }
      content = completion.content?.trim() ?? '';
      break;
    }

    if (!content) {
      content =
        toolCalls.length > 0
          ? toolCalls.map((call) => call.summary).join(' ')
          : 'I could not complete that request. Please try rephrasing it.';
    }
    intent = toolCalls[0]?.name?.toUpperCase() ?? 'CONVERSATION';
  } else {
    const match = classify(message, principal);
    intent = match.intent;

    if (match.refusal) {
      content = match.refusal;
    } else if (match.needsClarification) {
      content = match.needsClarification;
    } else if (match.tool) {
      try {
        const result = await runTool(db, principal, match.tool, match.args);
        toolCalls.push({ name: match.tool, arguments: match.args, summary: result.summary });
        data = result.data;
        actions = result.actions ?? [];
        content = result.summary;
      } catch (error) {
        const apiError = error as ApiError;
        content =
          apiError?.message ??
          'That action could not be completed right now. Please try again, or use the CampusFlow screens directly.';
        data = { error: true, code: apiError?.code ?? 'UNKNOWN' };
      }
    } else {
      content = 'I could not find an action for that request.';
    }
  }

  const stored = await db.one<{ id: string; created_at: string }>(
    `INSERT INTO ai_messages (conversation_id, role, content, intent, tool_calls, data, actions, provider, model, latency_ms)
     VALUES ($1, 'assistant', $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, created_at`,
    [
      conversationId,
      content,
      intent,
      JSON.stringify(toolCalls),
      JSON.stringify(data ?? {}),
      JSON.stringify(actions),
      planner,
      model,
      Date.now() - started,
    ],
  );

  await db.query('UPDATE ai_conversations SET updated_at = now() WHERE id = $1', [conversationId]);

  return {
    conversation_id: conversationId,
    provider: planner,
    model,
    intent,
    message: {
      id: stored!.id,
      role: 'assistant',
      content,
      data,
      actions,
      tool_calls: toolCalls,
      created_at: stored!.created_at,
    },
    latency_ms: Date.now() - started,
  };
}

export { TOOLS };
