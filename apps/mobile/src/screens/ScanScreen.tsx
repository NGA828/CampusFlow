import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ApiError, api } from '../api';
import { QrCamera } from '../components/QrCamera';
import { colours, styles } from '../theme';
import type { CampusModel, Position } from '../types';

/**
 * QR positioning.
 *
 * The camera reads an anchor printed in a corridor and the *server* resolves it: the
 * phone never decides where it is. An unrecognised code is refused rather than
 * guessed, because a wrong indoor fix sends somebody down the wrong corridor.
 *
 * Three ways in, in order of convenience: the camera, typing the code printed under
 * the QR, or picking the anchor from the list. All three hit the same endpoint.
 */
export function ScanScreen({
  onPosition,
  position,
}: {
  onPosition: (position: Position) => void;
  position: Position | null;
}) {
  const [campus, setCampus] = useState<CampusModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [scanning, setScanning] = useState(true);
  const lastCode = useRef<string | null>(null);

  useEffect(() => {
    void api<CampusModel>('/universities/iai-cameroun/campus')
      .then(setCampus)
      .catch(() => setError('Le plan du campus n’a pas pu être chargé.'));
  }, []);

  const resolve = useCallback(
    async (code: string) => {
      const normalised = code.trim().toUpperCase();
      if (!normalised || normalised === lastCode.current) return;
      lastCode.current = normalised;
      setScanning(false);
      try {
        const payload = await api<{ position: Position }>('/positioning/scan', {
          method: 'POST',
          body: { code: normalised },
        });
        onPosition(payload.position);
        setError(null);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Cette ancre n’a pas pu être lue.');
      } finally {
        setTimeout(() => {
          lastCode.current = null;
          setScanning(true);
        }, 1500);
      }
    },
    [onPosition],
  );

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
        <QrCamera active={scanning} onCode={(code) => void resolve(code)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Saisir le code</Text>
        <Text style={styles.muted}>Le code imprimé sous le QR, par exemple IAI-ADM-ENT.</Text>
        <View style={[styles.row, { alignItems: 'center' }]}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={typed}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="IAI-…"
            placeholderTextColor={colours.ink500}
            onChangeText={setTyped}
            onSubmitEditing={() => void resolve(typed)}
          />
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void resolve(typed)}>
            <Text style={styles.buttonText}>Valider</Text>
          </Pressable>
        </View>
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
