import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Badge, Button, Card, Eyebrow, H3, KeyValue, Screen, Small, Title } from '@/components/ui';
import { ApiError, positioningApi } from '@/lib/api';
import { colors, radius, relativeTime, spacing } from '@/lib/theme';
import type { Position } from '@/lib/types';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState('');
  const [payload, setPayload] = useState('');
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(true);
  const lastScan = useRef<{ value: string; at: number } | null>(null);

  const submit = async (body: { payload?: string; code?: string }) => {
    setBusy(true);
    setError(null);
    try {
      const result = await positioningApi.scan(body);
      setPosition(result.position);
      setScanning(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'The anchor could not be validated.');
      setScanning(true);
    } finally {
      setBusy(false);
    }
  };

  const onBarcode = ({ data }: { data: string }) => {
    const now = Date.now();
    // Debounce: the camera fires continuously while the code is in view.
    if (lastScan.current && lastScan.current.value === data && now - lastScan.current.at < 4000) return;
    lastScan.current = { value: data, at: now };
    void submit(data.startsWith('CF1|') ? { payload: data } : { code: data });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>Indoor positioning</Eyebrow>
        <Title style={{ marginTop: 2 }}>Scan an anchor</Title>
        <Small style={{ marginTop: 4 }}>Every code is signed by the campus API — an unknown or expired anchor is rejected.</Small>
      </View>

      <View style={styles.padded}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {permission?.granted && scanning ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={busy ? undefined : onBarcode}
            />
          ) : (
            <View style={[styles.camera, styles.cameraFallback]}>
              <Ionicons name="qr-code-outline" size={44} color={colors.ink300} />
              <Small style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                {permission?.granted
                  ? 'Camera paused. Scan again or enter the code manually.'
                  : 'Camera access is needed to read the anchor. You can also type the code printed below the QR.'}
              </Small>
              {!permission?.granted ? (
                <Button label="Allow camera" variant="secondary" onPress={() => void requestPermission()} style={{ marginTop: spacing.md }} />
              ) : null}
            </View>
          )}
        </Card>

        {position ? (
          <Card style={{ marginTop: spacing.lg, borderColor: colors.mint100, backgroundColor: colors.mint100 }}>
            <H3 style={{ color: colors.mint700 }}>Position fixed</H3>
            <Small style={{ color: colors.mint700, marginTop: 4 }}>Updated {relativeTime(position.updated_at)}</Small>
            <View style={{ marginTop: spacing.sm }}>
              <KeyValue label="Building" value={position.building_name ?? '—'} />
              <KeyValue label="Floor" value={position.floor_name ?? '—'} />
              <KeyValue label="Source" value={position.source} />
              {position.plan_x !== null && position.plan_y !== null ? (
                <KeyValue label="Plan position" value={`${position.plan_x.toFixed(1)} m, ${position.plan_y.toFixed(1)} m`} />
              ) : null}
            </View>
            <View style={styles.actions}>
              <Button label="Campus map" variant="secondary" onPress={() => router.push('/map')} style={{ flex: 1 }} />
              <Button label="Scan again" onPress={() => { setPosition(null); setScanning(true); setError(null); }} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : null}

        {error ? (
          <Card style={{ marginTop: spacing.lg, borderColor: colors.coral100, backgroundColor: colors.coral100 }}>
            <H3 style={{ color: colors.coral600 }}>Anchor rejected</H3>
            <Small style={{ color: colors.coral600, marginTop: 4 }}>{error}</Small>
            <Badge tone="coral">QR_UNKNOWN · QR_INACTIVE · SIGNATURE_INVALID · VERSION_MISMATCH</Badge>
          </Card>
        ) : null}

        <Card style={{ marginTop: spacing.lg }}>
          <H3>Enter the code manually</H3>
          <Small style={{ marginTop: 4 }}>Printed anchors carry a short code such as QR-A-ENTRANCE.</Small>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="QR-A-ENTRANCE"
            placeholderTextColor={colors.ink400}
            autoCapitalize="characters"
            style={styles.input}
            accessibilityLabel="Anchor code"
          />
          <Button label="Validate code" loading={busy} disabled={code.trim().length < 3} onPress={() => void submit({ code: code.trim() })} style={{ marginTop: spacing.md }} />

          <H3 style={{ marginTop: spacing.lg }}>Or paste the scanned payload</H3>
          <TextInput
            value={payload}
            onChangeText={setPayload}
            placeholder="CF1|QR-A-ENTRANCE|2|signature"
            placeholderTextColor={colors.ink400}
            autoCapitalize="characters"
            style={styles.input}
            accessibilityLabel="Anchor payload"
          />
          <Button
            label="Validate payload"
            variant="secondary"
            loading={busy}
            disabled={payload.trim().length < 8}
            onPress={() => void submit({ payload: payload.trim() })}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
  camera: { height: 280, backgroundColor: colors.ink900 },
  cameraFallback: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.ink50 },
  input: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink800,
    backgroundColor: colors.white,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
});
