import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./lib/auth";

const pagesOwner = process.env.GITHUB_REPOSITORY_OWNER;
const pagesRepository = process.env.GITHUB_REPOSITORY?.split("/")[1];
const pagesPath = pagesRepository?.endsWith(".github.io") ? "" : `/${pagesRepository ?? "apollonians-read"}`;
const metadataBase = pagesOwner
  ? new URL(`https://${pagesOwner}.github.io${pagesPath}/`)
  : new URL("http://localhost:3000/");

export const metadata: Metadata = {
  metadataBase,
  title: "Apollonians Read — Ubah buku menjadi audio",
  description: "Studio audiobook pribadi untuk mengubah tautan dan file buku menjadi pengalaman mendengarkan yang nyaman.",
  applicationName: "Apollonians Read",
  openGraph: {
    title: "Apollonians Read",
    description: "Buku apa pun, kini bisa kamu dengarkan.",
    type: "website",
    images: [{ url: "og.png", width: 1731, height: 909, alt: "Apollonians Read — Buku apa pun, kini bisa kamu dengarkan." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Apollonians Read",
    description: "Buku apa pun, kini bisa kamu dengarkan.",
    images: ["og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
