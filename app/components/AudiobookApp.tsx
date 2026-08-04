"use client";

import { useEffect, useMemo, useState } from "react";
import { books, type Book } from "../lib/content";
import { useAuth } from "../lib/auth";
import { listCloudBooks, syncBookMetadata } from "../lib/cloud-library";
import { listLocalBooks } from "../lib/local-db";
import { AccountDialog } from "./AccountDialog";
import { AppHeader } from "./AppHeader";
import { AudioPlayer } from "./AudioPlayer";
import { ActivityView, HomeView, LibraryView, SettingsView, StudioView } from "./Views";
import { MobileNav, Sidebar, type ViewId } from "./Navigation";

export function AudiobookApp() {
  const [active, setActive] = useState<ViewId>("home");
  const [query, setQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book>(books[0]);
  const [activityBadge, setActivityBadge] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [personalBooks, setPersonalBooks] = useState<Book[]>([]);
  const [recentActivities, setRecentActivities] = useState<string[]>([]);
  const auth = useAuth();

  useEffect(() => {
    listLocalBooks().then((assets) => setPersonalBooks(assets.map((asset) => asset.book))).catch(console.error);
  }, []);

  useEffect(() => {
    if (!auth.user) return;
    listCloudBooks().then((cloudBooks) => {
      setPersonalBooks((current) => {
        const localIds = new Set(current.map((book) => book.id));
        return [...current, ...cloudBooks.filter((book) => !localIds.has(book.id))];
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

  return (
    <div className="app-shell">
      <Sidebar active={active} onChange={setActive} profileName={auth.user?.email ?? "Mode lokal"} onAccount={() => setAccountOpen(true)} />
      <div className="app-column">
        <AppHeader active={active} query={query} onQuery={setQuery} onAccount={() => setAccountOpen(true)} accountLabel={auth.user?.email ?? "Lokal"} />
        <main>
          {active === "home" && <HomeView allBooks={allBooks} onChange={setActive} onSelect={selectBook} />}
          {active === "library" && <LibraryView allBooks={allBooks} query={query} onChange={setActive} onSelect={selectBook} />}
          {active === "studio" && <StudioView onCreated={createdBook} />}
          {active === "activity" && <ActivityView recent={recentActivities} />}
          {active === "settings" && <SettingsView />}
        </main>
        <AudioPlayer book={selectedBook} />
      </div>
      {activityBadge && active !== "activity" && <button className="activity-toast" onClick={() => { setActive("activity"); setActivityBadge(false); }}><span>1</span> Proses baru ditambahkan</button>}
      <MobileNav active={active} onChange={setActive} />
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
