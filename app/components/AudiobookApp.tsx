"use client";

import { useState } from "react";
import { books, type Book } from "../lib/content";
import { AppHeader } from "./AppHeader";
import { AudioPlayer } from "./AudioPlayer";
import { ActivityView, HomeView, LibraryView, SettingsView, StudioView } from "./Views";
import { MobileNav, Sidebar, type ViewId } from "./Navigation";

export function AudiobookApp() {
  const [active, setActive] = useState<ViewId>("home");
  const [query, setQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book>(books[0]);
  const [activityBadge, setActivityBadge] = useState(false);

  const selectBook = (book: Book) => setSelectedBook(book);

  return (
    <div className="app-shell">
      <Sidebar active={active} onChange={setActive} />
      <div className="app-column">
        <AppHeader active={active} query={query} onQuery={setQuery} />
        <main>
          {active === "home" && <HomeView onChange={setActive} onSelect={selectBook} />}
          {active === "library" && <LibraryView query={query} onChange={setActive} onSelect={selectBook} />}
          {active === "studio" && <StudioView onCreated={() => setActivityBadge(true)} />}
          {active === "activity" && <ActivityView />}
          {active === "settings" && <SettingsView />}
        </main>
        <AudioPlayer book={selectedBook} />
      </div>
      {activityBadge && active !== "activity" && <button className="activity-toast" onClick={() => { setActive("activity"); setActivityBadge(false); }}><span>1</span> Proses baru ditambahkan</button>}
      <MobileNav active={active} onChange={setActive} />
    </div>
  );
}
