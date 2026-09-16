'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAsync, useMediaQuery } from '@/lib/hooks';
import { assistantApi } from '@/lib/api/endpoints';
import type { AiMessage } from '@/lib/api/types';
import { assistantWebHref } from '@/lib/companion-links';
import { Button, CardSkeleton } from '@/components/ui/kit';
import { WorkspaceIcon } from '@/components/layout/workspace-visual';
import { CompanionHeading, Empty, Feedback, ReadError, errorMessage, momentLabel } from '@/components/layout/student-companion';
import s from '@/components/layout/student-companion.module.css';

const STARTERS: Record<string, { label: string; prompt: string; hint: string }> = {
  my_schedule: { label: 'What’s on my timetable?', prompt: 'What is on my timetable?', hint: 'Plan your day' },
  locate_room: { label: 'Find a campus room', prompt: 'Find room ', hint: 'Add your room code' },
  queue_status: { label: 'How busy are the room queues?', prompt: 'How busy are the room queues?', hint: 'Check before you go' },
  offices: { label: 'Which offices can help me?', prompt: 'Which campus offices are available?', hint: 'Campus services' },
  announcements: { label: 'Show campus announcements', prompt: 'Show me the latest announcements', hint: 'Stay in the loop' },
  campus_overview: { label: 'Explore campus buildings', prompt: 'Show me the campus buildings', hint: 'Get your bearings' },
};

export default function AssistantPage() {
  const wide = useMediaQuery('(min-width: 901px)');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [title, setTitle] = useState('A new conversation');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lock = useRef(false);
  const messageId = useRef(0);
  const transcript = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const restoreFocus = useRef(false);
  const conversations = useAsync(() => assistantApi.conversations(), []);
  const tools = useAsync(() => assistantApi.capabilities(), []);
  const starters = (tools.error ? [] : tools.data?.tools ?? []).filter(tool => STARTERS[tool.id]).slice(0, wide ? 4 : 2);

  useEffect(() => {
    if (!busy && restoreFocus.current) { composer.current?.focus(); restoreFocus.current = false; }
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [messages, busy]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (lock.current || !message || message.length > 1000) return;
    lock.current = true; setBusy('send'); setError(null); restoreFocus.current = true;
    const submittedAt = new Date().toISOString();
    try {
      const reply = await assistantApi.send({ message, conversation_id: conversationId ?? undefined, context: { screen: 'student.assistant' } });
      if (conversationId && String(reply.conversation_id) !== String(conversationId)) throw new Error('The reply belongs to another conversation. Open history to check the result.');
      const own: AiMessage = { id: `submitted-${++messageId.current}`, role: 'user', content: message, created_at: submittedAt };
      setMessages(current => [...current, own, reply.message]);
      setConversationId(reply.conversation_id);
      if (!conversationId) setTitle(message);
      setInput('');
    } catch (caught) {
      setError(`${errorMessage(caught, 'The assistant could not answer.')} Your draft is kept. The server may have saved the message; check recent conversations before sending again.`);
    } finally { lock.current = false; setBusy(null); conversations.reload(); }
  }
  async function openConversation(id: string) {
    if (lock.current) return;
    if (input.trim() && !window.confirm('Open another conversation? Your unsent draft will stay in the composer.')) return;
    lock.current = true; setBusy(`open:${id}`); setError(null); restoreFocus.current = true;
    try {
      const payload = await assistantApi.conversation(id);
      if (String(payload.conversation.id) !== String(id)) throw new Error('The server returned a different conversation. Please try again.');
      setConversationId(id); setMessages(payload.messages); setTitle(payload.conversation.title || 'Untitled conversation'); setConfirmDelete(false);
    } catch (caught) { setError(errorMessage(caught, 'That conversation could not be opened. Please try again.')); }
    finally { lock.current = false; setBusy(null); }
  }
  function startNew() {
    if (lock.current) return;
    setConversationId(null); setTitle('A new conversation'); setMessages([]); setError(null); setConfirmDelete(false);
    // An unsent draft belongs to the person, not to a response that happened to finish last.
    composer.current?.focus();
  }
  async function deleteConversation() {
    if (lock.current || !conversationId) return;
    lock.current = true; setBusy('delete'); setError(null);
    try {
      const result = await assistantApi.remove(conversationId);
      if (String(result.deleted) !== String(conversationId)) throw new Error('The server did not confirm deletion. Refresh history before trying again.');
      setConversationId(null); setMessages([]); setTitle('A new conversation'); setConfirmDelete(false); conversations.reload();
    } catch (caught) { setError(errorMessage(caught, 'This conversation could not be deleted.')); }
    finally { lock.current = false; setBusy(null); }
  }

  return <div className={s.page}>
    <CompanionHeading eyebrow="Student workspace · campus companion" title="Campus assistant" description="Campus information and next steps, shaped by your account." />
    <div className={s.chatLayout}>
      <aside className={s.library} aria-label="Conversation library">
        <Button variant="secondary" disabled={!!busy} onClick={startNew}>+ New conversation</Button>
        <details className={s.libraryDetails} open={wide}><summary>Recent conversations</summary>
          {conversations.loading ? <CardSkeleton rows={3} /> : conversations.error ? <ReadError message={conversations.error} retry={conversations.reload} /> : conversations.data?.conversations.length ? <div className={s.conversationList}>{conversations.data.conversations.map(conversation => <button key={conversation.id} disabled={!!busy} aria-current={conversationId === conversation.id ? 'true' : undefined} onClick={() => void openConversation(conversation.id)}>{conversation.title || 'Untitled conversation'}<small>{momentLabel(conversation.last_message_at ?? conversation.updated_at ?? conversation.created_at)}</small></button>)}</div> : <p>No saved conversations yet. Your first successful exchange will appear here.</p>}
          <Button variant="ghost" size="sm" disabled={!!busy || conversations.loading} onClick={conversations.reload}>Refresh history</Button>
        </details>
        <details className={s.libraryDetails} open={wide}><summary>Available campus tools</summary>
          {tools.loading ? <CardSkeleton rows={3} /> : tools.error ? <ReadError message={tools.error} retry={tools.reload} /> : <><ul className={s.toolList}>{tools.data?.tools.map(tool => <li key={tool.id}>{tool.label}</li>)}</ul>{!tools.data?.tools.length && <p>No tool list is available for this session.</p>}<p>{tools.data?.note ?? 'Tool availability is decided by the campus system.'}</p></>}
        </details>
      </aside>
      <section className={s.chatMain} aria-label="Campus conversation">
        <header className={s.chatTop}><div><h2>{title}</h2><p>Campus information · web workspace</p></div>{conversationId && <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => setConfirmDelete(true)}>Delete conversation</Button>}</header>
        {confirmDelete && <div className={s.chatFeedback}><div className={s.confirm}><p>Delete this conversation transcript? It will disappear from your history. Campus tool audit records are not erased.</p><div className={s.actions}><Button variant="danger" disabled={!!busy} loading={busy === 'delete'} onClick={() => void deleteConversation()}>Confirm deletion</Button><Button variant="secondary" disabled={!!busy} onClick={() => setConfirmDelete(false)}>Keep conversation</Button></div></div></div>}
        <div ref={transcript} className={s.transcript} role="log" aria-label="Conversation transcript" aria-busy={!!busy} aria-live="polite" tabIndex={0}>
          {busy?.startsWith('open:') ? <><p className={s.muted}>Opening conversation…</p><CardSkeleton rows={6} /></> : messages.length ? messages.map(message => <Message key={message.id} message={message} />) : conversationId ? <Empty title="This conversation is empty">Ask a question below to continue it.</Empty> : <div className={s.welcome}>
            <div className={s.assistantMark}><WorkspaceIcon name="sparkles" size={27} /></div><p className={s.eyebrow}>A clearer campus day</p><h2>Where do we go from here?</h2><p>Choose a prompt, or write your own question below.</p>
            {tools.loading ? <CardSkeleton rows={3} /> : starters.length ? <div className={s.suggestions}>{starters.map(tool => <button key={tool.id} disabled={!!busy} onClick={() => { setInput(STARTERS[tool.id].prompt); composer.current?.focus(); }}><small>{STARTERS[tool.id].hint}</small>{STARTERS[tool.id].label}</button>)}</div> : <p className={s.connection}>You can still ask a question below. The campus system will explain which tools it can use.</p>}
          </div>}
          {busy === 'send' && <div className={s.message} data-role="user"><div className={s.messageHeader}>Sending your message…</div><p className={s.messageBody}>{input.trim()}</p></div>}
        </div>
        {error && <div className={s.chatFeedback}><Feedback error>{error}</Feedback></div>}
        <form className={s.composer} onSubmit={send} aria-label="Ask the campus assistant">
          <label htmlFor="assistant-question">Your question</label><textarea ref={composer} id="assistant-question" required maxLength={1000} rows={3} disabled={!!busy || confirmDelete} value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about your campus…" aria-describedby="assistant-hint" />
          <div className={s.composerFoot}><p id="assistant-hint">{input.length}/1000 characters · Enter adds a new line. Don’t share passwords or sensitive personal details.</p><Button type="submit" disabled={!!busy || confirmDelete || !input.trim()} loading={busy === 'send'}>Send question <WorkspaceIcon name="arrow" size={16} /></Button></div>
        </form>
      </section>
    </div>
  </div>;
}

