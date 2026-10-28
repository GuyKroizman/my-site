// A versioned object graph, not JSON.stringify(game): retain shared item references,
// class prototypes, Maps/Sets and Infinity without storing Phaser or executable code.
export type Registry = Record<string, { prototype: object }>;
type Node = { kind: string; type?: string; data: any };
export type SavedGraph = { root: any; nodes: Node[] };
const transient = new Set(['context', 'sprite', 'inputBuffer', 'walkPath',
  'acknowledgedWalkEnemies', 'moving', 'tweens', 'zapping']);

export function encodeGraph(root: unknown, registry: Registry): SavedGraph {
  const nodes: Node[] = [];
  const ids = new Map<object, number>();
  const names = new Map(Object.entries(registry).map(([name, cls]) => [cls.prototype, name]));
  const constructors = new Map(Object.entries(registry).map(([name, cls]) => [cls, name]));
  function encode(value: any): any {
    if (value === undefined) return { special: 'undefined' };
    if (typeof value === 'number' && !Number.isFinite(value)) return { special: String(value) };
    if (typeof value === 'function') {
      const name = constructors.get(value);
      if (!name) throw new Error('Unregistered saved constructor');
      return { constructorId: name };
    }
    if (value === null || typeof value !== 'object') return value;
    if (ids.has(value)) return { ref: ids.get(value) };
    const id = nodes.length;
    ids.set(value, id);
    const type = names.get(Object.getPrototypeOf(value));
    const kind = type ? 'entity' : Array.isArray(value) ? 'array'
      : value instanceof Map ? 'map' : value instanceof Set ? 'set' : 'object';
    if (kind === 'object' && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new Error('Unsupported save object');
    }
    const node: Node = { kind, type, data: null };
    nodes.push(node);
    if (kind === 'array' || kind === 'set') node.data = [...value].map(encode);
    else if (kind === 'map') node.data = [...value].map(([k, v]) => [encode(k), encode(v)]);
    else node.data = Object.entries(value).filter(([key, v]) =>
      !(type && (transient.has(key) || key.startsWith('UI'))) &&
      (typeof v !== 'function' || constructors.has(v as any))
    ).map(([key, v]) => [key, encode(v)]);
    return { ref: id };
  }
  return { root: encode(root), nodes };
}

export function decodeGraph(graph: SavedGraph, registry: Registry, hydrate?: (entity: any) => void): any {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length > 100000) throw new Error('Invalid save graph');
  const objects = graph.nodes.map(node => {
    if (!node || !Array.isArray(node.data)) throw new Error('Invalid save node');
    if (node.kind === 'entity') {
      if (!node.type || !Object.prototype.hasOwnProperty.call(registry, node.type)) throw new Error('Unknown saved entity');
      return Object.create(registry[node.type].prototype);
    }
    if (node.kind === 'array') return [];
    if (node.kind === 'map') return new Map();
    if (node.kind === 'set') return new Set();
    if (node.kind === 'object') return {};
    throw new Error('Unknown save node');
  });
  function decode(value: any): any {
    if (value === null || typeof value !== 'object') return value;
    if (Object.prototype.hasOwnProperty.call(value, 'ref')) {
      if (!Number.isInteger(value.ref) || value.ref < 0 || value.ref >= objects.length) throw new Error('Invalid save reference');
      return objects[value.ref];
    }
    if (Object.prototype.hasOwnProperty.call(value, 'constructorId') && Object.prototype.hasOwnProperty.call(registry, value.constructorId)) return registry[value.constructorId];
    if (value.special === 'undefined') return undefined;
    if (value.special === 'Infinity') return Infinity;
    if (value.special === '-Infinity') return -Infinity;
    if (value.special === 'NaN') return NaN;
    throw new Error('Invalid save value');
  }
  graph.nodes.forEach((node, i) => {
    const target = objects[i];
    if (node.kind === 'array') target.push(...node.data.map(decode));
    else if (node.kind === 'set') node.data.forEach((v: any) => target.add(decode(v)));
    else if (node.kind === 'map') node.data.forEach(([k, v]: any[]) => target.set(decode(k), decode(v)));
    else for (const [key, value] of node.data) {
      if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Invalid save key');
      if (node.kind === 'entity' && (transient.has(key) || key.startsWith('UI'))) throw new Error('Invalid entity field');
      Object.defineProperty(target, key, { value: decode(value), writable: true, enumerable: true, configurable: true });
    }
  });
  graph.nodes.forEach((node, i) => { if (node.kind === 'entity') hydrate?.(objects[i]); });
  return decode(graph.root);
}
