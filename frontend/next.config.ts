import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.e2b.app"],
  /**
   * The generic screens this restructure removed (`/dashboard`, `/timetable`, `/map`, `/queue`,
   * `/offices`, `/announcements`, `/profile`, `/assistant`) answered every role with one page — the
   * thing being fixed. They redirect rather than render, so an old bookmark still reaches a person, but
   * reaches *their own* screen; the destination then survives the server's role check, so a staff link
   * to `/student/timetable` bounces to `/staff/dashboard` instead of leaking a student view.
   *
   * `/scan` and `/navigate` get no redirect at all: scanning and live wayfinding are mobile
   * capabilities, and a browser has no honest destination to send them to.
   */
  async redirects() {
    // /account and /notifications are genuine shared routes, not student redirects.
    return [
      { source: "/dashboard", destination: "/student/dashboard", permanent: false },
      { source: "/timetable", destination: "/student/timetable", permanent: false },
      { source: "/map", destination: "/student/campus/map", permanent: false },
      { source: "/rooms", destination: "/student/campus/rooms", permanent: false },
      { source: "/rooms/:code", destination: "/student/campus/rooms/:code", permanent: false },
      { source: "/queue", destination: "/student/services/queues", permanent: false },
      { source: "/offices", destination: "/student/services/offices", permanent: false },
      { source: "/offices/:code", destination: "/student/services/offices/:code", permanent: false },
      { source: "/offices/tickets/:id", destination: "/student/services/offices/tickets/:id", permanent: false },
      { source: "/announcements", destination: "/student/announcements", permanent: false },
      { source: "/events", destination: "/student/campus/events", permanent: false },
      { source: "/assistant", destination: "/student/assistant", permanent: false },
      { source: "/staff", destination: "/staff/dashboard", permanent: false },
      { source: "/admin", destination: "/admin/dashboard", permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://127.0.0.1:8001/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
