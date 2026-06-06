import { getDatabase } from '../db';
import { setupTestDb, teardownTestDb } from './helpers/setup';
import { getLabels, getLabel, getOrCreateLabel } from '../db';

const DEFAULT_LABELS = [
  { name: 'Bills', color: '#ef4444' },
  { name: 'Subscription', color: '#f59e0b' },
  { name: 'Food', color: '#22c55e' },
  { name: 'Transport', color: '#3b82f6' },
  { name: 'Shopping', color: '#a855f7' },
  { name: 'Other', color: '#6b7280' },
];

async function seedLabels() {
  const db = await getDatabase();
  for (const l of DEFAULT_LABELS) {
    const existing = await db.getAllAsync('SELECT id FROM labels WHERE name = ? LIMIT 1', [l.name]);
    if (existing.length === 0) {
      await db.runAsync('INSERT INTO labels (name, color) VALUES (?, ?)', [l.name, l.color]);
    }
  }
}

beforeEach(async () => {
  setupTestDb();
  await seedLabels();
});

afterEach(() => {
  teardownTestDb();
});

describe('getLabels', () => {
  it('returns the 6 default labels', async () => {
    const labels = await getLabels();
    expect(labels).toHaveLength(6);
    expect(labels.map(l => l.name)).toEqual([
      'Bills', 'Food', 'Other', 'Shopping', 'Subscription', 'Transport',
    ]);
  });
});

describe('getLabel', () => {
  it('returns a label by id', async () => {
    const labels = await getLabels();
    const first = labels[0];
    const found = await getLabel(first.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe(first.name);
  });

  it('returns undefined for unknown id', async () => {
    const found = await getLabel(999);
    expect(found).toBeUndefined();
  });
});

describe('getOrCreateLabel', () => {
  it('returns an existing label by case-insensitive match', async () => {
    const label = await getOrCreateLabel('bills', '#ff0000');
    expect(label.name).toBe('Bills');
    expect(label.color).toBe('#ef4444');
  });

  it('creates a new label with title-cased name', async () => {
    const label = await getOrCreateLabel('groceries', '#22c55e');
    expect(label.name).toBe('Groceries');
    expect(label.color).toBe('#22c55e');
  });

  it('returns the "Other" label for empty name', async () => {
    const label = await getOrCreateLabel('', '#ff0000');
    expect(label.name).toBe('Other');
  });
});
