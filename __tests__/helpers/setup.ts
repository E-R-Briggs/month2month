import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema';
import { setTestDatabase, resetTestDatabase } from '../../db';

export function setupTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      amount REAL NOT NULL,
      month TEXT NOT NULL,
      payDate INTEGER NOT NULL,
      frequency TEXT DEFAULT 'monthly',
      weekDay INTEGER,
      startDate TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      isRecurring INTEGER DEFAULT false,
      date TEXT,
      startMonth TEXT,
      endMonth TEXT,
      dueDay INTEGER,
      frequency TEXT DEFAULT 'monthly',
      weekDay INTEGER,
      category TEXT DEFAULT 'other',
      labelId INTEGER,
      overrideMonth TEXT,
      type TEXT DEFAULT 'expense',
      createdAt INTEGER,
      updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS sync_deletions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      tableName TEXT NOT NULL,
      rowId INTEGER NOT NULL,
      deletedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL
    );
  `);

  setTestDatabase(db);
  return { sqlite, db };
}

export function teardownTestDb() {
  resetTestDatabase();
}
