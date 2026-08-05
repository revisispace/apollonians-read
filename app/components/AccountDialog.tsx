"use client";

import { useState } from "react";
import { Database, LogOut, ShieldCheck, Trash2, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { clearAccountLocalStorage } from "../lib/account-storage";
import { clearCurrentUserLocalBooks } from "../lib/local-db";

export function AccountDialog({
  open,
  onClose,
  onLocalDataCleared,
}: {
  open: boolean;
  onClose: () => void;
  onLocalDataCleared: () => void;
}) {
  const auth = useAuth();
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState<"idle" | "signout" | "clear">("idle");

  if (!open || !auth.user) return null;

  const signOut = async () => {
    setWorking("signout");
    setMessage("");

    try {
      await auth.signOut();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal keluar dari akun.");
      setWorking("idle");
    }
  };

  const clearLocalDataAndSignOut = async () => {
    const confirmed = window.confirm(
      "Hapus seluruh buku, audio, posisi pemutaran, aktivitas, dan preferensi akun ini dari perangkat? Data cloud tidak ikut dihapus.",
    );
    if (!confirmed) return;

    setWorking("clear");
    setMessage("");

    try {
      const userId = auth.user?.id;
      if (!userId) throw new Error("Sesi akun tidak ditemukan.");

      await clearCurrentUserLocalBooks();
      clearAccountLocalStorage(userId);
      onLocalDataCleared();
      await auth.signOut();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Data perangkat gagal dihapus.");
      setWorking("idle");
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
                : "Akun aktif · data lokal dipisahkan dari akun lain pada perangkat ini."}
              {" "}File asli dan audio tetap privat di perangkat.
            </p>
          </div>
        </div>

        <div className="config-notice">
          <ShieldCheck size={20} />
          <div>
            <strong>Pemisahan data per akun aktif</strong>
            <p>Buku, audio, progres, aktivitas, dan preferensi hanya dapat dibaca oleh akun yang sedang login.</p>
          </div>
        </div>

        {message && <p className="auth-message">{message}</p>}

        <button className="dark-button" disabled={working !== "idle"} onClick={signOut}>
          <LogOut size={16} /> {working === "signout" ? "Keluar…" : "Keluar dari akun"}
        </button>

        <button className="delete-book" disabled={working !== "idle"} onClick={clearLocalDataAndSignOut}>
          <Trash2 size={16} /> {working === "clear" ? "Menghapus data…" : "Keluar dan hapus data perangkat"}
        </button>

        <p className="privacy-copy">
          Keluar biasa tidak menghapus data akun ini. Opsi hapus data hanya membersihkan penyimpanan lokal akun aktif dan tidak menghapus metadata cloud.
        </p>
      </section>
    </div>
  );
}
