'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAsync, formatClock, relativeTime } from '../../../lib/hooks';
import { positioningApi } from '../../../lib/api/endpoints';
import { ApiError } from '../../../lib/api/client';
import { Badge, Button, Card, CardSkeleton, EmptyState, Field, Input, KeyValue, SectionHeading } from '../../../components/ui/kit';
import { PageHeader } from '../../../components/layout/app-shell';
import { useToast } from '../../../components/ui/toast';
import type { Position, QrNode } from '../../../lib/api/types';

interface ScanResult {
  position: Position;
  qr_node: QrNode;
  at: string;
}

export default function ScanPage() {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const decodedRef = useRef(false);

  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = useAsync(() => positioningApi.current(), []);
  const nearby = useAsync(() => positioningApi.anchors(), []);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraState('idle');
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const submit = useCallback(
    async (payload: string) => {
      const trimmed = payload.trim();
      if (!trimmed) return;
      setBusy(true);
      setError(null);
      try {
        const response = await positioningApi.scan(trimmed.startsWith('CF1|') ? { payload: trimmed } : { code: trimmed });
        setResult({ position: response.position, qr_node: response.qr_node, at: new Date().toISOString() });
        current.reload();
        toast.success(`Position found · ${response.qr_node.code}`, `${response.qr_node.label}${response.qr_node.building_code ? `, Building ${response.qr_node.building_code}` : ''}`);
      } catch (caught) {
        const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'That code could not be verified.';
        setError(message);
        toast.error('Scan rejected', message);
      } finally {
        setBusy(false);
      }
    },
    [current, toast],
  );

  const startCamera = useCallback(async () => {
    if (cameraState === 'running') {
      stopCamera();
      return;
    }
    setCameraState('starting');
    setCameraError(null);
    decodedRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('running');

      const { default: jsQR } = await import('jsqr');
      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA || decodedRef.current) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
        if (decoded?.data) {
          decodedRef.current = true;
          void submit(decoded.data);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (caught) {
      setCameraState('error');
      setCameraError(caught instanceof Error ? caught.message : 'The camera could not be started.');
    }
  }, [cameraState, stopCamera, submit]);

  return (
    <div>
      <PageHeader
        title="Scan a campus code"
        description="Every QR anchor is validated against the server — the code itself can never fake your position."
        actions={
          <Link href="/map">
            <Button variant="secondary" size="sm">
              Open map
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card className="!p-0">
            <div className="relative aspect-video w-full overflow-hidden rounded-t-[var(--radius-card)] bg-ink-950">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              {cameraState !== 'running' ? (
                <div className="absolute inset-0 grid place-items-center bg-ink-950/95 px-6 text-center">
                  <div>
                    <p className="text-[14px] font-medium text-white">Point the camera at a CampusFlow QR code</p>
                    <p className="mt-1 text-[12.5px] text-white/60">
                      Codes are mounted at entrances, corridor junctions, stairs, elevators and outside every office.
                    </p>
                    <Button className="mt-4" loading={cameraState === 'starting'} onClick={() => void startCamera()}>
                      {cameraState === 'error' ? 'Try the camera again' : 'Start camera'}
                    </Button>
                    {cameraError ? <p className="mt-2 text-[12px] text-coral-300">{cameraError}</p> : null}
                  </div>
                </div>
              ) : (
                <>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="h-40 w-40 rounded-[16px] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(9,12,24,0.45)]" />
                  </div>
                  <Button className="absolute right-3 bottom-3" size="sm" variant="secondary" onClick={() => stopCamera()}>
                    Stop camera
                  </Button>
                </>
              )}
            </div>

            <div className="border-t border-ink-100 p-4">
              <Field label="Or type the code printed under the QR" htmlFor="manual-code" hint="Useful when the camera is unavailable or the code is worn.">
                <div className="flex gap-2">
                  <Input
                    id="manual-code"
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void submit(manualCode);
                    }}
                    placeholder="e.g. A-F1-ENTRANCE"
                    className="font-mono text-[13px]"
                  />
                  <Button loading={busy} onClick={() => void submit(manualCode)}>
                    Verify
                  </Button>
                </div>
              </Field>
              {error ? <p className="mt-2 text-[12.5px] text-coral-600">{error}</p> : null}
            </div>
          </Card>

          {result ? (
            <Card>
              <SectionHeading title="Position confirmed" description={`Scanned ${relativeTime(result.at)}`} />
              <dl className="divide-y divide-ink-50">
                <KeyValue label="Anchor" value={`${result.qr_node.code} · ${result.qr_node.label}`} />
                <KeyValue label="Building" value={result.qr_node.building_code ?? '—'} />
                <KeyValue label="Floor" value={result.qr_node.floor_name ?? '—'} mono />
                <KeyValue label="Plan position" value={`x ${result.qr_node.plan_x} · y ${result.qr_node.plan_y}`} mono />
                <KeyValue label="Coordinates" value={`${result.position.lat.toFixed(5)}, ${result.position.lng.toFixed(5)}`} mono />
                <KeyValue label="Valid until" value={result.position.expires_at ? formatClock(result.position.expires_at) : '30 minutes'} />
              </dl>
              <div className="mt-4 flex gap-2">
                <Link href="/navigate" className="flex-1">
                  <Button className="w-full">Navigate from here</Button>
                </Link>
                <Link href="/map" className="flex-1">
                  <Button variant="secondary" className="w-full">
                    Show on map
                  </Button>
                </Link>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeading title="Your last known position" />
            {current.loading ? (
              <CardSkeleton rows={3} />
            ) : current.data?.position ? (
              <div>
                <Badge tone="success">Verified</Badge>
                <dl className="mt-3 divide-y divide-ink-50">
                  <KeyValue label="Building" value={current.data.position.building_name ?? '—'} />
                  <KeyValue label="Floor" value={current.data.position.floor_name ?? '—'} />
                  <KeyValue label="Source" value={current.data.position.source} />
                  <KeyValue label="Updated" value={formatClock(current.data.position.updated_at)} />
                </dl>
              </div>
            ) : (
              <EmptyState title="No position yet" description="Scan a QR anchor or share your GPS position from the campus map." />
            )}
          </Card>

          <Card>
            <SectionHeading title="Campus anchors" description="Use one of these codes when the camera cannot read the printed one." />
            {nearby.loading ? (
              <CardSkeleton rows={4} />
            ) : (nearby.data?.anchors.length ?? 0) === 0 ? (
              <p className="text-[13px] text-ink-500">No anchors are within range of your last known position.</p>
            ) : (
              <ul className="space-y-2">
                {nearby.data?.anchors.map((node) => (
                  <li key={node.id} className="flex items-start justify-between gap-3 rounded-[10px] border border-ink-100 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[12.5px] font-medium text-ink-800">{node.code}</p>
                      <p className="truncate text-[12px] text-ink-500">
                        {node.label} · {node.building_code ?? '—'} {node.floor_name ? `· ${node.floor_name}` : ''}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => void submit(node.code)}>
                      Use
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeading title="How verification works" />
            <ol className="list-decimal space-y-2 pl-4 text-[12.5px] leading-relaxed text-ink-600">
              <li>Each QR encodes a signed payload that only the server can issue.</li>
              <li>The backend validates the signature and that the anchor is active.</li>
              <li>Your stored position is bound to that anchor for 30 minutes and used as the route start.</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
