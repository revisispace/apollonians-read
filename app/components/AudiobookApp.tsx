"use client";

import { useEffect, useMemo, useState } from "react";
import { books, type Book } from "../lib/content";
import { useAuth } from "../lib/auth";
import { deleteCloudBook, listCloudBooks, syncBookMetadata, updateCloudBookTitle } from "../lib/cloud-library";
import { mergeBookMetadata, normalizeBookMetadata } from "../lib/book-metadata";
import { appendAudioChunk, claimLegacyLocalBooks, hasLegacyLocalBooks, listLocalBooks, removeLocalBook, updateLocalBookTitle } from "../lib/local-db";
import { recoverActiveEdgeJobs } from "../lib/edge-tts";
import { readAccountActivity, writeAccountActivity } from "../lib/account-storage";
import { AccountDialog } from "./AccountDialog";
import { AppHeader, type HeaderNotification, type HeaderSearchResult } from "./AppHeader";
import { AccountAudioPlayer } from "./AccountAudioPlayer";
import { AccountSettingsView } from "./AccountSettingsView";
import { ActivityView, HomeView, LibraryView } from "./Views";
import { EdgeStudioView } from "./EdgeStudioView";
import { LibriVoxView } from "./LibriVoxView";
import { MobileNav, Sidebar, type ViewId } from "./Navigation";
import { AdminView } from "./AdminView";

