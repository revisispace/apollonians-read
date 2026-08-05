"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BookOpen, Gauge, RefreshCw, Save, ShieldCheck, Users } from "lucide-react";
import { isEdgeTtsConfigured } from "../lib/edge-tts";
import {
  loadAdminDashboard,
  updateAppSettings,
  updateUserControls,
  type AdminDashboardData,
  type AppSettings,
} from "../lib/admin";

const number = new Intl.NumberFormat("id-ID");
const relativeDate = (value: string) => new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

export function AdminView() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [message, setMessage] = useState("Memuat kondisi aplikasi…");
  const [working, setWorking] = useState(false);
  const [referenceTime] = useState(() => Date.now());

  const refresh = async () => {
    setWorking(true);
    try {
      const result = await loadAdminDashboard();
      setData(result);
      setSettings(result.settings);
      setMessage(`Diperbarui ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Data admin gagal dimuat.");
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadAdminDashboard()
      .then((result) => {
        if (!active) return;
        setData(result);
        setSettings(result.settings);
        setMessage("Dashboard siap.");
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Data admin gagal dimuat.");
      });
    return () => { active = false; };
  }, []);

  const metrics = useMemo(() => {
    const usage = data?.usage ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUsage = usage.filter((item) => new Date(item.created_at) >= today && item.status !== "failed");
    return {
      active: data?.profiles.filter((profile) => referenceTime - new Date(profile.last_seen_at).getTime() < 24 * 60 * 60 * 1000).length ?? 0,
      characters: todayUsage.reduce((total, item) => total + item.characters, 0),
      failures: usage.filter((item) => item.status === "failed").length,
    };
  }, [data, referenceTime]);

  const saveSettings = async () => {
    if (!settings) return;
    setWorking(true);
    try {
      await updateAppSettings(settings);
      setMessage("Batas konsumsi aplikasi berhasil disimpan.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pengaturan gagal disimpan.");
      setWorking(false);
    }
  };

  const changeUser = async (id: string, changes: Parameters<typeof updateUserControls>[1]) => {
    setWorking(true);
    try {
      await updateUserControls(id, changes);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Akun gagal diperbarui.");
      setWorking(false);
    }
  };

  return (
    <div className="view admin-view">
      <div className="page-title-row">
        <div><p className="eyebrow">SUPERADMIN</p><h1>Kondisi aplikasi</h1><p>Monitor akun dan konsumsi tanpa membaca isi buku atau audio pengguna.</p></div>
        <button className="primary-button" onClick={refresh} disabled={working}><RefreshCw size={17} className={working ? "spin" : ""} /> Segarkan</button>
      </div>
      <p className="admin-status"><ShieldCheck size={16} /> {message}</p>

      <section className="admin-metrics">
        <article><Users /><span><strong>{data?.profiles.length ?? 0}</strong><small>Total akun</small></span></article>
        <article><Activity /><span><strong>{metrics.active}</strong><small>Aktif 24 jam</small></span></article>
        <article><BookOpen /><span><strong>{data?.bookCount ?? 0}</strong><small>Metadata buku</small></span></article>
        <article><Gauge /><span><strong>{number.format(metrics.characters)}</strong><small>Karakter hari ini</small></span></article>
      </section>

      {settings && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><h2>Pengendalian konsumsi</h2><p>Kuota direservasi secara atomik sebelum Edge TTS memproses audio.</p></div>
            <button className="dark-button" onClick={saveSettings} disabled={working}><Save size={16} /> Simpan</button>
          </div>
          <div className="admin-settings-grid">
            <label>Kuota akun baru / hari<input type="number" min="0" max="5000000" value={settings.default_daily_character_limit} onChange={(event) => setSettings({ ...settings, default_daily_character_limit: Number(event.target.value) })} /></label>
            <label>Kuota global / hari<input type="number" min="0" max="50000000" value={settings.global_daily_character_limit} onChange={(event) => setSettings({ ...settings, global_daily_character_limit: Number(event.target.value) })} /></label>
            <label className="admin-toggle">
              <input type="checkbox" checked={settings.edge_tts_enabled} disabled={!isEdgeTtsConfigured} onChange={(event) => setSettings({ ...settings, edge_tts_enabled: event.target.checked })} />
              <span><strong>Aktifkan Edge TTS</strong><small>{isEdgeTtsConfigured ? "Endpoint terkonfigurasi" : "Endpoint belum dipasang"}</small></span>
            </label>
          </div>
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Pengguna</h2><p>Batasi kuota atau tangguhkan akses Edge TTS.</p></div><small>{metrics.failures} kegagalan dalam 7 hari</small></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Akun</th><th>Role</th><th>Terakhir aktif</th><th>Kuota harian</th><th>Status</th></tr></thead>
            <tbody>
              {data?.profiles.map((profile) => (
                <tr key={profile.id}>
                  <td><strong>{profile.email ?? "Tanpa email"}</strong><small>{profile.id.slice(0, 8)}</small></td>
                  <td>{profile.role}</td>
                  <td>{relativeDate(profile.last_seen_at)}</td>
                  <td><input aria-label={`Kuota ${profile.email}`} type="number" min="0" max="5000000" defaultValue={profile.daily_character_limit} onBlur={(event) => Number(event.target.value) !== profile.daily_character_limit && changeUser(profile.id, { daily_character_limit: Number(event.target.value) })} /></td>
                  <td><button className={profile.status === "active" ? "status-active" : "status-suspended"} disabled={profile.role === "superadmin" || working} onClick={() => changeUser(profile.id, { status: profile.status === "active" ? "suspended" : "active" })}>{profile.status === "active" ? "Aktif" : "Ditangguhkan"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
