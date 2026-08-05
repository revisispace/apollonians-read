export type PlaybackPosition = {
  chunk: number;
  currentTime: number;
  updatedAt: number;
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
