import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { styles } from '../theme';

/**
 * Web QR reader.
 *
 * The browser gives the camera through getUserMedia and, where it exists, decodes QR
 * codes with the platform's own BarcodeDetector. Where it does not exist (Firefox,
 * Safari, Linux Chrome) the component says so plainly instead of pretending to scan —
 * the anchor list below the camera stays the honest way in.
 */
interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export function QrCamera({ active, onCode }: { active: boolean; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<string | null>('Démarrage de la caméra…');
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    void (async () => {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch {
        setStatus('Caméra indisponible dans ce navigateur. Choisissez une ancre dans la liste ci-dessous.');
        return;
      }
      if (stopped) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      if (video.current) {
        video.current.srcObject = stream;
        await video.current.play().catch(() => undefined);
      }

      if (!Detector) {
        setStatus('Ce navigateur ne sait pas décoder les QR codes. Utilisez la liste d’ancres ou l’application native.');
        return;
      }

      const detector = new Detector({ formats: ['qr_code'] });
      setStatus(null);

      const tick = async () => {
        if (stopped) return;
        if (activeRef.current && video.current && video.current.readyState >= 2) {
          try {
            const [found] = await detector.detect(video.current);
            if (found?.rawValue) onCode(found.rawValue.trim().toUpperCase());
          } catch {
            /* a dropped frame is not an error worth showing */
          }
        }
        frame = window.setTimeout(tick, 400);
      };
      void tick();
    })();

    return () => {
      stopped = true;
      window.clearTimeout(frame);
      if (stream) for (const track of stream.getTracks()) track.stop();
    };
  }, [onCode]);

  return (
    <View style={{ flex: 1 }}>
      <video ref={video} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {status ? (
        <Text style={[styles.muted, { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(255,255,255,.92)' }]}>
          {status}
        </Text>
      ) : null}
    </View>
  );
}
