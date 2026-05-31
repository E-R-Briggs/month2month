export function openDatabaseSync() {
  return {
    execSync: () => {},
    getAllSync: () => [],
    runSync: () => ({ lastInsertRowId: 0, changes: 0 }),
  };
}
