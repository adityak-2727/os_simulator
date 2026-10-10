import {
  parseExperiment,
  validateExperiment,
  type ExperimentV1,
  MAX_JSON_BYTES,
} from './format';
export const EXPERIMENT_KEY = 'os-lab-simulator.experiments.v1';
export const PREFERENCES_KEY = 'os-lab-simulator.preferences.v1';
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export type StorageResult<T> =
  { ok: true; value: T } | { ok: false; message: string };
export function readExperiments(
  storage: StoragePort,
): StorageResult<readonly ExperimentV1[]> {
  try {
    const json = storage.getItem(EXPERIMENT_KEY);
    if (json === null) return { ok: true, value: [] };
    if (new TextEncoder().encode(json).length > 30 * MAX_JSON_BYTES)
      return {
        ok: false,
        message:
          'Saved collection is too large. Existing storage was preserved.',
      };
    const v: unknown = JSON.parse(json);
    if (
      !v ||
      typeof v !== 'object' ||
      !('schemaVersion' in v) ||
      v.schemaVersion !== 1 ||
      !('experiments' in v) ||
      !Array.isArray(v.experiments) ||
      v.experiments.length > 30
    )
      return {
        ok: false,
        message:
          'Saved collection format is invalid. Existing storage was preserved.',
      };
    const result: ExperimentV1[] = [];
    for (const item of v.experiments) {
      const parsed = validateExperiment(item);
      if (!parsed.ok)
        return {
          ok: false,
          message: `Saved collection is invalid: ${parsed.error.message} Existing storage was preserved.`,
        };
      if (result.some((e) => e.id === parsed.result.id))
        return {
          ok: false,
          message: 'Saved IDs are duplicated. Existing storage was preserved.',
        };
      result.push(parsed.result);
    }
    return { ok: true, value: result };
  } catch (e) {
    return {
      ok: false,
      message: `Cannot read local experiments: ${e instanceof Error ? e.message : 'storage unavailable'}. Existing storage was preserved. Current work remains accessible; use JSON export.`,
    };
  }
}
export function writeExperiments(
  storage: StoragePort,
  items: readonly ExperimentV1[],
): StorageResult<readonly ExperimentV1[]> {
  if (items.length > 30)
    return {
      ok: false,
      message:
        'At most 30 experiments can be saved. Export or delete an experiment first.',
    };
  const fresh: ExperimentV1[] = [];
  for (const item of items) {
    const p = parseExperiment(JSON.stringify(item));
    if (!p.ok) return { ok: false, message: p.error.message };
    if (fresh.some((e) => e.id === p.result.id))
      return { ok: false, message: 'Duplicate experiment identity.' };
    fresh.push(p.result);
  }
  try {
    storage.setItem(
      EXPERIMENT_KEY,
      JSON.stringify({ schemaVersion: 1, experiments: fresh }),
    );
    return { ok: true, value: fresh };
  } catch (e) {
    return {
      ok: false,
      message: `Cannot save locally: ${e instanceof Error ? e.message : 'storage unavailable'}. Current work was preserved; use JSON export.`,
    };
  }
}
export interface Preferences {
  readonly schemaVersion: 1;
  readonly moduleFilter: string;
}
export function readPreferences(
  storage: StoragePort,
): StorageResult<Preferences> {
  try {
    const s = storage.getItem(PREFERENCES_KEY);
    if (!s)
      return { ok: true, value: { schemaVersion: 1, moduleFilter: 'all' } };
    const v: unknown = JSON.parse(s);
    if (
      v &&
      typeof v === 'object' &&
      'schemaVersion' in v &&
      v.schemaVersion === 1 &&
      'moduleFilter' in v &&
      typeof v.moduleFilter === 'string' &&
      [
        'all',
        'cpu',
        'allocation',
        'paging',
        'deadlock',
        'synchronization',
        'disk',
        'system',
      ].includes(v.moduleFilter)
    )
      return {
        ok: true,
        value: { schemaVersion: 1, moduleFilter: v.moduleFilter },
      };
    return {
      ok: false,
      message: 'Invalid saved preferences; using default filter.',
    };
  } catch {
    return {
      ok: false,
      message: 'Preferences storage is unavailable; using default filter.',
    };
  }
}
export function writePreferences(
  storage: StoragePort,
  value: Preferences,
): StorageResult<Preferences> {
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(value));
    return { ok: true, value };
  } catch {
    return {
      ok: false,
      message:
        'Filter changed for this session; preferences could not be saved.',
    };
  }
}
