"use client";

import { useEffect, useState } from "react";
import { Activity, BookOpen, Headphones, Home, MoreHorizontal, Settings, ShieldCheck, UserRound, WandSparkles, X } from "lucide-react";

export type ViewId = "home" | "library" | "librivox" | "studio" | "activity" | "settings" | "admin";

type NavItem = { id: ViewId; label: string; icon: typeof Home };

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Beranda", icon: Home },
  { id: "library", label: "Perpustakaan", icon: BookOpen },
  { id: "librivox", label: "LibriVox", icon: Headphones },
  { id: "studio", label: "Buat audio", icon: WandSparkles },
  { id: "activity", label: "Aktivitas", icon: Activity },
  { id: "settings", label: "Pengaturan", icon: Settings },
];

const MOBILE_PRIMARY_ITEMS = NAV_ITEMS.slice(0, 4);
const MOBILE_MORE_ITEMS = NAV_ITEMS.slice(4);

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

export function MobileNav({ active, onChange, onAccount, isSuperadmin }: {
  active: ViewId;
  onChange: (view: ViewId) => void;
  onAccount: () => void;
  isSuperadmin: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryActive = MOBILE_MORE_ITEMS.some((item) => item.id === active) || active === "admin";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const choose = (view: ViewId) => {
    setMoreOpen(false);
    onChange(view);
  };

  return (
    <>
      <nav className="mobile-nav" aria-label="Navigasi utama">
        {MOBILE_PRIMARY_ITEMS.map((item) => (
          <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => choose(item.id)}>
            <item.icon size={19} /> {item.label}
          </button>
        ))}
        <button className={secondaryActive || moreOpen ? "active" : ""} onClick={() => setMoreOpen((current) => !current)} aria-expanded={moreOpen} aria-controls="mobile-more-menu">
          <MoreHorizontal size={19} /> Lainnya
        </button>
      </nav>

      {moreOpen && (
        <div className="mobile-more-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setMoreOpen(false)}>
          <section id="mobile-more-menu" className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Menu lainnya">
            <header><div><strong>Menu lainnya</strong><small>Akses aktivitas, pengaturan, dan akun.</small></div><button onClick={() => setMoreOpen(false)} aria-label="Tutup menu"><X size={19} /></button></header>
            <div className="mobile-more-grid">
              {MOBILE_MORE_ITEMS.map((item) => (
                <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => choose(item.id)}>
                  <item.icon size={20} /><span><strong>{item.label}</strong><small>{item.id === "activity" ? "Riwayat proses audio" : "Preferensi dan penyimpanan"}</small></span>
                </button>
              ))}
              {isSuperadmin && <button className={active === "admin" ? "active" : ""} onClick={() => choose("admin")}><ShieldCheck size={20} /><span><strong>Superadmin</strong><small>Monitoring dan kontrol sistem</small></span></button>}
              <button className="mobile-account-button" onClick={() => { setMoreOpen(false); onAccount(); }}><UserRound size={20} /><span><strong>Akun</strong><small>Profil, logout, dan data perangkat</small></span></button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
