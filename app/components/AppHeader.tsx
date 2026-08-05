"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BookOpenText, CheckCheck, Menu, Search, X } from "lucide-react";
import type { ViewId } from "./Navigation";

const titles: Record<ViewId, string> = {
  home: "Beranda",
  library: "Perpustakaan",
  studio: "Studio audio",
  activity: "Aktivitas",
  settings: "Pengaturan",
  admin: "Superadmin",
};

export type HeaderSearchResult = {
  id: string;
  title: string;
  subtitle: string;
};

export type HeaderNotification = {
  id: string;
  title: string;
  detail: string;
  unread: boolean;
  target?: ViewId;
};

type AppHeaderProps = {
  active: ViewId;
  query: string;
  onQuery: (query: string) => void;
  searchResults: HeaderSearchResult[];
  onSelectSearchResult: (id: string) => void;
  notifications: HeaderNotification[];
  onOpenNotification: (notification: HeaderNotification) => void;
  onMarkAllNotificationsRead: () => void;
  onAccount: () => void;
  accountLabel: string;
};

export function AppHeader({
  active,
  query,
  onQuery,
  searchResults,
  onSelectSearchResult,
  notifications,
  onOpenNotification,
  onMarkAllNotificationsRead,
  onAccount,
  accountLabel,
}: AppHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const unreadCount = notifications.filter((item) => item.unread).length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setNotificationsOpen(false);
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openSearch = () => {
    setSearchOpen(true);
    setNotificationsOpen(false);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  return (
    <header className="app-header">
      <div className="mobile-title"><Menu size={22} /><strong>{titles[active]}</strong></div>

      <div className={`header-search ${searchOpen ? "is-open" : ""}`}>
        <label className="search-field">
          <Search size={18} />
          <input
            ref={searchInputRef}
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => { onQuery(event.target.value); setSearchOpen(true); }}
            placeholder="Cari buku, penulis, atau kategori..."
            aria-label="Cari buku, penulis, atau kategori"
            aria-expanded={searchOpen}
          />
          {query ? <button type="button" className="search-clear" onClick={() => onQuery("")} aria-label="Hapus pencarian"><X size={15} /></button> : <kbd>⌘ K</kbd>}
        </label>
        {searchOpen && (
          <div className="search-popover" role="dialog" aria-label="Hasil pencarian">
            <div className="search-popover-head"><strong>Pencarian</strong><button onClick={() => setSearchOpen(false)} aria-label="Tutup pencarian"><X size={17} /></button></div>
            {!query.trim() ? (
              <p>Ketik judul, penulis, atau kategori buku.</p>
            ) : searchResults.length ? (
              <div className="search-results">
                {searchResults.map((result) => (
                  <button key={result.id} onClick={() => { onSelectSearchResult(result.id); setSearchOpen(false); }}>
                    <BookOpenText size={18} />
                    <span><strong>{result.title}</strong><small>{result.subtitle}</small></span>
                  </button>
                ))}
              </div>
            ) : <p>Tidak ada buku yang cocok dengan “{query.trim()}”.</p>}
          </div>
        )}
      </div>

      <button className="icon-button mobile-search-button" onClick={openSearch} aria-label="Buka pencarian"><Search size={19} /></button>

      <div className="notification-wrap">
        <button
          className="icon-button notification-button"
          onClick={() => { setNotificationsOpen((current) => !current); setSearchOpen(false); }}
          aria-label={`Notifikasi${unreadCount ? `, ${unreadCount} belum dibaca` : ""}`}
          aria-expanded={notificationsOpen}
        >
          <Bell size={19} />
          {unreadCount > 0 && <span className="notification-dot">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </button>
        {notificationsOpen && (
          <div className="notification-popover" role="dialog" aria-label="Daftar notifikasi">
            <div className="notification-popover-head">
              <div><strong>Notifikasi</strong><small>{unreadCount ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"}</small></div>
              <button onClick={onMarkAllNotificationsRead} disabled={!unreadCount} aria-label="Tandai semua sudah dibaca"><CheckCheck size={18} /></button>
            </div>
            {notifications.length ? notifications.map((notification) => (
              <button key={notification.id} className={notification.unread ? "unread" : ""} onClick={() => { onOpenNotification(notification); setNotificationsOpen(false); }}>
                <span className="notification-state" />
                <span><strong>{notification.title}</strong><small>{notification.detail}</small></span>
              </button>
            )) : <p>Belum ada notifikasi.</p>}
          </div>
        )}
      </div>

      <button className="header-avatar" onClick={onAccount} aria-label={`Akun: ${accountLabel}`}>{accountLabel.slice(0, 2).toUpperCase()}</button>
    </header>
  );
}
