import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'CampusFlow — Navigate. Learn. Connect.',
    template: '%s · CampusFlow',
  },
  description:
    'CampusFlow is a campus management, indoor navigation and student services platform: personalised timetables, QR-assisted wayfinding, room admission queues and administrative office ticketing.',
  applicationName: 'CampusFlow',
};

export const viewport: Viewport = {
  themeColor: '#101527',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-ink-50 text-ink-800 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
