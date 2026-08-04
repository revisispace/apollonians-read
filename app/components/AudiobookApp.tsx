"use client";

import { useEffect, useMemo, useState } from "react";
import { books, type Book } from "../lib/content";
import { useAuth } from "../lib/auth";
import { deleteCloudBook, listCloudBooks, syncBookMetadata, updateCloudBookTitle } from "../lib/cloud-library";
import { listLocalBooks, removeLocalBook, updateLocalBookTitle } from "../lib/local-db";
import { AccountDialog } from "./AccountDialog";
import { AppHeader } from "./AppHeader";
import { AudioPlayer } from "./AudioPlayer";
import { ActivityView, HomeView, LibraryView, SettingsView, StudioView } from "./Views";
import { MobileNav, Sidebar, type ViewId } from "./Navigation";
import { AdminView } from "./AdminView";

export function AudiobookApp() {
  const [active, setActive] = useState<ViewId>("home");
  const [query, setQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book | null>(books[0] ?? null);
  const [activityBadge, setActivityBadge] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [personalBooks, setPersonalBooks] = useState<Book[]>([]);
  const [recentActivities, setRecentActivities] = useState<string[]>([]);
  const auth = useAuth();

  useEffect(() => {
    listLocalBooks().then((assets) => {
      const loaded = assets.map((asset) => asset.book);
      setPersonalBooks(loaded);
      // Kalau belum ada buku terpilih, pilih buku lokal pertama sebagai default
      setSelectedBook((current) => current ?? loaded[0] ?? null);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!auth.user) return;
    listCloudBooks().then((cloudBooks) => {
      setPersonalBooks((current) => {
        const localIds = new Set(current.map((book) => book.id));
        const merged = [...current, ...cloudBooks.filter((book) => !localIds.has(book.id))];
        // Pilih buku cloud pertama kalau belum ada pilihan
        setSelectedBook((sel) => sel ?? merged[0] ?? null);
        return merged;
      });
    }).catch(console.error);
  }, [auth.user]);

  const allBooks = useMemo(() => [...personalBooks, ...books], [personalBooks]);

  const selectBook = (book: Book) => setSelectedBook(book);

  const createdBook = async (book: Book) => {
    setPersonalBooks((current) => [book, ...current.filter((item) => item.id !== book.id)]);
    setSelectedBook(book);
    if (book.generated) {
      setRecentActivities((current) => current.includes(book.title) ? current : [book.title, ...current]);
      setActivityBadge(true);
    }
    if (auth.user) await syncBookMetadata(book).catch(console.error);
  };

  const renameBook = async (book: Book, title: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length > 300) throw new Error("Judul harus berisi 1–300 karakter.");
    if (auth.user) await updateCloudBookTitle(book.id, cleanTitle);
    await updateLocalBookTitle(book.id, cleanTitle);
    const updated = { ...book, title: cleanTitle };
    setPersonalBooks((current) => current.map((item) => item.id === book.id ? updated : item));
    setSelectedBook((current) => current?.id === book.id ? updated : current);
  };

  const deleteBook = async (book: Book) => {
    if (auth.user) await deleteCloudBook(book.id);
    await removeLocalBook(book.id);
    setPersonalBooks((current) => {
      const remaining = current.filter((item) => item.id !== book.id);
      // Kalau yang dihapus adalah buku terpilih, ganti ke buku lain (atau null)
      setSelectedBook((sel) => {
        if (sel?.id !== book.id) return sel;
        return remaining[0] ?? null;
      });
      return remaining;
    });
  };

  return (
    <div className="app-shell">
      <Sidebar active={active} onChange={setActive} profileName={auth.user?.email ?? "Mode lokal"} onAccount={() => setAccountOpen(true)} isSuperadmin={auth.isSuperadmin} />
      <div className="app-column">
        <AppHeader active={active} query={query} onQuery={setQuery} onAccount={() => setAccountOpen(true)} accountLabel={auth.user?.email ?? "Lokal"} />
        <main>
          {active === "home" && <HomeView allBooks={allBooks} onChange={setActive} onSelect={selectBook} />}
          {active === "library" && <LibraryView allBooks={allBooks} query={query} onChange={setActive} onSelect={selectBook} onRename={renameBook} onDelete={deleteBook} />}
          {active === "studio" && <StudioView onCreated={createdBook} />}
          {active === "activity" && <ActivityView recent={recentActivities} />}
          {active === "settings" && <SettingsView />}
          {active === "admin" && auth.isSuperadmin && <AdminView />}
        </main>
        {selectedBook && <AudioPlayer book={selectedBook} />}
      </div>
      {activityBadge && active !== "activity" && <button className="activity-toast" onClick={() => { setActive("activity"); setActivityBadge(false); }}><span>1</span> Proses baru ditambahkan</button>}
      <MobileNav active={active} onChange={setActive} isSuperadmin={auth.isSuperadmin} />
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}