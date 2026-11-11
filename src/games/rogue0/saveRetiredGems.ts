import type { SavedGraph } from './saveCodec.ts';

const GEM_TYPE = './items/gem.ts:default';
const absent = () => ({ special: 'undefined' });

/** Remove retired regular Gems before decoding: old saves must not require the
 * deleted gameplay class. No replacement item is granted. Keep quickslot
 * positions and loot-table weights (old Gem constructors become no-drop slots).
 * Work on a copy so a failed load never mutates the saved checkpoint. */
export function retireGemsFromSave(graph: SavedGraph): SavedGraph {
  if (!graph || !Array.isArray(graph.nodes)) return graph; // decoder validates
  const gems = new Set<number>();
  const positional = new Set<number>();
  const weighted = new Set<number>();
  graph.nodes.forEach((node, i) => {
    if (node?.kind === 'entity' && node.type === GEM_TYPE) gems.add(i);
    if ((node?.kind === 'entity' || node?.kind === 'object') && Array.isArray(node.data)) {
      for (const entry of node.data) {
        if (!Array.isArray(entry) || !Number.isInteger(entry[1]?.ref)) continue;
        // Quickslot positions must survive; loot tables keep their weights so
        // the remaining outcomes roll exactly as before.
        if (entry[0] === 'quickslots') positional.add(entry[1].ref);
        if (entry[0] === 'loot') weighted.add(entry[1].ref);
      }
    }
  });
  const isGem = (value: any) => value && typeof value === 'object' && gems.has(value.ref);
  const rewrite = (value: any) => isGem(value) ? absent()
    : value?.constructorId === GEM_TYPE ? false : value;
  // Loot tables roll one entry by weight, so a retired slot becomes the same
  // no-drop `false` the live tables use instead of disappearing.
  const rewriteWeight = (value: any) => isGem(value) ? false : rewrite(value);
  return {
    root: rewrite(graph.root),
    nodes: graph.nodes.map((node, i) => {
      // decodeGraph allocates even unreachable nodes. Replace retired entities
      // with empty plain nodes, never with a spawnable compatibility class.
      if (gems.has(i)) return { kind: 'object', data: [] };
      if (!node || !Array.isArray(node.data)) return node;
      if (node.kind === 'array' || node.kind === 'set') {
        if (weighted.has(i)) return { ...node, data: node.data.map(rewriteWeight) };
        return { ...node, data: node.data.filter((v: any) => positional.has(i) || !isGem(v)).map(rewrite) };
      }
      if (node.kind === 'map') {
        return { ...node, data: node.data.filter(([k, v]: any[]) => !isGem(k) && !isGem(v))
          .map(([k, v]: any[]) => [rewrite(k), rewrite(v)]) };
      }
      if (node.kind === 'entity' || node.kind === 'object') {
        // If an old shop ever stocked a Gem, keep its slot unavailable instead
        // of replenishing it or failing validation on a missing unsold item.
        const removedStock = node.data.some(([key, value]: any[]) => key === 'item' && isGem(value));
        return { ...node, data: node.data.map(([key, value]: any[]) =>
          [key, removedStock && key === 'sold' ? true : rewrite(value)]) };
      }
      return node;
    }),
  };
}
