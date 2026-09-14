'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAsync } from '@/lib/hooks';
import { assistantApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Button, Card, CardSkeleton, SectionHeading, Spinner } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { relativeTime } from '@/lib/hooks';
import type { AiMessage } from '@/lib/api/types';

const SUGGESTIONS = [
  'What is my next class?',
  'Which rooms are free right now?',
  'How long is the queue for room B204?',
  'Take me to the Student Affairs office',
  'What events are on this week?',
  'Where am I on campus?',
];

export default function AssistantPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const localMessageId = useRef(0);

  const conversations = useAsync(() => assistantApi.conversations(), []);
  // The tool list is a server answer, not a client constant: which tools exist depends on role *and*
  // platform, so this panel reports what this session may actually do.
  const tools = useAsync(() => assistantApi.capabilities(), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setInput('');

    const optimistic: AiMessage = {
      id: `local-${++localMessageId.current}`,
      role: 'user',
      content: message,
      data: null,
      actions: null,
      tool_calls: null,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);

    try {
      const reply = await assistantApi.send({ message, conversation_id: conversationId ?? undefined });
      setConversationId(reply.conversation_id);
      setMessages((current) => [...current, reply.message]);
      conversations.reload();
    } catch (caught) {
      const detail = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'The assistant could not answer that.';
      setError(detail);
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const openConversation = async (id: string) => {
    try {
      const payload = await assistantApi.conversation(id);
      setConversationId(id);
      setMessages(payload.messages);
    } catch {
      setError('That conversation could not be opened.');
    }
  };

  const startNew = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  };

  return (
    <div>
      <PageHeader
        title="Campus assistant"
        description="Ask in plain language. The assistant answers using authorised campus data and can act on your behalf — it never touches the database directly."
        actions={
          <Button variant="secondary" size="sm" onClick={startNew}>
            New conversation
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* The chat fills the viewport on desktop; on phones the offset accounts for the top bar,
            the page header and the bottom navigation, and never collapses below a usable height. */}
        <Card className="flex h-[calc(100dvh-330px)] min-h-[380px] flex-col !p-0 lg:h-[calc(100dvh-220px)] lg:min-h-[520px]">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="grid h-full place-items-center">
                <div className="max-w-md text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-[15px] font-bold text-white">CF</div>
                  <p className="mt-4 text-[15px] font-semibold text-ink-900">How can I help you navigate campus?</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
                    I can find rooms, plan routes, read your timetable, check queues and offices, and point you at events. Your permissions decide what I can see.
                  </p>
                </div>
              </div>
            ) : (
              messages
                .filter((message) => message.role !== 'tool')
                .map((message) => <MessageBubble key={message.id} message={message} />)
            )}

            {sending ? (
              <div className="flex items-center gap-2 text-[13px] text-ink-400">
                <Spinner /> Checking authorised campus data…
              </div>
            ) : null}
          </div>

          {error ? <div className="border-t border-coral-100 bg-coral-50 px-4 py-2 text-[12.5px] text-coral-700">{error}</div> : null}

          <div className="border-t border-ink-100 p-3">
            {messages.length === 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12.5px] text-ink-600 hover:border-brand-300 hover:text-brand-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                placeholder="Ask about rooms, routes, queues, offices or events…"
                className="max-h-32 min-h-[42px] flex-1 resize-y rounded-[10px] border border-ink-200 bg-white px-3 py-2.5 text-[13.5px] text-ink-800 outline-none placeholder:text-ink-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              />
              <Button type="submit" loading={sending} disabled={input.trim().length === 0}>
                Send
              </Button>
            </form>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionHeading title="Recent conversations" />
            {conversations.loading ? (
              <CardSkeleton rows={3} />
            ) : (conversations.data?.conversations.length ?? 0) === 0 ? (
              <p className="text-[13px] text-ink-500">Your chats will be listed here so you can pick up where you left off.</p>
            ) : (
              <ul className="space-y-1.5">
                {conversations.data?.conversations.slice(0, 8).map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => void openConversation(conversation.id)}
                      className={`w-full rounded-[10px] px-3 py-2 text-left transition-colors ${
                        conversationId === conversation.id ? 'bg-brand-50' : 'hover:bg-ink-50'
                      }`}
                    >
                      <span className="block truncate text-[12.5px] font-medium text-ink-800">{conversation.title}</span>
                      <span className="block text-[11.5px] text-ink-400">
                        {relativeTime(conversation.updated_at)}
                        {conversation.message_count ? ` · ${conversation.message_count} messages` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeading
              title="What the assistant can access"
              description={`${tools.data?.tool_count ?? 0} of ${tools.data?.total_tools ?? 0} tools are available to you on ${tools.data?.platform ?? 'this platform'}`}
            />
            <ul className="space-y-1.5">
              {(tools.data?.tools ?? []).slice(0, 10).map((tool) => (
                <li key={tool.id} className="flex items-start justify-between gap-2 text-[12px]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-700">{tool.label}</span>
                    <span className="block truncate font-mono text-[11px] text-ink-400">{tool.needs}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">
              {tools.data?.note ?? 'Tools are filtered by role and platform, so nothing here is a button that fails when pressed.'}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AiMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-[14px] px-4 py-3 ${isUser ? 'bg-brand-600 text-white' : 'border border-ink-100 bg-white'}`}>
        <p className={`whitespace-pre-line text-[13.5px] leading-relaxed ${isUser ? 'text-white' : 'text-ink-700'}`}>{message.content}</p>

        {!isUser && message.data && Object.keys(message.data).length > 0 ? (
          <DataBlock data={message.data} />
        ) : null}

        {!isUser && message.actions && message.actions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((action) => (
              <Link key={`${action.label}-${action.href}`} href={action.href}>
                <Button size="sm" variant={action.kind === 'primary' ? 'primary' : 'secondary'}>
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        ) : null}

        {!isUser && message.tool_calls && message.tool_calls.length > 0 ? (
          <p className="mt-2 font-mono text-[10.5px] text-ink-400">
            {message.tool_calls
              .map((call) => `${call.name}${call.ok ? '' : ' (failed)'}`)
              .join(' · ')}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DataBlock({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, value]) => value !== null && value !== undefined);
  if (entries.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5 rounded-[10px] bg-ink-50 px-3 py-2">
      {entries.slice(0, 6).map(([key, value]) => (
        <div key={key} className="flex items-start justify-between gap-3 text-[12px]">
          <span className="text-ink-500">{key.replaceAll('_', ' ')}</span>
          <span className="max-w-[60%] text-right font-medium text-ink-700">{renderValue(value)}</span>
        </div>
      ))}
    </div>
  );
}

function renderValue(value: unknown): string {
  if (Array.isArray(value)) return value.length === 0 ? '—' : `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object' && value !== null) return `${Object.keys(value as object).length} fields`;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}
