import type { SavedGraph } from './saveCodec';

export const SAVE_KEY = 'rogue0.run.v1';
export type RunSave = {
  version: 1;
  heroClass: string;
  floor: number;
  savedAt: string;
  graph: SavedGraph;
};
export type SaveInfo = { save?: RunSave; error?: string };
const HEROES = ['Warrior', 'Dwarf', 'Cleric', 'Elf', 'Wizard'];

export function readRunSave(): SaveInfo {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return {};
    const save = JSON.parse(raw) as RunSave;
    if (save.version !== 1 || !HEROES.includes(save.heroClass) ||
        !Number.isInteger(save.floor) || save.floor < 1 || save.floor > 25 ||
        !save.graph || !Array.isArray(save.graph.nodes)) throw new Error('Invalid save');
    return { save };
  } catch {
    return { error: 'The saved run is unavailable or incompatible. You can start a new game.' };
  }
}

export function writeRunSave(save: RunSave): boolean {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); return true; }
  catch { return false; }
}

export function clearRunSave(): boolean {
  try { localStorage.removeItem(SAVE_KEY); return true; }
  catch { return false; }
}
