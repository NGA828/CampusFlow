import { isMockMode } from "@/lib/api/config";

/**
 * Visible only while running against the development mock.
 * This is the honest, clearly-marked indicator required by the project's
 * "no fake functionality" rule: demo data is never presented as real data.
 */
export function DemoBanner() {
  if (!isMockMode) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-800">
      Demo mode — showing development data. The Laravel API is not connected
      yet (set <span className="font-mono">NEXT_PUBLIC_API_URL</span> to go
      live).
    </div>
  );
}
