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

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  role: "user" | "superadmin";
  isSuperadmin: boolean;
  signIn: (email: string, password: string) => Promise<string>;
  signUp: (email: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roleState, setRoleState] = useState<{ userId: string; role: "user" | "superadmin" } | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user);
        setLoading(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !user) return;
    let active = true;
    Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase.rpc("touch_profile"),
    ]).then(([profile]) => {
      if (active) setRoleState({ userId: user.id, role: profile.data?.role === "superadmin" ? "superadmin" : "user" });
    }).catch(() => {
      if (active) setRoleState({ userId: user.id, role: "user" });
    });
    return () => { active = false; };
  }, [user]);

  const role = roleState && roleState.userId === user?.id ? roleState.role : "user";

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return "Berhasil masuk.";
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.href.split("#")[0] },
    });
    if (error) throw error;
    return data.session
      ? "Akun berhasil dibuat."
      : "Akun dibuat. Periksa email untuk mengonfirmasi pendaftaran.";
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({ configured: isSupabaseConfigured, loading, user, role, isSuperadmin: role === "superadmin", signIn, signUp, signOut }),
    [loading, role, signIn, signOut, signUp, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus digunakan di dalam AuthProvider.");
  return context;
}
