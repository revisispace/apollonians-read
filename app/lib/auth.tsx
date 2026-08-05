"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";

type UserRole = "user" | "superadmin";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  role: UserRole;
  isSuperadmin: boolean;
  signIn: (email: string, password: string) => Promise<string>;
  signUp: (email: string, password: string) => Promise<string>;
  sendPasswordReset: (email: string) => Promise<string>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roleState, setRoleState] = useState<{ userId: string; role: UserRole } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();

    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    const initialize = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (active) setUser(data.user);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void initialize();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) setRoleState(null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabase();

    if (!supabase || !user) {
      setRoleState(null);
      return;
    }

    let active = true;

    Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase.rpc("touch_profile"),
    ])
      .then(([profile]) => {
        if (!active) return;
        setRoleState({
          userId: user.id,
          role: profile.data?.role === "superadmin" ? "superadmin" : "user",
        });
      })
      .catch(() => {
        if (active) setRoleState({ userId: user.id, role: "user" });
      });

    return () => {
      active = false;
    };
  }, [user]);

  const role = roleState?.userId === user?.id ? roleState.role : "user";

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Layanan autentikasi belum dikonfigurasi.");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) throw error;
    return "Berhasil masuk.";
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Layanan autentikasi belum dikonfigurasi.");

    const redirectUrl = `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: redirectUrl },
    });

    if (error) throw error;

    return data.session
      ? "Akun berhasil dibuat dan kamu sudah masuk."
      : "Akun berhasil dibuat. Periksa email untuk mengonfirmasi akun sebelum masuk.";
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Layanan autentikasi belum dikonfigurasi.");

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });

    if (error) throw error;
    return "Tautan reset password telah dikirim. Periksa inbox dan folder spam.";
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Layanan autentikasi belum dikonfigurasi.");

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    setUser(null);
    setRoleState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      user,
      role,
      isSuperadmin: role === "superadmin",
      signIn,
      signUp,
      sendPasswordReset,
      signOut,
    }),
    [loading, role, sendPasswordReset, signIn, signOut, signUp, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus digunakan di dalam AuthProvider.");
  return context;
}
