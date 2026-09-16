import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './workspace.module.css';

export type WorkspaceIconName = 'compass' | 'calendar' | 'queue' | 'shield' | 'sparkles' | 'office' | 'arrow' | 'eye' | 'eye-off' | 'room' | 'grid' | 'list' | 'clock' | 'pin' | 'bulletin';
const paths: Record<WorkspaceIconName, ReactNode> = {
  room: <><path d="M4 21h16M6 21V4h12v17M6 4l9-2v19" /><circle cx="12" cy="12" r=".5" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <path d="M3 5h2m4 0h12M3 12h2m4 0h12M3 19h2m4 0h12" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  pin: <><path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  bulletin: <><path d="M4 9h5l11-5v16L9 15H4V9Zm5 6 2 6H7l-2-6M9 9v6" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-3 5-5 3 3-5 5-3Z" /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16M8 15h2m4 0h2m-8 3h2" /></>,
  queue: <><path d="M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Z" /><path d="M14 8v2m0 4v2" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  sparkles: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /><path d="M20 2v4m-2-2h4" /></>,
  office: <><path d="M5 21V5l7-2 7 2v16M3 21h18M9 7h1m4 0h1M9 11h1m4 0h1m-5 10v-6h4v6" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  'eye-off': <><path d="m3 3 18 18M9 5.5A11 11 0 0 1 12 5c6 0 10 7 10 7a20 20 0 0 1-3 4M6 6C3.5 8 2 12 2 12s4 7 10 7c1.5 0 3-.4 4.2-1M10 10a3 3 0 0 0 4 4" /></>,
};
export function WorkspaceIcon({ name, size = 22, strokeWidth = 1.6 }: { name: WorkspaceIconName; size?: number; strokeWidth?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function WorkspaceBrand() {
  return <Link href="/" className={styles.authBrand}><span><WorkspaceIcon name="compass" size={25} /></span><span>CampusFlow</span></Link>;
}
export function WorkspaceSpotlight({ eyebrow, title, description, tone = 'brand', icon = 'compass', campus = false, links = [] }: {
  eyebrow: string; title: string; description: string; tone?: 'brand' | 'ink' | 'mint'; icon?: WorkspaceIconName; campus?: boolean; links?: { href: string; label: string }[];
}) {
  return <section className={styles.spotlight} data-tone={tone}>
    <div className={styles.spotlightCopy}><div className={styles.eyebrow}>{eyebrow}</div><h2>{title}</h2><p>{description}</p>{links.length > 0 ? <div className={styles.linkRow}>{links.map((link) => <Link key={link.href} href={link.href} className={styles.actionLink}>{link.label}<WorkspaceIcon name="arrow" size={16} /></Link>)}</div> : null}</div>
    {campus ? <Image src="/images/campus-workspace.webp" width={1100} height={733} alt="" className={styles.spotlightImage} sizes="(max-width:767px) 100vw, 400px" /> : <div className={styles.operationalArt} aria-hidden="true"><div className={styles.orbit}><span><WorkspaceIcon name={icon} size={38} /></span></div></div>}
  </section>;
}
export function WorkspaceFeature({ title, description, icon = 'compass', tone = 'brand', link }: { title: string; description: string; icon?: WorkspaceIconName; tone?: 'brand' | 'mint'; link?: { href: string; label: string } }) {
  return <section className={styles.featureStrip} data-tone={tone}><div className={styles.featureStripCopy}><span className={styles.iconTile}><WorkspaceIcon name={icon} /></span><div><h2>{title}</h2><p>{description}</p></div></div>{link ? <Link href={link.href} className={styles.actionLink}>{link.label}<WorkspaceIcon name="arrow" size={16} /></Link> : null}</section>;
}
