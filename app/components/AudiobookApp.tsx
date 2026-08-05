"use client";

import { useEffect, useMemo, useState } from "react";
import { books, type Book } from "../lib/content";
import { useAuth } from "../lib/auth";
import { deleteCloudBook, listCloudBooks, syncBookMetadata, updateCloudBookTitle } from "../lib/cloud-library";
import {
  claimLegacyLocalBooks,
  hasLegacyLocalBooks,
  listLocalBooks,
  removeLocalBook,
  updateLocalBookTitle,
} from "../lib/local-db";
import { readAccountActivity, writeAccountActivity } from "../lib/account-storage";
import { AccountDialog } from "./AccountDialog";
import { AppHeader } from "./AppHeader";
import { AccountAudioPlayer } from "./AccountAudioPlayer";
import { AccountSettingsView } from "./AccountSettingsView";
import { ActivityView, HomeView, LibraryView } from "./Views";
import { EdgeStudioView } from "./EdgeStudioView";
import { MobileNav, Sidebar, type ViewId } from "./Navigation";
import { AdminView } from "./AdminView";

export function AudiobookApp() {
  const auth = useAuth();
  const userId = auth.user?.id ?? "";
  const [active, setActive] = useState<ViewId>("home");
  const [query, setQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [activityBadge, setActivityBadge] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [personalBooks, setPersonalBooks] = useState<Book[]>([]);
  const [recentActivities, setRecentActivities] = useState<string[]>(() => userId ? readAccountActivity(userId) : []);
  const [storageMessage, setStorageMessage] = useState("");

  useEffect(() => {
    if (!userId) return;
    let activeRequest = true;

    const loadAccountLibrary = async () => {
      try {
        if (await hasLegacyLocalBooks()) {
          const claimed = await claimLegacyLocalBooks();
          if (claimed > 0 && activeRequest) setStorageMessage(`${claimed} buku lokal lama dipindahkan ke akun ini.`);
        }

        const localBooks = (await listLocalBooks()).map((asset) => asset.book);
        if (!activeRequest) return;
        setPersonalBooks(localBooks);
        setSelectedBook(localBooks[0] ?? null);

        const cloudBooks = await listCloudBooks();
        if (!activeRequest) return;
        setPersonalBooks((current) => {
          const localIds = new Set(current.map((book) => book.id));
          const merged = [...current, ...cloudBooks.filter((book) => !localIds.has(book.id))];
          setSelectedBook((selected) => selected ?? merged[0] ?? null);
          return merged;
        });
      } catch (error) {
        if (activeRequest) setStorageMessage(error instanceof Error ? error.message : "Data akun gagal dimuat.");
      }
    };

    void loadAccountLibrary();
    return () => { activeRequest = false; };
  }, [userId]);

  const allBooks = useMemo(() => [...personalBooks, ...books], [personalBooks]);
  const accountEmail = auth.user?.email ?? "Pengguna";

  const createdBook = async (book: Book) => {
    setPersonalBooks((current) => [book, ...current.filter((item) => item.id !== book.id)]);
    setSelectedBook(book);
    if (book.generated && userId) {
      setRecentActivities((current) => {
        const next = current.includes(book.title) ? current : [book.title, ...current];
        writeAccountActivity(userId, next);
        return next;
      });
      setActivityBadge(true);
    }
    await syncBookMetadata(book).catch(console.error);
  };

  const renameBook = async (book: Book, title: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length > 300) throw new Error("Judul harus berisi 1–300 karakter.");
    await updateCloudBookTitle(book.id, cleanTitle);
    await updateLocalBookTitle(book.id, cleanTitle);
    const updated = { ...book, title: cleanTitle };
    setPersonalBooks((current) => current.map((item) => item.id === book.id ? updated : item));
    setSelectedBook((current) => current?.id === book.id ? updated : current);
  };

  const deleteBook = async (book: Book) => {
    await deleteCloudBook(book.id);
    await removeLocalBook(book.id);
    setPersonalBooks((current) => {
      const remaining = current.filter((item) => item.id !== book.id);
      setSelectedBook((selected) => selected?.id === book.id ? remaining[0] ?? null : selected);
      return remaining;
    });
  };

  const handleLocalDataCleared = () => {
    setPersonalBooks([]);
    setSelectedBook(null);
    setRecentActivities([]);
    setActivityBadge(false);
    setStorageMessage("Seluruh data lokal akun ini telah dihapus dari perangkat.");
  };

  return (
    <div className="app-shell">
      <Sidebar active={active} onChange={setActive} profileName={accountEmail} onAccount={() => setAccountOpen(true)} isSuperadmin={auth.isSuperadmin} />
      <div className="app-column">
        <AppHeader active={active} query={query} onQuery={setQuery} onAccount={() => setAccountOpen(true)} accountLabel={accountEmail} />
        <main>
          {storageMessage && <p className="catalog-message">{storageMessage}</p>}
          {active === "home" && <HomeView allBooks={allBooks} onChange={setActive} onSelect={setSelectedBook} />}
          {active === "library" && <LibraryView allBooks={allBooks} query={query} onChange={setActive} onSelect={setSelectedBook} onRename={renameBook} onDelete={deleteBook} />}
          {active === "studio" && <EdgeStudioView onCreated={createdBook} />}
          {active === "activity" && <ActivityView recent={recentActivities} />}
          {active === "settings" && userId && <AccountSettingsView key={userId} userId={userId} />}
          {active === "admin" && auth.isSuperadmin && <AdminView />}
        </main>
        {selectedBook && userId && <AccountAudioPlayer book={selectedBook} userId={userId} />}
      </div>
      {activityBadge && active !== "activity" && (
        <button className="activity-toast" onClick={() => { setActive("activity"); setActivityBadge(false); }}>
          <span>1</span> Proses baru ditambahkan
        </button>
      )}
      <MobileNav active={active} onChange={setActive} isSuperadmin={auth.isSuperadmin} />
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} onLocalDataCleared={handleLocalDataCleared} />
    </div>
  );
}
