import type { Metadata } from 'next';
import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SessionProvider } from '@/lib/session';
import { TopBar } from '@/components/top-bar';

export const metadata: Metadata = {
  title: 'CampusFlow — Yaoundé',
  description:
    'Discover the universities of Yaoundé, navigate the IAI Cameroun campus indoors and out, book an administrative room and follow campus life.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <TopBar />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
