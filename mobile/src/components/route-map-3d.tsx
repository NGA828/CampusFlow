import type { MobileRouteLeg } from '@/lib/api';
/** Native MapLibre has no Expo-web runtime; the responsive Next.js client supplies the web 3D route map. */
export function RouteMap3D(_: { legs: MobileRouteLeg[] }) { return null; }
