/**
 * Persistent local storage for the web build.
 *
 * IndexedDB is built into Chromium-based learning devices, so the game does
 * not need a separate database service or any additional installation.
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
    const database = await this.open();
    if (!database) return null;

    try {
      const result = await this.request<StoredRecord<T> | undefined>(
        database.transaction(this.storeName, 'readonly').objectStore(this.storeName).get(key),
      );
      return result?.value ?? null;
    } catch (error) {
      console.warn('[LocalSaveDatabase] Could not read the local save.', error);
      return null;
    }
  }

  async put<T>(key: string, value: T): Promise<boolean> {
    const database = await this.open();
    if (!database) return false;

    try {
      await this.transaction(database, 'readwrite', store => {
        store.put({ key, value, updatedAt: Date.now() } satisfies StoredRecord<T>);
      });
      return true;
    } catch (error) {
      console.warn('[LocalSaveDatabase] Could not write the local save.', error);
      return false;
    }
  }

  async remove(key: string): Promise<boolean> {
    const database = await this.open();
    if (!database) return false;

    try {
      await this.transaction(database, 'readwrite', store => store.delete(key));
      return true;
    } catch (error) {
      console.warn('[LocalSaveDatabase] Could not remove the local save.', error);
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
        console.warn('[LocalSaveDatabase] IndexedDB is unavailable.', request.error);
        resolve(null);
      };
      request.onblocked = () => {
        console.warn('[LocalSaveDatabase] IndexedDB is blocked by another open page.');
      };
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
