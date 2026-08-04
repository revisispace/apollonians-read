"use client";

import { Activity, BookOpen, Home, MoreHorizontal, Settings, ShieldCheck, WandSparkles } from "lucide-react";

export type ViewId = "home" | "library" | "studio" | "activity" | "settings" | "admin";

type NavItem = { id: ViewId; label: string; icon: typeof Home };

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Beranda", icon: Home },
  { id: "library", label: "Perpustakaan", icon: BookOpen },
  { id: "studio", label: "Buat audio", icon: WandSparkles },
  { id: "activity", label: "Aktivitas", icon: Activity },
  { id: "settings", label: "Pengaturan", icon: Settings },
];

export function Sidebar({ active, onChange, profileName, onAccount, isSuperadmin }: {
  active: ViewId;
  onChange: (view: ViewId) => void;
  profileName: string;
  onAccount: () => void;
  isSuperadmin: boolean;
}) {
  const initials = profileName.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "LO";
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onChange("home")} aria-label="Apollonians Read — kembali ke beranda">
        <img className="brand-logo" src="apollonians_read_brand/logo-primary-reversed.svg" alt="Apollonians Read" />
      </button>
      <nav className="side-nav">
        {NAV_ITEMS.map((item) => (
          <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => onChange(item.id)}>
            <item.icon size={18} /> {item.label}
          </button>
        ))}
        {isSuperadmin && (
          <button className={active === "admin" ? "active" : ""} onClick={() => onChange("admin")}>
            <ShieldCheck size={18} /> Superadmin
          </button>
        )}
      </nav>
      <div className="storage-card">
        <div className="storage-heading"><span>Penyimpanan</span><strong>Lokal</strong></div>
        <div className="storage-track"><span /></div>
        <small>File tidak dikirim ke server</small>
      </div>
      <button className="profile-card" onClick={onAccount}>
        <span className="avatar">{initials}</span>
        <span><strong>{profileName}</strong><small>Gratis · open-source</small></span>
        <MoreHorizontal size={16} className="profile-more" />
      </button>
    </aside>
  );
}

export function MobileNav({ active, onChange, isSuperadmin }: {
  active: ViewId;
  onChange: (view: ViewId) => void;
  isSuperadmin: boolean;
}) {
  return (
    <nav className="mobile-nav">
      {NAV_ITEMS.map((item) => (
        <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => onChange(item.id)}>
          <item.icon size={19} /> {item.label}
        </button>
      ))}
      {isSuperadmin && (
        <button className={active === "admin" ? "active" : ""} onClick={() => onChange("admin")}>
          <ShieldCheck size={19} /> Admin
        </button>
      )}
    </nav>
  );
}