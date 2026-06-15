"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

type Mode = "signin" | "signup" | "verify";

export default function SignIn() {
  const { signIn, signUp, verify } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        router.push("/today");
      } else if (mode === "signup") {
        const { requireEmailVerification } = await signUp(email, password, name || undefined);
        if (requireEmailVerification) setMode("verify");
        else router.push("/today");
      } else {
        await verify(email, otp);
        router.push("/today");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-5 py-10">
      <div className="w-full max-w-[380px]">
        <Link href="/" className="font-display font-bold tracking-tight text-2xl block mb-6">
          entri<span className="text-marigold-deep">.</span>
        </Link>

        <h1 className="font-display font-semibold text-[26px] tracking-tight mb-1">
          {mode === "signin" ? "Welcome back." : mode === "signup" ? "Start studying." : "Check your email."}
        </h1>
        <p className="text-muted text-[13.5px] mb-6">
          {mode === "verify"
            ? `We sent a 6-digit code to ${email}.`
            : "Your own notes, taken seriously."}
        </p>

        <form onSubmit={handle} className="card p-5 flex flex-col gap-3">
          {mode === "verify" ? (
            <input
              className="field"
              aria-label="6-digit verification code"
              placeholder="6-digit code"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          ) : (
            <>
              {mode === "signup" && (
                <input
                  className="field"
                  aria-label="Name"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
              <input
                className="field"
                aria-label="Email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                className="field"
                aria-label="Password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </>
          )}

          {error && (
            <p role="alert" className="text-[13px] text-brick">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-p w-full mt-1 disabled:opacity-60">
            {busy
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Verify & continue"}
          </button>
        </form>

        {mode !== "verify" && (
          <p className="text-[13px] text-muted mt-4 text-center">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button
              className="font-semibold text-marigold-deep hover:underline"
              onClick={() => {
                setError(null);
                setMode(mode === "signin" ? "signup" : "signin");
              }}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
