import { sys } from 'cc';

/**
 * Offline save store shared by the browser preview and the packaged Android app.
 *
 * Browser builds mirror records to IndexedDB and Cocos localStorage. Native Cocos
 * builds do not expose IndexedDB, so the same API transparently uses the engine's
 * persistent localStorage (Android SharedPreferences) instead. Keeping the
 * synchronous mirror also protects the latest checkpoint when an app is closed
 * before an IndexedDB transaction has finished.
 */
type StoredRecord<T> = {
  key: string;
  value: T;
  updatedAt: number;
};

export class LocalSaveDatabase {
  private databasePromise: Promise<IDBDatabase | null> | null = null;

  constructor(
    private readonly databaseName: string,
    private readonly storeName: string,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const localRecord = this.readLocalRecord<T>(key) ?? this.readLocalBackup<T>(key);
    const database = await this.open();
    if (!database) return localRecord?.value ?? null;

    try {
      const databaseRecord = await this.request<StoredRecord<T> | undefined>(
        database.transaction(this.storeName, 'readonly').objectStore(this.storeName).get(key),
      );
      // A user can close a web app while IndexedDB is still flushing. Always
      // restore the newest valid mirror instead of blindly preferring one backend.
      if (!databaseRecord || (localRecord && localRecord.updatedAt > databaseRecord.updatedAt)) {
        return localRecord?.value ?? null;
      }
      return databaseRecord.value;
    } catch (error) {
      console.warn('[LocalSaveDatabase] Could not read IndexedDB; using the local mirror.', error);
      return localRecord?.value ?? null;
    }
  }

  async put<T>(key: string, value: T): Promise<boolean> {
    const record: StoredRecord<T> = { key, value, updatedAt: Date.now() };
    // This write is synchronous on Android and is deliberately performed before
    // awaiting IndexedDB, so lifecycle callbacks cannot lose the latest progress.
    const localSaved = this.writeLocalRecord(record);
    const database = await this.open();
    if (!database) return localSaved;

    try {
      await this.transaction(database, 'readwrite', store => store.put(record));
      return true;
    } catch (error) {
      console.warn('[LocalSaveDatabase] Could not write IndexedDB; local mirror was retained.', error);
      return localSaved;
    }
  }

  async remove(key: string): Promise<boolean> {
    const localRemoved = this.removeLocalRecord(key);
    const database = await this.open();
    if (!database) return localRemoved;

    try {
      await this.transaction(database, 'readwrite', store => store.delete(key));
      return true;
    } catch (error) {
      console.warn('[LocalSaveDatabase] Could not remove IndexedDB record.', error);
      return localRemoved;
    }
  }

  private storageKey(key: string) {
    return `${this.databaseName}:${this.storeName}:${key}`;
  }

  private backupStorageKey(key: string) {
    return `${this.storageKey(key)}:backup`;
  }

  private readLocalRecord<T>(key: string): StoredRecord<T> | null {
    return this.parseLocalRecord<T>(this.storageKey(key));
  }

  private readLocalBackup<T>(key: string): StoredRecord<T> | null {
    return this.parseLocalRecord<T>(this.backupStorageKey(key));
  }

  private parseLocalRecord<T>(storageKey: string): StoredRecord<T> | null {
    try {
      const raw = sys.localStorage.getItem(storageKey);
      if (!raw) return null;
      const record = JSON.parse(raw) as Partial<StoredRecord<T>>;
      if (!record || typeof record !== 'object' || typeof record.key !== 'string' || !Number.isFinite(record.updatedAt)) {
        return null;
      }
      return record as StoredRecord<T>;
    } catch (error) {
      console.warn('[LocalSaveDatabase] Local save mirror is unreadable.', error);
      return null;
    }
  }

  private writeLocalRecord<T>(record: StoredRecord<T>): boolean {
    try {
      const primaryKey = this.storageKey(record.key);
      const previous = sys.localStorage.getItem(primaryKey);
      if (previous) sys.localStorage.setItem(this.backupStorageKey(record.key), previous);
      sys.localStorage.setItem(primaryKey, JSON.stringify(record));
      return true;
    } catch (error) {
      console.warn('[LocalSaveDatabase] Could not write the local save mirror.', error);
      return false;
    }
  }

  private removeLocalRecord(key: string): boolean {
    try {
      sys.localStorage.removeItem(this.storageKey(key));
      sys.localStorage.removeItem(this.backupStorageKey(key));
      return true;
    } catch (error) {
      console.warn('[LocalSaveDatabase] Could not remove the local save mirror.', error);
      return false;
    }
  }

  private open(): Promise<IDBDatabase | null> {
    if (this.databasePromise) return this.databasePromise;
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);

    this.databasePromise = new Promise(resolve => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.storeName)) {
          database.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[LocalSaveDatabase] IndexedDB is unavailable; using the local mirror.', request.error);
        resolve(null);
      };
      request.onblocked = () => console.warn('[LocalSaveDatabase] IndexedDB is blocked by another open page.');
    });
    return this.databasePromise;
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private transaction(
    database: IDBDatabase,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(this.storeName, mode);
      action(transaction.objectStore(this.storeName));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
}
