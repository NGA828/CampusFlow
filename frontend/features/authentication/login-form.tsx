"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { isMockMode } from "@/lib/api/config";
import { setSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const session = await authApi.login({ email, password });
      setSession(session);

      const destination =
        session.user.role === "student" ? "/student/dashboard" : "/coming-soon";
      router.replace(destination);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fieldErrors) setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError("Unable to sign in. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          {formError}
        </div>
      ) : null}

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@campusflow.app"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email?.[0]}
        required
      />

      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password?.[0]}
        required
      />

      <Button type="submit" fullWidth size="lg" loading={loading}>
        Sign in
      </Button>

      {isMockMode ? (
        <div className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-xs text-ink-600">
          <p className="font-semibold text-ink-800">Demo credentials</p>
          <p className="mt-1">
            Student: <span className="font-mono">greyson@campusflow.app</span>
          </p>
          <p>
            Password: <span className="font-mono">campusflow</span>
          </p>
        </div>
      ) : null}
    </form>
  );
}
