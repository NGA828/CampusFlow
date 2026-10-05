import { CampusOverview } from './campus-overview';
import type { Building, Position } from '@/lib/types';

/** Expo web keeps the lightweight overview; the full responsive 3D web map lives in the Next.js client. */
export function CampusMap3D({ buildings, position, onSelect }: { buildings: Building[]; position?: Position | null; onSelect: (code: string) => void }) {
  return <CampusOverview buildings={buildings} position={position} onSelect={onSelect} />;
}
