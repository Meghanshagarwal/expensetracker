import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'expense-tracker-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Cache for synced expenses
        if (!db.objectStoreNames.contains('expenses')) {
          db.createObjectStore('expenses', { keyPath: '_id' });
        }
        // Cache for synced persons
        if (!db.objectStoreNames.contains('persons')) {
          db.createObjectStore('persons', { keyPath: '_id' });
        }
        // Cache for synced cards
        if (!db.objectStoreNames.contains('cards')) {
          db.createObjectStore('cards', { keyPath: '_id' });
        }
        // Queue for offline mutations (expenses, persons, or cards to be created/updated)
        if (!db.objectStoreNames.contains('sync-queue')) {
          db.createObjectStore('sync-queue', { keyPath: 'tempId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getLocalExpenses() {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('expenses');
}

export async function saveLocalExpenses(expenses: any[]) {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction('expenses', 'readwrite');
  await tx.objectStore('expenses').clear();
  for (const exp of expenses) {
    await tx.objectStore('expenses').put(exp);
  }
  await tx.done;
}

export async function getLocalPersons() {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('persons');
}

export async function saveLocalPersons(persons: any[]) {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction('persons', 'readwrite');
  await tx.objectStore('persons').clear();
  for (const p of persons) {
    await tx.objectStore('persons').put(p);
  }
  await tx.done;
}

export async function getSyncQueue() {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('sync-queue');
}

export async function addToSyncQueue(type: 'expense' | 'person' | 'card', action: 'create' | 'update' | 'delete', data: any) {
  const db = await getDB();
  if (!db) return;
  const tempId = data._id || `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const item = {
    tempId,
    type,
    action,
    data: { ...data, _id: tempId },
    timestamp: Date.now(),
  };
  await db.put('sync-queue', item);
  return tempId;
}

export async function removeFromSyncQueue(tempId: string) {
  const db = await getDB();
  if (!db) return;
  await db.delete('sync-queue', tempId);
}

export async function clearSyncQueue() {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction('sync-queue', 'readwrite');
  await tx.objectStore('sync-queue').clear();
  await tx.done;
}

export async function getLocalCards() {
  const db = await getDB();
  if (!db) return [];
  return db.getAll('cards');
}

export async function saveLocalCards(cards: any[]) {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction('cards', 'readwrite');
  await tx.objectStore('cards').clear();
  for (const c of cards) {
    await tx.objectStore('cards').put(c);
  }
  await tx.done;
}
