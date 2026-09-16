import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AdaptiveRow, Badge, Button, Card, Eyebrow, H3, KeyValue, Screen, Small, Title } from '@/components/ui';
import { ApiError, positioningApi } from '@/lib/api';
import { PageIntro, Notice, IconTile } from '@/components/visual';
import { ScanSweep } from '@/components/motion';
import { colors, radius, relativeTime, spacing } from '@/lib/theme';
import type { Position } from '@/lib/types';

export default function ScanScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const [manualOpen, setManualOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState('');
  const [payload, setPayload] = useState('');
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(true);
  const lastScan = useRef<{ value: string; at: number } | null>(null);

  const submit = async (body: { payload?: string; code?: string }) => {
    if (busy) return;
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
    <Screen bottomSafeArea={false}>
      <PageIntro eyebrow="Find your place" title="Scan. Locate. Go." description="Point your camera at a CampusFlow QR anchor. We'll take it from there." icon="qr-code-outline" />

      <View style={styles.padded}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {permission?.granted && scanning && focused ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={busy ? undefined : onBarcode}
            />
          ) : (
            <View style={[styles.camera, styles.cameraFallback]}>
              <View style={{ padding: 18, borderWidth: 1, borderColor: '#5c6788', borderRadius: 24 }}><Ionicons name="qr-code-outline" size={68} color="#c3ccff" /></View>
              <Small style={{ marginTop: spacing.sm, textAlign: 'center', color: '#c7cde5' }}>
                {permission?.granted
                  ? 'Camera paused. Scan again or enter the code manually.'
                  : 'Camera access is needed to read the anchor. You can also type the code printed below the QR.'}
              </Small>
              {!permission?.granted ? (
                <Button label="Allow camera" variant="secondary" onPress={() => void requestPermission()} style={{ marginTop: spacing.md }} />
              ) : null}
            </View>
          )}
          {permission?.granted && scanning && focused ? <><View pointerEvents="none" style={{ position: 'absolute', top: 28, bottom: 28, left: 28, right: 28, borderWidth: 2, borderColor: '#9ce6d6', borderRadius: 24 }} /><ScanSweep active={!busy} /></> : null}
        </Card>
        <View style={{ marginTop: 12 }}><Notice icon="shield-checkmark-outline" title={busy ? 'Verifying your anchor…' : 'A trusted starting point'}>Your camera finds the code. The campus API verifies your location before you continue.</Notice></View>

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
            <AdaptiveRow style={styles.actions}>
              <Button label="Campus map" variant="secondary" onPress={() => router.push('/student/map' as any)} style={{ flex: 1 }} />
              <Button label="Scan again" onPress={() => { setPosition(null); setScanning(true); setError(null); }} style={{ flex: 1 }} />
            </AdaptiveRow>
          </Card>
        ) : null}

        {error ? (
          <Card style={{ marginTop: spacing.lg, borderColor: colors.coral100, backgroundColor: colors.coral100 }}>
            <H3 style={{ color: colors.coral600 }}>Anchor rejected</H3>
            <Small style={{ color: colors.coral600, marginTop: 4 }}>{error}</Small>
            <Badge tone="coral">QR_UNKNOWN · QR_INACTIVE · SIGNATURE_INVALID · VERSION_MISMATCH</Badge>
          </Card>
        ) : null}

        <Button label={manualOpen ? 'Hide manual entry' : 'Enter code manually'} variant="secondary" onPress={() => setManualOpen((value) => !value)} style={{ marginTop: 20 }} />
        {manualOpen ? <Card style={{ marginTop: spacing.lg }}>
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
        </Card> : null}
        <View style={{ gap: 16, paddingVertical: 24 }}>
          {[
            ['01', 'Find an anchor', 'Look for a CampusFlow QR sign at an entrance or room.'],
            ['02', 'Hold steady', 'Keep the code inside the frame until it is verified.'],
            ['03', 'Continue your day', 'Use your confirmed position to find your next room.'],
          ].map(([step, title, detail]) => <View key={step} style={{ flexDirection: 'row', gap: 14 }}><View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}><Small style={{ color: colors.brand700, fontWeight: '800' }}>{step}</Small></View><View style={{ flex: 1 }}><H3>{title}</H3><Small style={{ marginTop: 3 }}>{detail}</Small></View></View>)}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  padded: { paddingHorizontal: 20 },
  camera: { width: '100%', aspectRatio: 4 / 3, maxHeight: 360, backgroundColor: colors.ink900 },
  cameraFallback: { aspectRatio: undefined, minHeight: 220, maxHeight: undefined, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.ink900 },
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
  actions: { marginTop: spacing.lg },
});
