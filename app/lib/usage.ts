import { getSupabase } from "./supabase";

export type UsageReservation = { id: number | null; enforced: boolean };
export type UsageEngine = "piper" | "qwen";

export async function reserveUsage(
  characters: number,
  engine: UsageEngine,
  bookId?: string,
): Promise<UsageReservation> {
  const supabase = getSupabase();
  if (!supabase) return { id: null, enforced: false };

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    if (engine === "qwen") throw new Error("Masuk ke akun untuk memakai Edge TTS dan kuota server.");
    return { id: null, enforced: false };
  }

  const { data, error } = await supabase.rpc("reserve_generation", {
    requested_characters: characters,
    requested_engine: engine,
    requested_book_id: bookId ?? null,
  });

  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      if (engine === "qwen") throw new Error("Skema kuota server belum tersedia di Supabase.");
      return { id: null, enforced: false };
    }
    throw error;
  }

  return { id: Number(data), enforced: true };
}

export async function finishUsage(id: number | null, succeeded: boolean) {
  if (id === null) return;
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.rpc("finish_generation", { event_id: id, succeeded });
  if (error) throw error;
}

export type QuotaInfo = {
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  percentUsed: number;
};

export async function getQuotaInfo(): Promise<QuotaInfo | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const { data, error } = await supabase.rpc("get_quota_info");
  if (error || !data || data.length === 0) return null;

  const row = data[0] as { daily_limit: number; used_today: number };
  const remaining = Math.max(0, row.daily_limit - row.used_today);
  return {
    dailyLimit: row.daily_limit,
    usedToday: row.used_today,
    remaining,
    percentUsed: row.daily_limit > 0 ? (row.used_today / row.daily_limit) * 100 : 0,
  };
}