function Message({ message }: { message: AiMessage }) {
  const actions = (message.actions ?? []).map(action => ({ ...action, safeHref: assistantWebHref(action.href) }));
  return <article className={s.message} data-role={message.role}>
    <div className={s.messageHeader}>{message.role === 'assistant' && <WorkspaceIcon name="sparkles" size={16} />}<span>{message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Campus assistant' : 'Campus tool'}</span><time dateTime={message.created_at}>{momentLabel(message.created_at)}</time></div>
    <p className={s.messageBody}>{message.content}</p>
    {!!actions.length && <div className={s.actions}>{actions.filter(action => action.safeHref).map((action, index) => <Link className={s.link} key={`${action.label}-${index}`} href={action.safeHref!}>{action.label}<WorkspaceIcon name="arrow" size={15} /></Link>)}</div>}
    {actions.some(action => !action.safeHref) && <p className={s.connection}>Some suggested actions are not available in this web workspace.</p>}
    {message.data && <DataDetails label="Returned campus data" data={message.data} />}
    {message.metadata && <DataDetails label="Response details" data={message.metadata} />}
    {!!message.tool_calls?.length && <details className={s.details}><summary>Tool results · {message.tool_calls.length}</summary>{message.tool_calls.map((tool, index) => <div key={`${tool.name}-${index}`}><h3>{tool.name} · {tool.ok ? 'Completed' : 'Not completed'}</h3>{tool.error && <p className={s.muted}>{tool.error}</p>}{tool.args && <DataDetails label="Tool arguments" data={tool.args} />}</div>)}</details>}
  </article>;
}
function DataDetails({ label, data }: { label: string; data: Record<string, unknown> }) {
  return <details className={s.details}><summary>{label}</summary><dl>{Object.entries(data).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{value === null ? 'Not provided' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</dd></div>)}</dl></details>;
}
