import { normalizeChapters, type DetectedChapter } from "./chapters";

export const PLAYBACK_POSITION_EVENT = "apollonians-playback-position";

export type PlaybackPosition = {
  chunk: number;
  currentTime: number;
  updatedAt: number;
};

export type AudioBookmark = {
  id: string;
  chunk: number;
  currentTime: number;
  label: string;
  createdAt: number;
};

export type ActiveEdgeJob = {
  jobId: string;
  bookId: string;
  segmentIndex: number;
  totalSegments: number;
  voice: string;
  createdAt: number;
};

export type AccountPreferences = {
  autoDownload: boolean;
  normalize: boolean;
  notify: boolean;
};

export const defaultAccountPreferences: AccountPreferences = {
  autoDownload: false,
  normalize: true,
  notify: true,
};

function accountPrefix(userId: string) {
  return `apollonians-user-${userId}`;
}

export function playbackPositionKey(userId: string, bookId: string) {
  return `${accountPrefix(userId)}-position-${bookId}`;
}

export function bookmarksKey(userId: string, bookId: string) {
  return `${accountPrefix(userId)}-bookmarks-${bookId}`;
}

export function chaptersKey(userId: string, bookId: string) {
  return `${accountPrefix(userId)}-chapters-${bookId}`;
}

export function activeEdgeJobKey(userId: string, bookId: string) {
  return `${accountPrefix(userId)}-edge-job-${bookId}`;
}

export function preferencesKey(userId: string) {
  return `${accountPrefix(userId)}-preferences`;
}

export function activityKey(userId: string) {
  return `${accountPrefix(userId)}-activity`;
}

export function readPlaybackPosition(userId: string, bookId: string) {
  if (typeof window === "undefined") return null;

  try {
    const value = localStorage.getItem(playbackPositionKey(userId, bookId));
    return value ? (JSON.parse(value) as PlaybackPosition) : null;
  } catch {
    return null;
  }
}

export function writePlaybackPosition(userId: string, bookId: string, position: PlaybackPosition) {
  try {
    localStorage.setItem(playbackPositionKey(userId, bookId), JSON.stringify(position));
    window.dispatchEvent(new CustomEvent(PLAYBACK_POSITION_EVENT, { detail: { userId, bookId, position } }));
  } catch {
    // Playback position is best-effort local state.
  }
}

export function readAudioBookmarks(userId: string, bookId: string) {
  if (typeof window === "undefined") return [];

  try {
    const value = localStorage.getItem(bookmarksKey(userId, bookId));
    return value ? (JSON.parse(value) as AudioBookmark[]) : [];
  } catch {
    return [];
  }
}

export function writeAudioBookmarks(userId: string, bookId: string, bookmarks: AudioBookmark[]) {
  try {
    localStorage.setItem(bookmarksKey(userId, bookId), JSON.stringify(bookmarks));
  } catch {
    // Bookmarks remain available in memory when storage is unavailable.
  }
}

export function readCustomChapters(userId: string, bookId: string) {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(chaptersKey(userId, bookId));
    if (!value) return null;
    return normalizeChapters(JSON.parse(value) as DetectedChapter[]);
  } catch {
    return null;
  }
}

export function writeCustomChapters(userId: string, bookId: string, chapters: DetectedChapter[]) {
  const normalized = normalizeChapters(chapters);
  try {
    localStorage.setItem(chaptersKey(userId, bookId), JSON.stringify(normalized));
  } catch {
    // Custom chapter markers remain available in memory when storage is unavailable.
  }
  return normalized;
}

export function clearCustomChapters(userId: string, bookId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(chaptersKey(userId, bookId));
}

export function readActiveEdgeJob(userId: string, bookId: string) {
  if (typeof window === "undefined") return null;

  try {
    const value = localStorage.getItem(activeEdgeJobKey(userId, bookId));
    if (!value) return null;
    const job = JSON.parse(value) as ActiveEdgeJob;
    if (!job.jobId || job.bookId !== bookId || !Number.isInteger(job.segmentIndex) || !Number.isFinite(job.createdAt)) {
      localStorage.removeItem(activeEdgeJobKey(userId, bookId));
      return null;
    }
    return job;
  } catch {
    return null;
  }
}

export function listActiveEdgeJobs(userId: string) {
  if (typeof window === "undefined") return [];
  const keyPrefix = `${accountPrefix(userId)}-edge-job-`;
  const jobs: ActiveEdgeJob[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(keyPrefix)) continue;
    const bookId = key.slice(keyPrefix.length);
    const job = readActiveEdgeJob(userId, bookId);
    if (job) jobs.push(job);
  }
  return jobs;
}

export function writeActiveEdgeJob(userId: string, job: ActiveEdgeJob) {
  try {
    localStorage.setItem(activeEdgeJobKey(userId, job.bookId), JSON.stringify(job));
  } catch {
    // Active jobs remain recoverable only while the current page stays open.
  }
}

export function clearActiveEdgeJob(userId: string, bookId: string, expectedJobId?: string) {
  if (typeof window === "undefined") return;
  const key = activeEdgeJobKey(userId, bookId);
  if (expectedJobId) {
    const current = readActiveEdgeJob(userId, bookId);
    if (current?.jobId !== expectedJobId) return;
  }
  localStorage.removeItem(key);
}

export function readAccountPreferences(userId: string) {
  if (typeof window === "undefined") return defaultAccountPreferences;

  try {
    const value = localStorage.getItem(preferencesKey(userId));
    return value
      ? { ...defaultAccountPreferences, ...(JSON.parse(value) as Partial<AccountPreferences>) }
      : defaultAccountPreferences;
  } catch {
    return defaultAccountPreferences;
  }
}

export function writeAccountPreferences(userId: string, preferences: AccountPreferences) {
  try {
    localStorage.setItem(preferencesKey(userId), JSON.stringify(preferences));
  } catch {
    // Preferences remain in memory if storage is unavailable.
  }
}

export function readAccountActivity(userId: string) {
  if (typeof window === "undefined") return [];

  try {
    const value = localStorage.getItem(activityKey(userId));
    return value ? (JSON.parse(value) as string[]) : [];
  } catch {
    return [];
  }
}

export function writeAccountActivity(userId: string, activity: string[]) {
  try {
    localStorage.setItem(activityKey(userId), JSON.stringify(activity));
  } catch {
    // Activity history is best-effort local state.
  }
}

export function clearAccountLocalStorage(userId: string) {
  if (typeof window === "undefined") return;

  const prefix = accountPrefix(userId);
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}
