import Database from 'better-sqlite3';
import { setTestDatabase, resetTestDatabase } from '../../db';

function createAsyncMock(betterDb: Database.Database) {
  return {
    execAsync(sql: string) {
      betterDb.exec(sql);
      return Promise.resolve();
    },
    getAllAsync<T = any>(sql: string, params?: any[]) {
      const rows = params
        ? betterDb.prepare(sql).all(...params)
        : betterDb.prepare(sql).all();
      return Promise.resolve(rows as T[]);
    },
    getFirstAsync<T = any>(sql: string, params?: any[]) {
      const row = params
        ? betterDb.prepare(sql).get(...params)
        : betterDb.prepare(sql).get();
      return Promise.resolve((row ?? null) as T);
    },
    runAsync(sql: string, params?: any[]) {
      const stmt = betterDb.prepare(sql);
      const result = params ? stmt.run(...params) : stmt.run();
      return Promise.resolve({
        lastInsertRowId: result.lastInsertRowid as number,
        changes: result.changes,
      });
    },
  };
}

export function setupTestDb() {
  const sqlite = new Database(':memory:');
  const mockDb = createAsyncMock(sqlite);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      amount REAL NOT NULL,
      month TEXT NOT NULL,
      payDate INTEGER NOT NULL,
      frequency TEXT DEFAULT 'monthly',
      weekDay INTEGER,
      startDate TEXT,
      adjustment INTEGER DEFAULT false,
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
      adjustment INTEGER DEFAULT false,
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
    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      date TEXT NOT NULL,
      name TEXT DEFAULT '',
      recurring INTEGER DEFAULT true,
      affectsPay INTEGER DEFAULT true
    );
  `);

  setTestDatabase(mockDb);
  return { sqlite, mockDb };
}

export function teardownTestDb() {
  resetTestDatabase();
}
