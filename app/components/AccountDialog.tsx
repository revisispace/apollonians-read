"use client";

import { useState, type FormEvent } from "react";
import { Cloud, Database, LogIn, LogOut, X } from "lucide-react";
import { useAuth } from "../lib/auth";

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      setMessage(await (mode === "signin" ? auth.signIn(email, password) : auth.signUp(email, password)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Autentikasi gagal.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button className="dialog-close" onClick={onClose} aria-label="Tutup"><X size={19} /></button>
        <span className="dialog-icon"><Database size={21} /></span>
        <p className="eyebrow">AKUN & SINKRONISASI</p>
        <h2 id="account-title">{auth.user ? "Akunmu tersambung" : "Simpan progres di cloud"}</h2>

        {!auth.configured ? (
          <div className="config-notice">
            <Cloud size={20} />
            <div><strong>Mode lokal aktif</strong><p>Buku dan audio sudah tersimpan di browser. Tambahkan konfigurasi Supabase Free agar metadata tersinkron antardevice.</p></div>
          </div>
        ) : auth.user ? (
          <div className="signed-in-card">
            <span>{auth.user.email?.slice(0, 2).toUpperCase()}</span>
            <div><strong>{auth.user.email}</strong><p>{auth.isSuperadmin ? "Superadmin · akses monitoring aktif." : "Metadata buku dan progres dapat disinkronkan."} File asli tetap privat di perangkat.</p></div>
            <button onClick={async () => { await auth.signOut(); onClose(); }}><LogOut size={16} /> Keluar</button>
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" /></label>
            <label>Password<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" /></label>
            {message && <p className="auth-message">{message}</p>}
            <button className="dark-button" disabled={working}><LogIn size={17} /> {working ? "Memproses…" : mode === "signin" ? "Masuk" : "Buat akun"}</button>
            <button type="button" className="auth-switch" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
            </button>
          </form>
        )}
        <p className="privacy-copy">Tidak ada service-role key atau kunci TTS di browser. Supabase publishable key dilindungi oleh kebijakan RLS.</p>
      </section>
    </div>
  );
}
