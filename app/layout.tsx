import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apollonians Read — Audiobook pribadi dari bacaanmu",
  description: "Ubah tautan dan file buku menjadi audiobook privat. Proses lokal & worker privat, tanpa platform pihak ketiga.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <head>
        {/* Favicon sementara: pakai langsung file brand yang sudah ada di public/ */}
        <link rel="icon" type="image/png" href="/apollonians_read_brand.png" />
        <link rel="apple-touch-icon" href="/apollonians_read_brand.png" />
        <meta name="theme-color" content="#1f2824" />
      </head>
      <body>{children}</body>
    </html>
  );
}