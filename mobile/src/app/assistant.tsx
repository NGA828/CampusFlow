import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge, Card, Eyebrow, H3, Screen, Small, Title } from '@/components/ui';
import { ApiError, assistantApi } from '@/lib/api';
import { colors, font, radius, spacing } from '@/lib/theme';
import type { AiMessage } from '@/lib/types';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools?: { name: string; ok: boolean }[];
  intent?: string;
  error?: string;
}

const SUGGESTIONS = ['Where is my next class?', 'Which office has the shortest queue?', 'Find a free study room near me', 'When does the library close?'];

export default function AssistantScreen() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const scrollRef = useRef<ScrollView>(null);

  const send = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    setInput('');
    setBusy(true);
    setTurns((current) => [...current, { id: `u-${Date.now()}`, role: 'user', content: trimmed }]);

    try {
      const reply = await assistantApi.send({ message: trimmed, conversation_id: conversationId });
      setConversationId(reply.conversation_id);
      const assistant = reply.message as AiMessage;
      setTurns((current) => [
        ...current,
        {
          id: assistant.id ?? `a-${Date.now()}`,
          role: 'assistant',
          content: assistant.content,
          tools: assistant.tool_calls ?? undefined,
          intent: reply.intent,
        },
      ]);
    } catch (caught) {
      const message2 = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'The assistant is unavailable right now.';
      setTurns((current) => [...current, { id: `e-${Date.now()}`, role: 'assistant', content: '', error: message2 }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <View style={styles.header}>
          <Eyebrow>Campus assistant</Eyebrow>
          <Title style={{ marginTop: 2 }}>Ask CampusFlow</Title>
          <Small style={{ marginTop: 4 }}>Answers come from controlled backend tools evaluated against your own account — never from direct database access.</Small>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
          {turns.length === 0 ? (
            <Card>
              <H3>Things I can do</H3>
              <Small style={{ marginTop: 4 }}>Try one of these, or ask in your own words.</Small>
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {SUGGESTIONS.map((suggestion) => (
                  <Pressable key={suggestion} onPress={() => void send(suggestion)} style={styles.suggestion}>
                    <Ionicons name="sparkles-outline" size={16} color={colors.brand700} />
                    <Small style={{ color: colors.brand700, fontWeight: '600' }}>{suggestion}</Small>
                  </Pressable>
                ))}
              </View>
            </Card>
          ) : null}

          {turns.map((turn) => (
            <View key={turn.id} style={[styles.bubbleRow, turn.role === 'user' ? styles.bubbleRowUser : null]}>
              <View style={[styles.bubble, turn.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                {turn.error ? <Text style={[font.body, { color: colors.coral600 }]}>{turn.error}</Text> : <Text style={[font.body, styles.bubbleText]}>{turn.content}</Text>}
                {turn.tools && turn.tools.length > 0 ? (
                  <View style={styles.tools}>
                    {turn.tools.map((tool) => (
                      <Badge key={tool.name} tone={tool.ok ? 'mint' : 'coral'}>
                        {tool.name}
                      </Badge>
                    ))}
                  </View>
                ) : null}
                {turn.intent ? <Small style={styles.intent}>intent · {turn.intent}</Small> : null}
              </View>
            </View>
          ))}

          {busy ? (
            <Small style={{ marginTop: spacing.sm }}>Thinking…</Small>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about rooms, routes, queues…"
            placeholderTextColor={colors.ink400}
            style={styles.input}
            accessibilityLabel="Message"
            onSubmitEditing={() => void send(input)}
            multiline
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={() => void send(input)}
            disabled={busy || input.trim().length === 0}
            style={[styles.send, { opacity: busy || input.trim().length === 0 ? 0.5 : 1 }]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  thread: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '92%', borderRadius: radius.card, padding: spacing.md },
  bubbleAssistant: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.ink100 },
  bubbleUser: { backgroundColor: colors.brand600 },
  bubbleText: { color: colors.ink800 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  intent: { marginTop: spacing.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.ink100,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.body.fontSize,
    color: colors.ink800,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brand600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brand100,
    backgroundColor: colors.brand50,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
