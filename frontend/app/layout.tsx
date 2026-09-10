import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { DemoBanner } from "@/components/layout/demo-banner";

export const metadata: Metadata = {
  title: {
    default: "CampusFlow — Navigate. Learn. Connect.",
    template: "%s · CampusFlow",
  },
  description:
    "CampusFlow is an intelligent campus management, navigation and student-services platform: live timetables, indoor wayfinding, room admission queues and administrative office tickets in one connected experience.",
  applicationName: "CampusFlow",
};

export const viewport: Viewport = {
  themeColor: "#254beb",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
