import type { Metadata } from "next";
import "./globals.css";
import "./responsive.css";
import "./mobile-player.css";
import { AuthProvider } from "./lib/auth";
import { ServiceWorkerRegistration } from "./components/ServiceWorkerRegistration";

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
  manifest: "manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Apollonians Read",
  },
  icons: {
    icon: [{ url: "favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "apollonians_read_brand/app-icon.svg" }],
  },
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
      <head>
        <meta name="theme-color" content="#1f2824" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
