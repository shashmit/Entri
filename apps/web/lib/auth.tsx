"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { insforge } from "./insforge";

export type AuthUser = { id: string; email?: string; profile?: Record<string, unknown> } | null;

type SignUpResult = { requireEmailVerification: boolean; user: AuthUser };

type AuthValue = {
  user: AuthUser;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<SignUpResult>;
  verify: (email: string, otp: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => ({ requireEmailVerification: false, user: null }),
  verify: async () => {},
  signOut: async () => {},
});

async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await insforge.auth.getCurrentUser();
      if (cancelled) return;
      setUser(error ? null : ((data?.user as AuthUser) ?? null));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthValue = {
    user,
    loading,
    signIn: async (email, password) => {
      const { user } = await post("/api/auth/sign-in", { email, password });
      setUser(user as AuthUser);
    },
    signUp: async (email, password, name) => {
      return (await post("/api/auth/sign-up", { email, password, name })) as SignUpResult;
    },
    verify: async (email, otp) => {
      const { user } = await post("/api/auth/verify", { email, otp });
      setUser(user as AuthUser);
    },
    signOut: async () => {
      await post("/api/auth/sign-out", {});
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
