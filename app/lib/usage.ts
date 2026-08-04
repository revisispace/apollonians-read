import { getSupabase } from "./supabase";

export type UsageReservation = { id: number | null; enforced: boolean };

export async function reserveUsage(characters: number, engine: "piper" | "qwen", bookId?: string): Promise<UsageReservation> {
  const supabase = getSupabase();
  if (!supabase) return { id: null, enforced: false };
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    if (engine === "qwen") throw new Error("Masuk ke akun untuk memakai Qwen dan kuota server.");
    return { id: null, enforced: false };
  }
  const { data, error } = await supabase.rpc("reserve_generation", {
    requested_characters: characters,
    requested_engine: engine,
    requested_book_id: bookId ?? null,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      if (engine === "qwen") throw new Error("Skema kuota belum dipasang di Supabase.");
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
