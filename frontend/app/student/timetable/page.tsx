import type { Metadata } from "next";
import { Timetable } from "@/features/timetable/timetable";

export const metadata: Metadata = { title: "Schedule" };

export default function TimetablePage() {
  return <Timetable />;
}
