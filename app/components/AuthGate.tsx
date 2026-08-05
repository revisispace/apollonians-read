"use client";

import { AudiobookApp } from "./AudiobookApp";
import { AuthView } from "./AuthView";
import { useAuth } from "../lib/auth";
import styles from "./AuthGate.module.css";

export function AuthGate() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <main className={styles.stateScreen} aria-live="polite" aria-busy="true">
        <img src="apollonians_read_brand/logo-primary-reversed.svg" alt="Apollonians Read" />
        <span className={styles.spinner} aria-hidden="true" />
        <h1>Menyiapkan perpustakaanmu</h1>
        <p>Memeriksa sesi akun dengan aman.</p>
      </main>
    );
  }

  if (!auth.configured) {
    return (
      <main className={styles.stateScreen}>
        <img src="apollonians_read_brand/logo-primary-reversed.svg" alt="Apollonians Read" />
        <div className={styles.alertIcon}>!</div>
        <h1>Layanan autentikasi belum tersedia</h1>
        <p>
          Apollonians Read mewajibkan login. Konfigurasikan URL dan publishable key Supabase
          sebelum aplikasi dapat digunakan.
        </p>
        <code>NEXT_PUBLIC_SUPABASE_URL</code>
        <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
      </main>
    );
  }

  if (!auth.user) return <AuthView />;

  return <AudiobookApp />;
}
