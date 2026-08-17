import { openDB as idbOpenDB, type IDBPDatabase } from 'idb';
import { logger } from '@lark-apaas/client-toolkit/logger';

// ============ Types ============

export interface AuthState {
  email: string;
  userId: string;
  token: string;
}

export interface MusicState {
  app: string;
  song: string;
}

export interface ProfileState {
  nickname: string;
  avatar: string;
  status: string;
  musicState: MusicState | null;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface PermissionState {
  location: boolean;
  notification: boolean;
}

// ============ IndexedDB ============

const DB_NAME = 'friend-location-db';
const DB_VERSION = 1;

const STORES = {
  friends: 'friends',
  trajectories: 'trajectories',
  places: 'places',
  shortcuts: 'shortcuts',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbInstance: IDBPDatabase | null = null;

export async function openDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await idbOpenDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // friends
      if (!db.objectStoreNames.contains(STORES.friends)) {
        db.createObjectStore(STORES.friends, { keyPath: 'userId' });
      }
      // trajectories
      if (!db.objectStoreNames.contains(STORES.trajectories)) {
        const store = db.createObjectStore(STORES.trajectories, { keyPath: 'id' });
        store.createIndex('date', 'date');
      }
      // places
      if (!db.objectStoreNames.contains(STORES.places)) {
        db.createObjectStore(STORES.places, { keyPath: 'id' });
      }
      // shortcuts
      if (!db.objectStoreNames.contains(STORES.shortcuts)) {
        db.createObjectStore(STORES.shortcuts, { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: any) => Promise<T> | T,
): Promise<T> {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = await fn(store);
  await tx.done;
  return result;
}

// Generic CRUD factory
function createStoreRepo(storeName: StoreName) {
  return {
    async getAll<T = unknown>(): Promise<T[]> {
      return withStore<T[]>(storeName, 'readonly', (store) => store.getAll());
    },
    async get<T = unknown>(key: string): Promise<T | undefined> {
      return withStore<T | undefined>(storeName, 'readonly', (store) =>
        store.get(key),
      );
    },
    async put<T = unknown>(value: T): Promise<IDBValidKey> {
      return withStore<IDBValidKey>(storeName, 'readwrite', (store) =>
        store.put(value) as Promise<IDBValidKey>,
      );
    },
    async bulkPut<T = unknown>(values: T[]): Promise<void> {
      return withStore<void>(storeName, 'readwrite', async (store) => {
        for (const v of values) {
          await store.put(v);
        }
      });
    },
    async delete(key: string): Promise<void> {
      return withStore<void>(storeName, 'readwrite', (store) =>
        store.delete(key) as Promise<void>,
      );
    },
    async clear(): Promise<void> {
      return withStore<void>(storeName, 'readwrite', (store) => store.clear() as Promise<void>);
    },
    async count(): Promise<number> {
      return withStore<number>(storeName, 'readonly', (store) => store.count() as Promise<number>);
    },
  };
}

export const friendsStore = createStoreRepo(STORES.friends);
export const trajectoriesStore = createStoreRepo(STORES.trajectories);
export const placesStore = createStoreRepo(STORES.places);
export const shortcutsStore = createStoreRepo(STORES.shortcuts);

// ============ localStorage ============

const LS_KEYS = {
  auth: 'fl_auth',
  profile: 'fl_profile',
  onboarding: 'fl_onboarding_done',
  theme: 'fl_theme',
  sensitiveWords: 'fl_sensitive_words',
  permissions: 'fl_permissions',
} as const;

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch (err) {
    logger.warn('localStorage parse failed', err);
    return null;
  }
}

// Auth
export function getAuth(): AuthState | null {
  return safeParse<AuthState>(localStorage.getItem(LS_KEYS.auth));
}

export function setAuth(state: AuthState): void {
  localStorage.setItem(LS_KEYS.auth, JSON.stringify(state));
}

export function clearAuth(): void {
  localStorage.removeItem(LS_KEYS.auth);
}

// Profile
export function getProfile(): ProfileState | null {
  return safeParse<ProfileState>(localStorage.getItem(LS_KEYS.profile));
}

export function setProfile(profile: ProfileState): void {
  localStorage.setItem(LS_KEYS.profile, JSON.stringify(profile));
}

// Onboarding
export function getOnboarding(): boolean {
  return localStorage.getItem(LS_KEYS.onboarding) === '1';
}

export function setOnboarding(done: boolean): void {
  localStorage.setItem(LS_KEYS.onboarding, done ? '1' : '0');
}

// Theme
export function getTheme(): ThemeMode {
  const value = localStorage.getItem(LS_KEYS.theme);
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}

export function setTheme(theme: ThemeMode): void {
  localStorage.setItem(LS_KEYS.theme, theme);
}

// Sensitive words
export function getSensitiveWords(): string[] {
  return safeParse<string[]>(localStorage.getItem(LS_KEYS.sensitiveWords)) ?? [];
}

export function setSensitiveWords(words: string[]): void {
  localStorage.setItem(LS_KEYS.sensitiveWords, JSON.stringify(words));
}

// Permissions
export function getPermissions(): PermissionState {
  return (
    safeParse<PermissionState>(localStorage.getItem(LS_KEYS.permissions)) ?? {
      location: false,
      notification: false,
    }
  );
}

export function setPermissions(p: PermissionState): void {
  localStorage.setItem(LS_KEYS.permissions, JSON.stringify(p));
}
