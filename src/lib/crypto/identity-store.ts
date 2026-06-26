const STORAGE_KEY = "aurora.identity.v1";

export interface StoredIdentity {
  userId: string;
  publicKey: string;
  privateKey: string;
}

export function loadStoredIdentity(userId: string) {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const parsed = JSON.parse(raw) as StoredIdentity;
  return parsed.userId === userId ? parsed : null;
}

export function saveStoredIdentity(identity: StoredIdentity) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}
