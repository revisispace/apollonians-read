import { getSupabase } from "./supabase";

export type ProfileRow = {
  id: string;
  email: string | null;
  role: "user" | "superadmin";
  status: "active" | "suspended";
  daily_character_limit: number;
  created_at: string;
  last_seen_at: string;
};

export type UsageRow = {
  id: number;
  user_id: string;
  engine: "piper" | "edge";
  characters: number;
  status: "reserved" | "completed" | "failed";
  created_at: string;
};

export type AppSettings = {
  edge_tts_enabled: boolean;
  default_daily_character_limit: number;
  global_daily_character_limit: number;
};

export type AdminDashboardData = {
  profiles: ProfileRow[];
  usage: UsageRow[];
  bookCount: number;
  settings: AppSettings;
};

const defaultSettings: AppSettings = {
  edge_tts_enabled: true,
  default_daily_character_limit: 200000,
  global_daily_character_limit: 2000000,
};

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = getSupabase();
  if (!supabase) return defaultSettings;

  const { data, error } = await supabase
    .from("app_settings")
    .select("edge_tts_enabled, default_daily_character_limit, global_daily_character_limit")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) return defaultSettings;
  return data as AppSettings;
}

export async function loadAdminDashboard(): Promise<AdminDashboardData> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [profiles, usage, books, settings] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,role,status,daily_character_limit,created_at,last_seen_at")
      .order("last_seen_at", { ascending: false }),
    supabase
      .from("usage_events")
      .select("id,user_id,engine,characters,status,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("books").select("id", { count: "exact", head: true }),
    getAppSettings(),
  ]);

  if (profiles.error) throw profiles.error;
  if (usage.error) throw usage.error;
  if (books.error) throw books.error;

  return {
    profiles: profiles.data as ProfileRow[],
    usage: usage.data as UsageRow[],
    bookCount: books.count ?? 0,
    settings,
  };
}

export async function updateUserControls(
  id: string,
  changes: Partial<Pick<ProfileRow, "status" | "daily_character_limit">>,
) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");

  const { error } = await supabase.from("profiles").update(changes).eq("id", id);
  if (error) throw error;
}

export async function updateAppSettings(settings: AppSettings) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");

  const { data } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("app_settings")
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
      updated_by: data.user?.id ?? null,
    })
    .eq("id", true);

  if (error) throw error;
}
