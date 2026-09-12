'use client';

/**
 * Realtime channel.
 *
 * Connects to `/api/ws` (proxied by `server.mjs`, so it is same-origin in dev), sends the
 * bearer token as the first message, and exposes a subscribe API. The server decides which
 * channels a principal may join; the client can only listen.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getToken } from '@/lib/api/client';

export interface RealtimeEvent<T = Record<string, unknown>> {
  channel: string;
  event: string;
  payload: T;
  at: string;
}

type Handler = (event: RealtimeEvent) => void;

interface RealtimeContextValue {
  connected: boolean;
  channels: string[];
  subscribe: (channel: string, handler: Handler) => () => void;
  /** Subscribes by prefix, e.g. `user:` or `queue:` — the server authorises the rest. */
  subscribePrefix: (prefix: string, handler: Handler) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function socketUrl(): string {
  if (typeof window === 'undefined') return '';
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/ws`;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [channels, setChannels] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<Handler>>>(new Map());
  const prefixHandlersRef = useRef<Map<string, Set<Handler>>>(new Map());
  const reconnectRef = useRef<number>(0);
  const authenticatedRef = useRef(false);

  const send = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;

    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch {
      // A connection can close between its state check and send in some browsers.
      return false;
    }
  }, []);

  const dispatch = useCallback((event: RealtimeEvent) => {
    handlersRef.current.get(event.channel)?.forEach((handler) => handler(event));
    prefixHandlersRef.current.forEach((set, prefix) => {
      if (event.channel.startsWith(prefix)) set.forEach((handler) => handler(event));
    });
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setConnected(false);
      return;
    }

    let closedByUs = false;
    let socket: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const url = socketUrl();
      if (!url) return;
      socket = new WebSocket(url);
      socketRef.current = socket;
      authenticatedRef.current = false;

      socket.onopen = () => {
        reconnectRef.current = 0;
        send({ type: 'auth', token: getToken() });
      };

      socket.onmessage = (message) => {
        let payload: { type?: string; channel?: string; event?: string; payload?: Record<string, unknown>; at?: string; channels?: string[] };
        try {
          payload = JSON.parse(String(message.data));
        } catch {
          return;
        }
        if (payload.type === 'authenticated') {
          authenticatedRef.current = true;
          setConnected(true);
          setChannels(payload.channels ?? []);
          // Components can mount before the handshake completes. Subscribe only after the
          // server has associated this socket with the authenticated principal.
          for (const channel of handlersRef.current.keys()) send({ type: 'subscribe', channel });
          return;
        }
        if (payload.type === 'welcome') return;
        if (payload.channel && payload.event) {
          dispatch({
            channel: payload.channel,
            event: payload.event,
            payload: payload.payload ?? {},
            at: payload.at ?? new Date().toISOString(),
          });
        }
      };

      socket.onclose = (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        authenticatedRef.current = false;
        setConnected(false);
        setChannels([]);
        if (closedByUs || event.code === 4401) return;
        reconnectRef.current += 1;
        const delay = Math.min(15_000, 1000 * 2 ** reconnectRef.current);
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        /* onclose handles the retry */
      };
    };

    connect();

    heartbeat = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
    }, 25_000);

    return () => {
      closedByUs = true;
      if (heartbeat) clearInterval(heartbeat);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
      if (socketRef.current === socket) socketRef.current = null;
      authenticatedRef.current = false;
      setConnected(false);
    };
  }, [dispatch, send]);

  const subscribe = useCallback<RealtimeContextValue['subscribe']>((channel, handler) => {
    const set = handlersRef.current.get(channel) ?? new Set<Handler>();
    set.add(handler);
    handlersRef.current.set(channel, set);
    if (authenticatedRef.current) send({ type: 'subscribe', channel });
    return () => {
      set.delete(handler);
      if (set.size === 0) handlersRef.current.delete(channel);
    };
  }, [send]);

  const subscribePrefix = useCallback<RealtimeContextValue['subscribePrefix']>((prefix, handler) => {
    const set = prefixHandlersRef.current.get(prefix) ?? new Set<Handler>();
    set.add(handler);
    prefixHandlersRef.current.set(prefix, set);
    return () => {
      set.delete(handler);
      if (set.size === 0) prefixHandlersRef.current.delete(prefix);
    };
  }, []);

  const value = useMemo(() => ({ connected, channels, subscribe, subscribePrefix }), [connected, channels, subscribe, subscribePrefix]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used inside <RealtimeProvider>.');
  return context;
}

/** Convenience hook: listen to one channel (or a prefix when it ends with `*`). */
export function useRealtimeEvent(channel: string | null, handler: Handler, deps: unknown[] = []): void {
  const { subscribe, subscribePrefix } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!channel) return;
    const stable: Handler = (event) => handlerRef.current(event);
    if (channel.endsWith('*')) return subscribePrefix(channel.slice(0, -1), stable);
    return subscribe(channel, stable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, subscribe, subscribePrefix, ...deps]);
}
