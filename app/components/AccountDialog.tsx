"use client";

import { useState } from "react";
import { Database, LogOut, ShieldCheck, X } from "lucide-react";
import { useAuth } from "../lib/auth";

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const auth = useAuth();
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  if (!open || !auth.user) return null;

  const signOut = async () => {
    setWorking(true);
    setMessage("");

    try {
      await auth.signOut();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal keluar dari akun.");
      setWorking(false);
    }
  };

  const email = auth.user.email ?? "Pengguna";
  const initials = email.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "AR";

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button className="dialog-close" onClick={onClose} aria-label="Tutup">
          <X size={19} />
        </button>

        <span className="dialog-icon"><Database size={21} /></span>
        <p className="eyebrow">AKUN APOLLONIANS</p>
        <h2 id="account-title">Akunmu tersambung</h2>

        <div className="signed-in-card">
          <span>{initials}</span>
          <div>
            <strong>{email}</strong>
            <p>
              {auth.isSuperadmin
                ? "Superadmin · akses monitoring dan pengendalian konsumsi aktif."
                : "Akun aktif · metadata buku dan progres dapat disinkronkan."}
              {" "}File asli dan audio tetap privat di perangkat.
            </p>
          </div>
        </div>

        <div className="config-notice">
          <ShieldCheck size={20} />
          <div>
            <strong>Login wajib aktif</strong>
            <p>Dashboard, Studio Audio, Piper, dan Edge TTS hanya dapat digunakan selama sesi akun aktif.</p>
          </div>
        </div>

        {message && <p className="auth-message">{message}</p>}

        <button className="dark-button" disabled={working} onClick={signOut}>
          <LogOut size={16} /> {working ? "Keluar…" : "Keluar dari akun"}
        </button>

        <p className="privacy-copy">
          Keluar tidak menghapus buku atau audio pada perangkat ini. Pemisahan data lokal per akun akan diterapkan pada Step 2.
        </p>
      </section>
    </div>
  );
}
