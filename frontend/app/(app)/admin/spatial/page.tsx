'use client';

import { useMemo, useState } from 'react';
import { useAsync, useDebounced, formatClock } from '@/lib/hooks';
import { adminApi, campusApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Badge, Button, ConfirmDialog, Field, Input, Modal, SectionHeading, Select, Tabs, Textarea } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { ResourceTable, type Column } from '@/components/admin/table';
import { FloorPlan } from '@/components/maps/floor-plan';
import { useToast } from '@/components/ui/toast';
import type { Geofence, NavigationEdge, NavigationNode, QrNode, Room } from '@/lib/api/types';

type Tab = 'qr' | 'nodes' | 'edges' | 'geofences' | 'plan';

const NODE_KINDS = ['corridor', 'junction', 'entrance', 'exit', 'stairs', 'elevator', 'room', 'outdoor', 'qr', 'service'] as const;
const EDGE_KINDS = ['corridor', 'stairs', 'elevator', 'ramp', 'door', 'outdoor', 'service'] as const;

export default function AdminSpatialPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('qr');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 250);
  const [buildingId, setBuildingId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [payload, setPayload] = useState<{ code: string; payload: string; scan_url: string } | null>(null);
  const [form, setForm] = useState<{ kind: 'qr' | 'node' | 'edge' | 'geofence'; values: Record<string, string> } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: Tab; id: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const buildings = useAsync(() => campusApi.buildings(), []);
  const buildingOptions = buildings.data?.buildings ?? [];
  const building = useAsync(() => (buildingId ? campusApi.building(buildingId) : Promise.resolve(null)), [buildingId]);
  const floors = building.data?.floors ?? [];
  const activeFloorId = floorId || floors[0]?.id || '';
  const plan = useAsync(() => (activeFloorId ? campusApi.floorPlan(activeFloorId) : Promise.resolve(null)), [activeFloorId]);

  const qrNodes = useAsync(() => adminApi.qrNodes({ per_page: 100, q: debounced || undefined }), [debounced]);
  const navNodes = useAsync(() => adminApi.navigationNodes({ per_page: 200 }), []);
  const navEdges = useAsync(() => adminApi.navigationEdges({ per_page: 300 }), []);
  const geofences = useAsync(() => adminApi.geofences({ per_page: 100 }), []);

  const nodeOptions = navNodes.data?.items ?? [];

  const floorQr = useMemo(() => (plan.data?.qr_nodes ?? []) as QrNode[], [plan.data]);
  const floorNodes = useMemo(() => (plan.data?.navigation_nodes ?? []) as NavigationNode[], [plan.data]);
  const floorEdges = useMemo(() => (plan.data?.navigation_edges ?? []) as NavigationEdge[], [plan.data]);

  const openCreate = (kind: 'qr' | 'node' | 'edge' | 'geofence') => {
    setFormError(null);
    const base: Record<string, string> = {};
    if (kind === 'qr') Object.assign(base, { code: '', label: '', building_id: buildingId || buildingOptions[0]?.id || '', floor_id: activeFloorId, plan_x: '0', plan_y: '0' });
    if (kind === 'node') Object.assign(base, { code: '', label: '', floor_id: activeFloorId, kind: 'corridor', plan_x: '0', plan_y: '0' });
    if (kind === 'edge') Object.assign(base, { from_node_id: '', to_node_id: '', kind: 'corridor', distance_m: '5', is_accessible: 'true' });
    if (kind === 'geofence') Object.assign(base, { name: '', target_type: 'room', target_id: '', radius_m: '25', purpose: 'check_in' });
    setForm({ kind, values: base });
  };

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      toast.success(message);
      qrNodes.reload();
      navNodes.reload();
      plan.reload();
    } catch (caught) {
      toast.error('Action failed', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Please try again.');
    }
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      if (form.kind === 'qr') {
        await adminApi.createQrNode({
          code: form.values.code,
          label: form.values.label,
          building_id: form.values.building_id,
          floor_id: form.values.floor_id,
          plan_x: Number(form.values.plan_x),
          plan_y: Number(form.values.plan_y),
        });
        qrNodes.reload();
        plan.reload();
      }
      if (form.kind === 'node') {
        await adminApi.createNavigationNode({
          code: form.values.code,
          label: form.values.label,
          floor_id: form.values.floor_id || undefined,
          kind: form.values.kind,
          plan_x: Number(form.values.plan_x),
          plan_y: Number(form.values.plan_y),
        });
        navNodes.reload();
        plan.reload();
      }
      if (form.kind === 'edge') {
        await adminApi.createNavigationEdge({
          from_node_id: form.values.from_node_id,
          to_node_id: form.values.to_node_id,
          kind: form.values.kind,
          distance_m: Number(form.values.distance_m),
          is_accessible: form.values.is_accessible === 'true',
        });
        navEdges.reload();
        plan.reload();
      }
      if (form.kind === 'geofence') {
        await adminApi.createGeofence({
          name: form.values.name,
          target_type: form.values.target_type,
          target_id: form.values.target_id,
          radius_m: Number(form.values.radius_m),
          purpose: form.values.purpose,
        });
        geofences.reload();
      }
      toast.success('Created');
      setForm(null);
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not create the record.';
      setFormError(message);
      toast.error('Create failed', message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === 'qr') await adminApi.deleteQrNode(pendingDelete.id);
      if (pendingDelete.kind === 'nodes') await adminApi.deleteNavigationNode(pendingDelete.id);
      if (pendingDelete.kind === 'edges') await adminApi.deleteNavigationEdge(pendingDelete.id);
      if (pendingDelete.kind === 'geofences') await adminApi.deleteGeofence(pendingDelete.id);
      toast.success('Removed');
      qrNodes.reload();
      navNodes.reload();
      navEdges.reload();
      geofences.reload();
      plan.reload();
    } catch (caught) {
      toast.error('Delete failed', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Remove dependent edges or rooms first.');
    } finally {
      setPendingDelete(null);
    }
  };

  const moveRoom = async (room: Room, position: { x: number; y: number }) => {
    try {
      await adminApi.updateRoom(room.id, { plan_x: position.x, plan_y: position.y });
      plan.reload();
    } catch (caught) {
      toast.error('Could not move the room', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Try again.');
    }
  };

  const qrColumns: Column<QrNode>[] = [
    { key: 'code', header: 'Code', render: (row) => <span className="font-mono font-medium text-ink-800">{row.code}</span> },
    { key: 'label', header: 'Label', render: (row) => row.label },
    { key: 'where', header: 'Location', render: (row) => `${row.building_code ?? '—'} · ${row.floor_name ?? '—'}` },
    { key: 'plan', header: 'Plan', render: (row) => <span className="font-mono text-[12px] text-ink-500">{row.plan_x}, {row.plan_y}</span> },
    { key: 'version', header: 'Version', render: (row) => <Badge tone="neutral">v{row.version}</Badge> },
    { key: 'scans', header: 'Scans', align: 'right', render: (row) => <span className="tnum">{row.scans_count ?? 0}</span> },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'active' : 'disabled'}</Badge> },
  ];

  const nodeColumns: Column<NavigationNode>[] = [
    { key: 'code', header: 'Code', render: (row) => <span className="font-mono font-medium text-ink-800">{row.code}</span> },
    { key: 'label', header: 'Label', render: (row) => row.label },
    { key: 'kind', header: 'Kind', render: (row) => <Badge tone={row.kind === 'elevator' ? 'success' : row.kind === 'stairs' ? 'warning' : 'neutral'}>{row.kind}</Badge> },
    { key: 'plan', header: 'Plan', render: (row) => <span className="font-mono text-[12px] text-ink-500">{row.plan_x ?? '—'}, {row.plan_y ?? '—'}</span> },
    { key: 'accessible', header: 'Accessible', render: (row) => (row.is_accessible ? <Badge tone="success">yes</Badge> : <span className="text-[12px] text-ink-400">no</span>) },
  ];

  const edgeColumns: Column<NavigationEdge>[] = [
    {
      key: 'from',
      header: 'From',
      render: (row) => <span className="font-mono text-[12px]">{nodeOptions.find((node) => node.id === row.from_node_id)?.code ?? row.from_node_id.slice(0, 8)}</span>,
    },
    {
      key: 'to',
      header: 'To',
      render: (row) => <span className="font-mono text-[12px]">{nodeOptions.find((node) => node.id === row.to_node_id)?.code ?? row.to_node_id.slice(0, 8)}</span>,
    },
    { key: 'kind', header: 'Kind', render: (row) => <Badge tone={row.floor_change ? 'warning' : 'neutral'}>{row.kind}</Badge> },
    { key: 'distance', header: 'Distance', align: 'right', render: (row) => <span className="tnum">{row.distance_m.toFixed(1)} m</span> },
    { key: 'accessible', header: 'Step-free', render: (row) => (row.is_accessible ? <Badge tone="success">yes</Badge> : <span className="text-[12px] text-ink-400">no</span>) },
  ];

  const geofenceColumns: Column<Geofence>[] = [
    { key: 'name', header: 'Name', render: (row) => row.name },
    { key: 'target', header: 'Target', render: (row) => <Badge tone="neutral">{row.target_type}</Badge> },
    { key: 'radius', header: 'Radius', align: 'right', render: (row) => <span className="tnum">{row.radius_m} m</span> },
    { key: 'purpose', header: 'Purpose', render: (row) => row.purpose },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'active' : 'off'}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Navigation & QR"
        description="QR anchors, the walking graph and geofences. The plan editor writes room geometry straight back to the database."
      />

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'qr', label: 'QR anchors', count: qrNodes.data?.items.length },
            { value: 'nodes', label: 'Graph nodes', count: navNodes.data?.items.length },
            { value: 'edges', label: 'Graph edges', count: navEdges.data?.items.length },
            { value: 'geofences', label: 'Geofences', count: geofences.data?.items.length },
            { value: 'plan', label: 'Plan editor' },
          ]}
        />
      </div>

      {tab === 'qr' ? (
        <ResourceTable
          rows={qrNodes.data?.items ?? []}
          columns={qrColumns}
          loading={qrNodes.loading}
          error={qrNodes.error}
          onRetry={qrNodes.reload}
          search={{ value: search, onChange: setSearch, placeholder: 'Search anchors' }}
          onCreate={() => openCreate('qr')}
          createLabel="New anchor"
          rowActions={(row) => (
            <div className="flex justify-end gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    const result = await adminApi.qrPayload(row.id);
                    setPayload({ code: row.code, payload: result.payload, scan_url: result.scan_url });
                  } catch {
                    toast.error('Could not load the payload');
                  }
                }}
              >
                Payload
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void runAction(() => adminApi.regenerateQr(row.id), 'Anchor regenerated')}>
                Regenerate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: 'qr', id: row.id, label: row.code })}>
                Remove
              </Button>
            </div>
          )}
        />
      ) : null}

      {tab === 'nodes' ? (
        <ResourceTable
          rows={navNodes.data?.items ?? []}
          columns={nodeColumns}
          loading={navNodes.loading}
          error={navNodes.error}
          onRetry={navNodes.reload}
          onCreate={() => openCreate('node')}
          createLabel="New node"
          rowActions={(row) => (
            <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: 'nodes', id: row.id, label: row.code })}>
              Remove
            </Button>
          )}
        />
      ) : null}

      {tab === 'edges' ? (
        <ResourceTable
          rows={navEdges.data?.items ?? []}
          columns={edgeColumns}
          loading={navEdges.loading}
          error={navEdges.error}
          onRetry={navEdges.reload}
          onCreate={() => openCreate('edge')}
          createLabel="New edge"
          rowActions={(row) => (
            <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: 'edges', id: row.id, label: `${row.kind} edge` })}>
              Remove
            </Button>
          )}
        />
      ) : null}

      {tab === 'geofences' ? (
        <ResourceTable
          rows={geofences.data?.items ?? []}
          columns={geofenceColumns}
          loading={geofences.loading}
          error={geofences.error}
          onRetry={geofences.reload}
          onCreate={() => openCreate('geofence')}
          createLabel="New geofence"
          rowActions={(row) => (
            <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: 'geofences', id: row.id, label: row.name })}>
              Remove
            </Button>
          )}
        />
      ) : null}

      {tab === 'plan' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Building" htmlFor="editor-building">
              <Select
                id="editor-building"
                value={buildingId}
                onChange={(event) => {
                  setBuildingId(event.target.value);
                  setFloorId('');
                }}
              >
                <option value="">Select a building…</option>
                {buildingOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.code} · {option.name}
                  </option>
                ))}
              </Select>
            </Field>
            {floors.length > 0 ? (
              <Field label="Floor" htmlFor="editor-floor">
                <Select id="editor-floor" value={activeFloorId} onChange={(event) => setFloorId(event.target.value)}>
                  {floors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.name} (level {floor.level})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {plan.data ? (
              <div className="mb-1 flex gap-2">
                <Badge tone="neutral">{floorQr.length} anchors</Badge>
                <Badge tone="neutral">{floorNodes.length} nodes</Badge>
                <Badge tone="neutral">{floorEdges.length} edges</Badge>
              </div>
            ) : null}
          </div>

          {!buildingId ? (
            <SectionHeading title="Pick a building" description="Choose a building and floor to edit its plan." />
          ) : plan.error ? (
            <p className="text-[13px] text-coral-600">{plan.error}</p>
          ) : !plan.data ? (
            <p className="text-[13px] text-ink-500">Loading floor plan…</p>
          ) : (
            <>
              <FloorPlan
                plan={plan.data}
                showGraph
                showQr
                editable
                onMoveRoom={(room, position) => void moveRoom(room, position)}
                onSelectRoom={(room) => toast.info(`${room.code} · ${room.name}`, `Drag the room to reposition it. Current size ${room.plan_w}×${room.plan_h} m.`)}
                className="h-[520px]"
              />
              <p className="text-[12px] text-ink-500">
                Positions are saved in metres with the origin at the building’s north-west corner, matching the navigation graph. Last loaded {formatClock(new Date().toISOString())}.
              </p>
            </>
          )}
        </div>
      ) : null}

      <Modal open={payload !== null} onClose={() => setPayload(null)} title="QR payload" footer={<Button onClick={() => setPayload(null)}>Close</Button>}>
        {payload ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-600">
              Print this payload for anchor <strong className="font-semibold">{payload.code}</strong>. The signature is validated server-side on every scan.
            </p>
            <Textarea readOnly rows={3} value={payload.payload} className="font-mono text-[12px]" />
            {payload.scan_url ? <Textarea readOnly rows={2} value={payload.scan_url} className="font-mono text-[11.5px]" /> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form ? `New ${form.kind === 'qr' ? 'QR anchor' : form.kind === 'node' ? 'graph node' : form.kind === 'edge' ? 'graph edge' : 'geofence'}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void save()}>
              Create
            </Button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {form.kind === 'qr' || form.kind === 'node' ? (
              <>
                <Field label="Code" htmlFor="spatial-code" error={formError}>
                  <Input id="spatial-code" value={form.values.code} onChange={(event) => setForm({ ...form, values: { ...form.values, code: event.target.value } })} />
                </Field>
                <Field label="Label" htmlFor="spatial-label">
                  <Input id="spatial-label" value={form.values.label} onChange={(event) => setForm({ ...form, values: { ...form.values, label: event.target.value } })} />
                </Field>
                {form.kind === 'qr' ? (
                  <Field label="Building" htmlFor="spatial-building">
                    <Select id="spatial-building" value={form.values.building_id} onChange={(event) => setForm({ ...form, values: { ...form.values, building_id: event.target.value } })}>
                      {buildingOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.code} · {option.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <Field label="Kind" htmlFor="spatial-kind">
                    <Select id="spatial-kind" value={form.values.kind} onChange={(event) => setForm({ ...form, values: { ...form.values, kind: event.target.value } })}>
                      {NODE_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label="Floor" htmlFor="spatial-floor">
                  <Select id="spatial-floor" value={form.values.floor_id} onChange={(event) => setForm({ ...form, values: { ...form.values, floor_id: event.target.value } })}>
                    <option value="">Select a floor…</option>
                    {floors.map((floor) => (
                      <option key={floor.id} value={floor.id}>
                        {floor.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Plan x (m)" htmlFor="spatial-x">
                  <Input id="spatial-x" value={form.values.plan_x} onChange={(event) => setForm({ ...form, values: { ...form.values, plan_x: event.target.value } })} />
                </Field>
                <Field label="Plan y (m)" htmlFor="spatial-y">
                  <Input id="spatial-y" value={form.values.plan_y} onChange={(event) => setForm({ ...form, values: { ...form.values, plan_y: event.target.value } })} />
                </Field>
              </>
            ) : null}

            {form.kind === 'edge' ? (
              <>
                <Field label="From node" htmlFor="edge-from" error={formError}>
                  <Select id="edge-from" value={form.values.from_node_id} onChange={(event) => setForm({ ...form, values: { ...form.values, from_node_id: event.target.value } })}>
                    <option value="">Select…</option>
                    {nodeOptions.slice(0, 200).map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.code} · {node.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="To node" htmlFor="edge-to">
                  <Select id="edge-to" value={form.values.to_node_id} onChange={(event) => setForm({ ...form, values: { ...form.values, to_node_id: event.target.value } })}>
                    <option value="">Select…</option>
                    {nodeOptions.slice(0, 200).map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.code} · {node.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Kind" htmlFor="edge-kind">
                  <Select id="edge-kind" value={form.values.kind} onChange={(event) => setForm({ ...form, values: { ...form.values, kind: event.target.value } })}>
                    {EDGE_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Distance (m)" htmlFor="edge-distance" hint="Leave 0 to let the server compute it.">
                  <Input id="edge-distance" value={form.values.distance_m} onChange={(event) => setForm({ ...form, values: { ...form.values, distance_m: event.target.value } })} />
                </Field>
                <Field label="Step-free" htmlFor="edge-accessible">
                  <Select id="edge-accessible" value={form.values.is_accessible} onChange={(event) => setForm({ ...form, values: { ...form.values, is_accessible: event.target.value } })}>
                    <option value="true">Yes — usable on accessible routes</option>
                    <option value="false">No — stairs or restricted</option>
                  </Select>
                </Field>
              </>
            ) : null}

            {form.kind === 'geofence' ? (
              <>
                <Field label="Name" htmlFor="geofence-name" error={formError}>
                  <Input id="geofence-name" value={form.values.name} onChange={(event) => setForm({ ...form, values: { ...form.values, name: event.target.value } })} />
                </Field>
                <Field label="Target type" htmlFor="geofence-target-type">
                  <Select id="geofence-target-type" value={form.values.target_type} onChange={(event) => setForm({ ...form, values: { ...form.values, target_type: event.target.value } })}>
                    {['room', 'office', 'building', 'qr_node'].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Target id" htmlFor="geofence-target" hint="UUID of the room, office, building or anchor.">
                  <Input id="geofence-target" value={form.values.target_id} onChange={(event) => setForm({ ...form, values: { ...form.values, target_id: event.target.value } })} className="font-mono text-[12px]" />
                </Field>
                <Field label="Radius (m)" htmlFor="geofence-radius">
                  <Input id="geofence-radius" value={form.values.radius_m} onChange={(event) => setForm({ ...form, values: { ...form.values, radius_m: event.target.value } })} />
                </Field>
                <Field label="Purpose" htmlFor="geofence-purpose">
                  <Select id="geofence-purpose" value={form.values.purpose} onChange={(event) => setForm({ ...form, values: { ...form.values, purpose: event.target.value } })}>
                    {['presence', 'queue_join', 'check_in', 'navigation'].map((purpose) => (
                      <option key={purpose} value={purpose}>
                        {purpose}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this record?"
        message={pendingDelete ? `“${pendingDelete.label}” will be deleted from the navigation graph.` : ''}
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
