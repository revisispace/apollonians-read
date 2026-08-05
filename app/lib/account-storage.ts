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
