import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/layout/brand";
import { LoginForm } from "@/features/authentication/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-brand-50 to-transparent" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="mb-4">
            <LogoMark className="h-12 w-12 rounded-xl" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Sign in to your CampusFlow account
          </p>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-lifted">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-ink-500">
          New to CampusFlow?{" "}
          <span className="font-medium text-brand-600">Registration opens soon.</span>
        </p>
      </div>
    </div>
  );
}
