import {
  Activity,
  BookOpen,
  Headphones,
  Home,
  Settings,
  Sparkles,
} from "lucide-react";

export type ViewId = "home" | "library" | "studio" | "activity" | "settings";

export const navItems: { id: ViewId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Beranda", icon: Home },
  { id: "library", label: "Perpustakaan", icon: BookOpen },
  { id: "studio", label: "Buat audio", icon: Sparkles },
  { id: "activity", label: "Aktivitas", icon: Activity },
  { id: "settings", label: "Pengaturan", icon: Settings },
];

type NavigationProps = {
  active: ViewId;
  onChange: (view: ViewId) => void;
};

export function Sidebar({ active, onChange, profileName, onAccount }: NavigationProps & { profileName: string; onAccount: () => void }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onChange("home")} aria-label="Ke beranda">
        <span className="brand-icon"><Headphones size={19} /></span>
        <span><strong>apollonians</strong><small>read</small></span>
      </button>
      <nav className="side-nav" aria-label="Navigasi utama">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={active === id ? "active" : ""} onClick={() => onChange(id)}>
            <Icon size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="storage-card">
        <div className="storage-heading"><span>Penyimpanan</span><strong>Lokal</strong></div>
        <div className="storage-track"><span /></div>
        <small>File tidak dikirim ke server</small>
      </div>
      <button className="profile-card" onClick={onAccount}>
        <span className="avatar">{profileName.slice(0, 2).toUpperCase()}</span>
        <span><strong>{profileName}</strong><small>Gratis · open-source</small></span>
        <span className="profile-more">•••</span>
      </button>
    </aside>
  );
}

export function MobileNav({ active, onChange }: NavigationProps) {
  return (
    <nav className="mobile-nav" aria-label="Navigasi mobile">
      {navItems.slice(0, 4).map(({ id, label, icon: Icon }) => (
        <button key={id} className={active === id ? "active" : ""} onClick={() => onChange(id)}>
          <Icon size={20} strokeWidth={1.8} />
          <span>{label === "Perpustakaan" ? "Pustaka" : label === "Buat audio" ? "Buat" : label}</span>
        </button>
      ))}
      <button className={active === "settings" ? "active" : ""} onClick={() => onChange("settings")}>
        <Settings size={20} strokeWidth={1.8} /><span>Setelan</span>
      </button>
    </nav>
  );
}
