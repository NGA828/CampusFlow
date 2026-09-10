import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { ok } from '../lib/respond.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { assistantRespond } from '../services/ai/assistant.js';
import { TOOLS } from '../services/ai/tools.js';
import { config } from '../config.js';
import { ctxOf } from '../http/context.js';

const messageSchema = z.object({
  message: z.string().trim().min(2, 'Ask a question first.').max(1000),
  conversation_id: z.string().uuid().optional(),
});

/** AI Campus Assistant endpoints (PROMPT §30–§34). */
export async function registerAiRoutes(app: FastifyInstance): Promise<void> {
  app.post('/ai/messages', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    requirePermission(ctx, 'assistant.use');
    const input = parse(messageSchema, request.body ?? {});
    const result = await assistantRespond(ctx.db, principal, {
      message: input.message,
      conversationId: input.conversation_id,
    });
    return ok(reply, result);
  });

  app.get('/ai/conversations', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const conversations = await ctx.db.query(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              (SELECT count(*)::int FROM ai_messages m WHERE m.conversation_id = c.id) AS messages
         FROM ai_conversations c WHERE c.user_id = $1 ORDER BY c.updated_at DESC LIMIT 30`,
      [principal.id],
    );
    return ok(reply, { conversations });
  });

  app.get('/ai/conversations/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const conversation = await ctx.db.one('SELECT id, title, created_at FROM ai_conversations WHERE id = $1 AND user_id = $2', [
      id,
      principal.id,
    ]);
    if (!conversation) throw ApiError.notFound('Conversation not found.');
    const messages = await ctx.db.query(
      `SELECT id, role, content, intent, tool_calls, data, actions, provider, model, latency_ms, created_at
         FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at`,
      [id],
    );
    return ok(reply, { conversation, messages });
  });

  app.delete('/ai/conversations/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const deleted = await ctx.db.query('DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2 RETURNING id', [id, principal.id]);
    if (deleted.length === 0) throw ApiError.notFound('Conversation not found.');
    return ok(reply, {}, 'Conversation deleted.');
  });

  /** Transparency: what the assistant is allowed to do for this account. */
  app.get('/ai/tools', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    return ok(reply, {
      provider: config.ai.apiKey ? 'llm' : 'deterministic',
      model: config.ai.apiKey ? config.ai.model : null,
      tools: TOOLS.filter((tool) => tool.roles.includes(principal.role)).map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    });
  });
}
