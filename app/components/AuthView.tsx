"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, Headphones, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import styles from "./AuthGate.module.css";

type AuthMode = "signin" | "signup" | "reset";

export function AuthView() {
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [working, setWorking] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage("");
    setIsError(false);
    setPassword("");
    setConfirmPassword("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    setIsError(false);

    try {
      if (mode === "signup" && password !== confirmPassword) {
        throw new Error("Konfirmasi password belum sama.");
      }

      const result = mode === "signin"
        ? await auth.signIn(email, password)
        : mode === "signup"
          ? await auth.signUp(email, password)
          : await auth.sendPasswordReset(email);

      setMessage(result);
      if (mode === "signup" || mode === "reset") {
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Autentikasi gagal. Coba kembali.");
    } finally {
      setWorking(false);
    }
  };

  const heading = mode === "signin"
    ? "Masuk ke perpustakaanmu"
    : mode === "signup"
      ? "Buat akun gratis"
      : "Atur ulang password";

  const description = mode === "signin"
    ? "Akses buku, audio, dan progres yang tersimpan pada perangkatmu."
    : mode === "signup"
      ? "Akun diperlukan untuk menggunakan seluruh fitur Apollonians Read."
      : "Masukkan email akunmu dan kami akan mengirimkan tautan reset.";

  return (
    <main className={styles.authPage}>
      <section className={styles.brandPanel}>
        <img className={styles.logo} src="apollonians_read_brand/logo-primary-reversed.svg" alt="Apollonians Read" />
        <div className={styles.brandCopy}>
          <p className={styles.eyebrow}>AUDIOBOOK PRIBADI</p>
          <h1>Bacaanmu, dalam suara yang bisa menemani kapan saja.</h1>
          <p>
            Ubah PDF, EPUB, DOCX, TXT, Markdown, atau artikel menjadi audiobook pribadi.
            File asli dan audio tetap disimpan pada perangkatmu.
          </p>
        </div>
        <div className={styles.featureList}>
          <div><Headphones size={19} /><span><strong>Suara Indonesia</strong><small>Piper lokal dan Edge TTS online.</small></span></div>
          <div><LockKeyhole size={19} /><span><strong>Privat secara default</strong><small>Buku tidak dijadikan koleksi publik.</small></span></div>
          <div><BookOpen size={19} /><span><strong>Semua bacaanmu</strong><small>Dikelola dalam satu perpustakaan pribadi.</small></span></div>
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.mobileBrand}>
            <img src="apollonians_read_brand/logo-primary-reversed.svg" alt="Apollonians Read" />
          </div>
          <p className={styles.eyebrow}>{mode === "signin" ? "SELAMAT DATANG KEMBALI" : mode === "signup" ? "MULAI GRATIS" : "PEMULIHAN AKUN"}</p>
          <h2>{heading}</h2>
          <p className={styles.formDescription}>{description}</p>

          <form className={styles.authForm} onSubmit={submit}>
            <label>
              Email
              <span className={styles.inputWrap}>
                <Mail size={18} />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@email.com"
                />
              </span>
            </label>

            {mode !== "reset" && (
              <label>
                Password
                <span className={styles.inputWrap}>
                  <LockKeyhole size={18} />
                  <input
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    minLength={8}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimal 8 karakter"
                  />
                </span>
              </label>
            )}

            {mode === "signup" && (
              <label>
                Konfirmasi password
                <span className={styles.inputWrap}>
                  <ShieldCheck size={18} />
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Ulangi password"
                  />
                </span>
              </label>
            )}

            {message && (
              <p className={`${styles.message} ${isError ? styles.error : styles.success}`} role="status">
                {message}
              </p>
            )}

            <button className={styles.submitButton} disabled={working}>
              {working ? "Memproses…" : mode === "signin" ? "Masuk" : mode === "signup" ? "Buat akun" : "Kirim tautan reset"}
              {!working && <ArrowRight size={18} />}
            </button>
          </form>

          <div className={styles.switches}>
            {mode === "signin" && (
              <>
                <button type="button" onClick={() => switchMode("reset")}>Lupa password?</button>
                <p>Belum punya akun? <button type="button" onClick={() => switchMode("signup")}>Daftar gratis</button></p>
              </>
            )}
            {mode === "signup" && <p>Sudah punya akun? <button type="button" onClick={() => switchMode("signin")}>Masuk</button></p>}
            {mode === "reset" && <p>Ingat password? <button type="button" onClick={() => switchMode("signin")}>Kembali masuk</button></p>}
          </div>

          <p className={styles.privacyNote}>
            Dengan melanjutkan, kamu menyetujui penggunaan akun untuk autentikasi. Buku, teks lengkap, dan audio tetap disimpan pada perangkat kecuali dinyatakan lain.
          </p>
        </div>
      </section>
    </main>
  );
}
