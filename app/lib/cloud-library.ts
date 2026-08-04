import type { Book } from "./content";
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
};

const rowToBook = (row: BookRow): Book => ({
  id: row.id,
  title: row.title,
  author: row.author,
  category: row.category,
  duration: row.duration_label,
  progress: row.progress,
  remaining: row.progress ? `${100 - row.progress}% tersisa` : "Belum dimulai",
  palette: "sage",
  sourceName: row.source_name ?? undefined,
  generated: row.generated,
  createdAt: row.created_at,
  localOnly: false,
});

export async function listCloudBooks() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("books").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as BookRow[]).map(rowToBook);
}

export async function syncBookMetadata(book: Book) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const { error } = await supabase.from("books").upsert({
    id: book.id,
    user_id: userData.user.id,
    title: book.title,
    author: book.author,
    category: book.category,
    duration_label: book.duration,
    progress: book.progress,
    source_name: book.sourceName ?? null,
    generated: Boolean(book.generated),
    created_at: book.createdAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
