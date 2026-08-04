import { Bell, Menu, Search } from "lucide-react";
import type { ViewId } from "./Navigation";

const titles: Record<ViewId, string> = {
  home: "Beranda",
  library: "Perpustakaan",
  studio: "Studio audio",
  activity: "Aktivitas",
  settings: "Pengaturan",
};

type AppHeaderProps = {
  active: ViewId;
  query: string;
  onQuery: (query: string) => void;
};

export function AppHeader({ active, query, onQuery }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="mobile-title"><Menu size={22} /><strong>{titles[active]}</strong></div>
      <label className="search-field">
        <Search size={18} />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Cari buku, penulis, atau kategori..." />
        <kbd>⌘ K</kbd>
      </label>
      <button className="icon-button notification-button" aria-label="Notifikasi"><Bell size={19} /><span /></button>
      <span className="header-avatar">NZ</span>
    </header>
  );
}
