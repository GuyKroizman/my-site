import { Entity } from './entity';
import type { Registry } from './saveCodec';

// File/export IDs survive production minification (constructor.name does not).
const modules = import.meta.glob(['./items/*.ts', './monsters/*.ts', './classes/*.ts'], { eager: true });
export const saveRegistry: Registry = {};
for (const [path, exports] of Object.entries(modules)) {
  for (const [name, value] of Object.entries(exports as Record<string, any>)) {
    if (typeof value === 'function' && value.prototype instanceof Entity) {
      saveRegistry[`${path}:${name}`] = value;
    }
  }
}
