import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AppState } from "@/types";

type CacheRow = {
  state: AppState;
  pendingSync: boolean;
  savedAt: string;
};

interface MealPlannerDB extends DBSchema {
  kv: {
    key: string;
    value: CacheRow;
  };
}

let dbPromise: Promise<IDBPDatabase<MealPlannerDB>> | null = null;

function open(): Promise<IDBPDatabase<MealPlannerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MealPlannerDB>("mealplanner-offline", 1, {
      upgrade(db) {
        db.createObjectStore("kv");
      },
    });
  }
  return dbPromise;
}

export async function saveAppCache(
  tenantKey: string,
  state: AppState,
  pendingSync: boolean
): Promise<void> {
  const db = await open();
  await db.put("kv", {
    state,
    pendingSync,
    savedAt: new Date().toISOString(),
  }, tenantKey);
}

export async function loadAppCache(
  tenantKey: string
): Promise<CacheRow | undefined> {
  const db = await open();
  return db.get("kv", tenantKey);
}

export async function clearAppCache(tenantKey: string): Promise<void> {
  const db = await open();
  await db.delete("kv", tenantKey);
}
