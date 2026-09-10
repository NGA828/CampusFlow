import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import { IconBuilding } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Portal in progress" };

export default function ComingSoonPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-md">
        <EmptyState
          icon={<IconBuilding className="h-5 w-5" />}
          title="This portal is under construction"
          message="Staff and administrator dashboards are being built in upcoming phases. The student experience is live now."
          action={
            <Link
              href="/login"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Switch account
            </Link>
          }
        />
      </div>
    </div>
  );
}
