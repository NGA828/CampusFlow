import { CampusOverview } from './campus-overview';
import type { Building } from '@/lib/types';

/** Expo web keeps the lightweight overview; the full responsive 3D web map lives in the Next.js client. */
export function CampusMap3D({ buildings, onSelect }: { buildings: Building[]; onSelect: (code: string) => void }) {
  return <CampusOverview buildings={buildings} onSelect={onSelect} />;
}
