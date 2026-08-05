import type { Book } from "./content";
import { normalizeBookMetadata } from "./book-metadata";
import { getSupabase } from "./supabase";

type BookRow = {
  id: string;
  title: string;
  author: string;
  category: string;
  duration_label: string;
  progress: number;
  source_name: string | null;
  generated: boolean;
  created_at: string;
  updated_at?: string | null;
};

const rowToBook = (row: BookRow): Book => normalizeBookMetadata({
  id: row.id,
  title: row.title,
  author: row.author,
  category: row.category,
  duration: row.duration_label,
  progress: row.progress,
  remaining: "Belum dimulai",
  palette: "sage",
  sourceName: row.source_name ?? undefined,
  generated: row.generated,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at,
  localOnly: false,
});

export async function listCloudBooks() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("books").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as BookRow[]).map(rowToBook);
}

export async function syncBookMetadata(book: Book) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const normalized = normalizeBookMetadata(book);
  const updatedAt = normalized.updatedAt ?? new Date().toISOString();
  const { error } = await supabase.from("books").upsert({
    id: normalized.id,
    user_id: userData.user.id,
    title: normalized.title,
    author: normalized.author,
    category: normalized.category,
    duration_label: normalized.duration,
    progress: normalized.progress,
    source_name: normalized.sourceName ?? null,
    generated: Boolean(normalized.generated),
    created_at: normalized.createdAt ?? updatedAt,
    updated_at: updatedAt,
  });
  if (error) throw error;
}

export async function updateCloudBookTitle(id: string, title: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("books").update({ title, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteCloudBook(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("books").delete().eq("id", id);
  if (error) throw error;
}
