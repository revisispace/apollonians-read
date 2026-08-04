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

export const books: Book[] = [];

export const activities = [
  { title: "Filosofi Teras", detail: "Audio selesai dibuat", time: "Hari ini, 09.42", state: "Selesai" },
  { title: "The Anthropocene Reviewed", detail: "Bab 7–9 diperbarui", time: "Kemarin, 20.16", state: "Selesai" },
  { title: "Thinking, Fast and Slow", detail: "Memproses 18 dari 26 bab", time: "2 menit lalu", state: "Diproses" },
  { title: "https://aeon.co/essays/...", detail: "Tautan gagal dibaca", time: "3 Agu, 14.03", state: "Perlu dicek" },
];
