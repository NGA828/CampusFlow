import { Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { styles } from '../theme';

/**
 * Native QR reader.
 *
 * It reports the raw code and nothing else: the *server* decides what the code means,
 * because a phone guessing its own indoor position sends people down wrong corridors.
 */
export function QrCamera({ active, onCode }: { active: boolean; onCode: (code: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) return <Text style={[styles.muted, { padding: 16 }]}>Préparation de la caméra…</Text>;

  if (!permission.granted) {
    return (
      <View style={{ padding: 16, gap: 10 }}>
        <Text style={styles.muted}>
          CampusFlow a besoin de la caméra pour lire les ancres QR. Sans autorisation, choisissez une ancre dans la liste
          ci-dessous.
        </Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void requestPermission()}>
          <Text style={styles.buttonText}>Autoriser la caméra</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <CameraView
      style={{ flex: 1 }}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={active ? (result) => onCode(result.data.trim().toUpperCase()) : undefined}
    />
  );
}
