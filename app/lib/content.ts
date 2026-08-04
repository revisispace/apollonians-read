export type Book = {
  id: string;
  title: string;
  author: string;
  progress: number;
  duration: string;
  remaining: string;
  palette: string;
  category: string;
  createdAt?: string;
  sourceName?: string;
  localOnly?: boolean;
  generated?: boolean;
};

export const books: Book[] = [
  {
    id: "demo-1",
    title: "The Anthropocene Reviewed",
    author: "John Green",
    progress: 64,
    duration: "8j 14m",
    remaining: "2j 58m tersisa",
    palette: "ochre",
    category: "Esai",
  },
  {
    id: "demo-2",
    title: "Filosofi Teras",
    author: "Henry Manampiring",
    progress: 31,
    duration: "6j 22m",
    remaining: "4j 24m tersisa",
    palette: "coral",
    category: "Filsafat",
  },
  {
    id: "demo-3",
    title: "Laut Bercerita",
    author: "Leila S. Chudori",
    progress: 82,
    duration: "9j 03m",
    remaining: "1j 38m tersisa",
    palette: "navy",
    category: "Fiksi",
  },
  {
    id: "demo-4",
    title: "Atomic Habits",
    author: "James Clear",
    progress: 12,
    duration: "5j 35m",
    remaining: "4j 55m tersisa",
    palette: "cream",
    category: "Pengembangan diri",
  },
  {
    id: "demo-5",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    progress: 47,
    duration: "15j 17m",
    remaining: "8j 06m tersisa",
    palette: "sage",
    category: "Sejarah",
  },
  {
    id: "demo-6",
    title: "Pulang",
    author: "Tere Liye",
    progress: 0,
    duration: "8j 42m",
    remaining: "Belum dimulai",
    palette: "plum",
    category: "Fiksi",
  },
];

export const activities = [
  { title: "Filosofi Teras", detail: "Audio selesai dibuat", time: "Hari ini, 09.42", state: "Selesai" },
  { title: "The Anthropocene Reviewed", detail: "Bab 7–9 diperbarui", time: "Kemarin, 20.16", state: "Selesai" },
  { title: "Thinking, Fast and Slow", detail: "Memproses 18 dari 26 bab", time: "2 menit lalu", state: "Diproses" },
  { title: "https://aeon.co/essays/...", detail: "Tautan gagal dibaca", time: "3 Agu, 14.03", state: "Perlu dicek" },
];
