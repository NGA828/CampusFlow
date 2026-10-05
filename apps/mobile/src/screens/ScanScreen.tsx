import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ApiError, api } from '../api';
import { colours, styles } from '../theme';
import type { CampusModel, Position } from '../types';

/**
 * QR positioning.
 *
 * The camera reads an anchor printed in a corridor and the *server* resolves it: the
 * phone never decides where it is. An unrecognised code is refused rather than
 * guessed, because a wrong indoor fix sends somebody down the wrong corridor.
 */
export function ScanScreen({ onPosition, position }: { onPosition: (position: Position) => void; position: Position | null }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [campus, setCampus] = useState<CampusModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const lastCode = useRef<string | null>(null);

  useEffect(() => {
    void api<CampusModel>('/universities/iai-cameroun/campus')
      .then(setCampus)
      .catch(() => setError('The campus model could not be loaded.'));
  }, []);

  async function resolve(code: string) {
    if (code === lastCode.current) return;
    lastCode.current = code;
    setScanning(false);
    try {
      const payload = await api<{ position: Position }>('/positioning/scan', { method: 'POST', body: { code } });
      onPosition(payload.position);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That anchor could not be read.');
    } finally {
      setTimeout(() => {
        lastCode.current = null;
        setScanning(true);
      }, 1500);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Position</Text>
      <Text style={styles.title}>Scanner une ancre QR</Text>
      <Text style={styles.subtitle}>
        Visez le QR code affiché dans le couloir. Votre position intérieure est fixée par le serveur, pas devinée par le
        téléphone.
      </Text>

      {error ? <Text style={[styles.notice, styles.noticeError]}>{error}</Text> : null}

      {position ? (
        <Text style={[styles.notice, styles.noticeOk]}>
          Position : {position.label} — {position.buildingName}, {position.floorName}
        </Text>
      ) : null}

      <View style={styles.map}>
        {!permission ? (
          <Text style={[styles.muted, { padding: 16 }]}>Préparation de la caméra…</Text>
        ) : !permission.granted ? (
          <View style={{ padding: 16, gap: 10 }}>
            <Text style={styles.muted}>
              CampusFlow a besoin de la caméra pour lire les ancres QR. Sans autorisation, choisissez une ancre dans la liste
              ci-dessous.
            </Text>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => void requestPermission()}>
              <Text style={styles.buttonText}>Autoriser la caméra</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanning ? (result) => void resolve(result.data.trim().toUpperCase()) : undefined}
          />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ancres de ce campus</Text>
        <Text style={styles.muted}>Sans caméra, sélectionnez l’ancre affichée à côté de vous.</Text>
        {(campus?.anchors ?? []).map((anchor) => (
          <Pressable
            key={anchor.code}
            accessibilityRole="button"
            style={[styles.button, styles.buttonGhost, position?.nodeId === anchor.nodeId && { borderColor: colours.brand }]}
            onPress={() => void resolve(anchor.code)}
          >
            <Text style={styles.buttonGhostText}>{anchor.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
