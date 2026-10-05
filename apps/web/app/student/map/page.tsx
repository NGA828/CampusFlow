'use client';

import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useRequireRole } from '@/lib/session';
import { CampusMap } from '@/components/campus-map';
import type { CampusModel, IndoorRoute } from '@/lib/types';

interface Position {
  nodeId: string;
  label: string;
  buildingName: string;
  floorName: string;
  source: string;
  fixedAt: string;
}

/**
 * Navigation on the web.
 *
 * The phone scans a printed QR anchor with its camera; a laptop has no camera pointed
 * at a corridor wall, so here the anchor is chosen from the list of anchors that
 * actually exist on the campus. Either way the position comes back from the same
 * `POST /positioning/scan`, and the route is computed by the server.
 */
export default function StudentMapPage() {
  const { user, loading } = useRequireRole('STUDENT');
  const [campus, setCampus] = useState<CampusModel | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [destination, setDestination] = useState('');
  const [stepFree, setStepFree] = useState(false);
  const [route, setRoute] = useState<IndoorRoute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void api<CampusModel>(`/universities/${user.universitySlug}/campus`)
      .then((payload) => {
        setCampus(payload);
        setDestination(payload.rooms[0]?.id ?? '');
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof ApiError && caught.status === 404
            ? 'Your institution is not mapped indoors yet. IAI Cameroun is the pilot campus.'
            : 'The campus model could not be loaded.',
        ),
      );
  }, [user]);

  if (loading || !user) {
    return (
      <main className="shell" style={{ paddingBlock: 40 }}>
        <div className="skeleton" style={{ maxWidth: 280, height: 26 }} />
      </main>
    );
  }

  async function scan(code: string) {
    setError(null);
    setNotice(null);
    try {
      const payload = await api<{ position: Position }>('/positioning/scan', { method: 'POST', body: { code } });
      setPosition(payload.position);
      setNotice(`Position fixed at ${payload.position.label} (${payload.position.floorName}).`);
      setRoute(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That anchor could not be read.');
    }
  }

  async function plan() {
    if (!position) {
      setError('Scan or select a QR anchor first — a route needs a starting point.');
      return;
    }
    setError(null);
    try {
      const payload = await api<{ route: IndoorRoute }>('/navigation/route', {
        method: 'POST',
        body: { from: position.nodeId, to: destination, stepFree },
      });
      setRoute(payload.route);
      setNotice(null);
    } catch (caught) {
      setRoute(null);
      setError(caught instanceof ApiError ? caught.message : 'The route could not be computed.');
    }
  }

  return (
    <main className="shell" style={{ paddingBlock: 36 }}>
      <p className="eyebrow">Navigation</p>
      <h1 style={{ marginTop: 8 }}>Campus map & indoor routes</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 720 }}>
        {campus
          ? `${campus.university.name} — ${campus.buildings.length} buildings, ${campus.rooms.length} rooms and ${campus.anchors.length} QR anchors mapped.`
          : 'Loading the campus model…'}
      </p>

      {error ? <p className="notice noticeError" style={{ marginTop: 14 }}>{error}</p> : null}
      {notice ? <p className="notice noticeOk" style={{ marginTop: 14 }}>{notice}</p> : null}

      {campus ? (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(300px, 400px) 1fr', marginTop: 20, alignItems: 'start' }}>
          <div className="grid" style={{ gap: 14 }}>
            <section className="card">
              <p className="eyebrow">1 · Where you are</p>
              <h2 style={{ marginTop: 6, fontSize: 18 }}>Scan a QR anchor</h2>
              <p className="muted" style={{ marginTop: 6 }}>
                On mobile this is the camera. Here, choose the anchor printed next to you.
              </p>
              <div className="grid" style={{ gap: 6, marginTop: 12 }}>
                {campus.anchors.map((anchor) => (
                  <button
                    key={anchor.code}
                    type="button"
                    className={`btn btnSmall ${position?.nodeId === anchor.nodeId ? '' : 'btnGhost'}`}
                    style={{ justifyContent: 'space-between' }}
                    onClick={() => void scan(anchor.code)}
                  >
                    <span>{anchor.label}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{anchor.code}</span>
                  </button>
                ))}
              </div>
              {position ? (
                <p className="notice" style={{ marginTop: 12 }}>
                  <strong>{position.label}</strong>
                  <br />
                  {position.buildingName} · {position.floorName} · fixed {new Date(position.fixedAt).toLocaleTimeString('en-GB')}
                </p>
              ) : null}
            </section>

            <section className="card">
              <p className="eyebrow">2 · Where you are going</p>
              <label className="field" style={{ marginTop: 10 }}>
                <span>Destination</span>
                <select value={destination} onChange={(event) => setDestination(event.target.value)}>
                  {campus.rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.code} — {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                <input
                  type="checkbox"
                  checked={stepFree}
                  onChange={(event) => setStepFree(event.target.checked)}
                  style={{ width: 18, minHeight: 18 }}
                />
                <span style={{ fontSize: 13.5 }}>Step-free route only (lift instead of stairs)</span>
              </label>
              <button type="button" className="btn" style={{ width: '100%' }} onClick={() => void plan()}>
                Compute the route
              </button>
            </section>

            {route ? (
              <section className="card">
                <p className="eyebrow">Your route</p>
                <h2 style={{ marginTop: 6, fontSize: 18 }}>
                  {route.totalDistanceMetres} m · about {route.estimatedMinutes} min
                  {route.stepFree ? ' · step-free' : ''}
                </h2>
                <ol className="steps" style={{ marginTop: 12 }}>
                  {route.steps.map((step) => (
                    <li key={step.nodeId}>
                      <span>
                        {step.instruction}
                        <span className="muted"> · {step.floorName}{step.distanceMetres > 0 ? ` · ${step.distanceMetres} m` : ''}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>

          <CampusMap campus={campus} route={route} positionNodeId={position?.nodeId ?? null} />
        </div>
      ) : null}
    </main>
  );
}