const makeNotification = (title: string, detail: string, target?: ViewId): HeaderNotification => ({ id: crypto.randomUUID(), title, detail, unread: true, target });
const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

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
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const pushNotification = (title: string, detail: string, target?: ViewId) => setNotifications((current) => [makeNotification(title, detail, target), ...current].slice(0, 20));

  useEffect(() => {
    if (!userId) return;
    let activeRequest = true;
    const loadAccountLibrary = async () => {
      try {
        if (await hasLegacyLocalBooks()) {
          const claimed = await claimLegacyLocalBooks();
          if (claimed > 0 && activeRequest) {
            const message = `${claimed} buku lokal lama dipindahkan ke akun ini.`;
            setStorageMessage(message); pushNotification("Buku lokal dipulihkan", message, "library");
          }
        }
        const recovery = await recoverActiveEdgeJobs(userId, (job, chunk) => appendAudioChunk(job.bookId, chunk));
        if (recovery.recovered > 0 && activeRequest) {
          const message = `${recovery.recovered} bagian audio dari proses sebelumnya berhasil dipulihkan.`;
          setStorageMessage(message); pushNotification("Audio berhasil dipulihkan", message, "library");
        } else if (recovery.pending > 0 && activeRequest) {
          const message = `${recovery.pending} proses audio sebelumnya masih berjalan dan akan diperiksa lagi.`;
          setStorageMessage(message); pushNotification("Proses audio masih berjalan", message, "activity");
        }
        const localAssets = await listLocalBooks();
        const localBooks = localAssets.map((asset) => normalizeBookMetadata({ ...asset.book, updatedAt: asset.updatedAt, localOnly: true }, asset.audioChunks.length));
        const cloudBooks = await listCloudBooks();
        if (!activeRequest) return;
        const cloudById = new Map(cloudBooks.map((book) => [book.id, book]));
        const mergedLocal = localBooks.map((book) => { const cloud = cloudById.get(book.id); if (!cloud) return book; cloudById.delete(book.id); return mergeBookMetadata(book, cloud); });
        const merged = [...mergedLocal, ...cloudById.values()].sort((a, b) => (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? ""));
        setPersonalBooks(merged);
        setSelectedBook((selected) => selected ? merged.find((book) => book.id === selected.id) ?? merged[0] ?? null : merged[0] ?? null);
        await Promise.allSettled(mergedLocal.map((book) => syncBookMetadata(book)));
      } catch (error) {
        if (activeRequest) { const message = error instanceof Error ? error.message : "Data akun gagal dimuat."; setStorageMessage(message); pushNotification("Data akun gagal dimuat", message, "library"); }
      }
    };
    void loadAccountLibrary();
    return () => { activeRequest = false; };
  }, [userId]);

  const allBooks = useMemo(() => [...personalBooks, ...books], [personalBooks]);
  const searchResults = useMemo<HeaderSearchResult[]>(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return [];
    return allBooks.filter((book) => `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(clean)).slice(0, 8).map((book) => ({ id: book.id, title: book.title, subtitle: `${book.author} · ${book.category}` }));
  }, [allBooks, query]);
  const accountEmail = auth.user?.email ?? "Pengguna";

  const createdBook = async (book: Book) => {
    const normalized = normalizeBookMetadata({ ...book, updatedAt: new Date().toISOString() });
    setPersonalBooks((current) => [normalized, ...current.filter((item) => item.id !== normalized.id)]); setSelectedBook(normalized);
    if (normalized.generated && userId) {
      setRecentActivities((current) => { const next = current.includes(normalized.title) ? current : [normalized.title, ...current]; writeAccountActivity(userId, next); return next; });
      setActivityBadge(true); pushNotification("Audiobook selesai dibuat", `${normalized.title} siap didengarkan.`, "library");
    }
    await syncBookMetadata(normalized).catch(console.error);
  };
  const renameBook = async (book: Book, title: string) => {
    const cleanTitle = title.trim(); if (!cleanTitle || cleanTitle.length > 300) throw new Error("Judul harus berisi 1–300 karakter.");
    const updatedAt = new Date().toISOString(); await updateCloudBookTitle(book.id, cleanTitle); await updateLocalBookTitle(book.id, cleanTitle);
    const updated = normalizeBookMetadata({ ...book, title: cleanTitle, updatedAt });
    setPersonalBooks((current) => current.map((item) => item.id === book.id ? updated : item)); setSelectedBook((current) => current?.id === book.id ? updated : current);
    pushNotification("Judul buku diperbarui", `“${book.title}” diubah menjadi “${cleanTitle}”.`, "library");
  };
  const deleteBook = async (book: Book) => {
    await deleteCloudBook(book.id); await removeLocalBook(book.id);
    setPersonalBooks((current) => { const remaining = current.filter((item) => item.id !== book.id); setSelectedBook((selected) => selected?.id === book.id ? remaining[0] ?? null : selected); return remaining; });
    pushNotification("Buku dihapus", `“${book.title}” dan audio lokalnya telah dihapus.`, "library");
  };
  const handleAudioRemoved = (bookIds: string[], removedBytes: number) => {
    const ids = new Set(bookIds); const updateBook = (book: Book) => ids.has(book.id) ? normalizeBookMetadata({ ...book, generated: false, updatedAt: new Date().toISOString() }, 0) : book;
    setPersonalBooks((current) => current.map(updateBook)); setSelectedBook((current) => current ? updateBook(current) : current);
    const message = `${formatBytes(removedBytes)} audio lokal dibersihkan dari ${bookIds.length} buku. Metadata buku tetap tersedia.`; setStorageMessage(message); pushNotification("Penyimpanan dibersihkan", message, "settings");
  };
  const handleLocalDataCleared = () => { setPersonalBooks([]); setSelectedBook(null); setRecentActivities([]); setActivityBadge(false); setStorageMessage("Seluruh data lokal akun ini telah dihapus dari perangkat."); pushNotification("Data lokal dihapus", "Seluruh buku, audio, bookmark, dan progres lokal akun ini telah dihapus.", "settings"); };
  const selectSearchResult = (id: string) => { const book = allBooks.find((item) => item.id === id); if (!book) return; setSelectedBook(book); setActive("library"); setQuery(""); };
  const openNotification = (notification: HeaderNotification) => { setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, unread: false } : item)); if (notification.target) setActive(notification.target); };

  return <div className="app-shell">
    <Sidebar active={active} onChange={setActive} profileName={accountEmail} onAccount={() => setAccountOpen(true)} isSuperadmin={auth.isSuperadmin} />
    <div className="app-column">
      <AppHeader active={active} query={query} onQuery={setQuery} searchResults={searchResults} onSelectSearchResult={selectSearchResult} notifications={notifications} onOpenNotification={openNotification} onMarkAllNotificationsRead={() => setNotifications((current) => current.map((item) => ({ ...item, unread: false })))} onAccount={() => setAccountOpen(true)} accountLabel={accountEmail} />
      <main>
        {storageMessage && active !== "librivox" && <p className="catalog-message">{storageMessage}</p>}
        {active === "home" && <HomeView allBooks={allBooks} onChange={setActive} onSelect={setSelectedBook} />}
        {active === "library" && <LibraryView allBooks={allBooks} query={query} onChange={setActive} onSelect={setSelectedBook} onRename={renameBook} onDelete={deleteBook} />}
        {active === "librivox" && userId && <LibriVoxView userId={userId} />}
        {active === "studio" && <EdgeStudioView onCreated={createdBook} />}
        {active === "activity" && <ActivityView recent={recentActivities} />}
        {active === "settings" && userId && <AccountSettingsView key={userId} userId={userId} onAudioRemoved={handleAudioRemoved} />}
        {active === "admin" && auth.isSuperadmin && <AdminView />}
      </main>
      {active !== "librivox" && selectedBook && userId && <AccountAudioPlayer book={selectedBook} userId={userId} />}
    </div>
    {activityBadge && active !== "activity" && <button className="activity-toast" onClick={() => { setActive("activity"); setActivityBadge(false); }}><span>1</span> Proses baru ditambahkan</button>}
    <MobileNav active={active} onChange={setActive} isSuperadmin={auth.isSuperadmin} />
    <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} onLocalDataCleared={handleLocalDataCleared} />
  </div>;
}
