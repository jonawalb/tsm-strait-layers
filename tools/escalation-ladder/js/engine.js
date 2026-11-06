// Pure scenario logic: replay a path (list of option indices) through the tree and return every step.
import { NODES, START } from '../data/tree.js';

const clamp = v => Math.max(0, Math.min(100, v));
const KEYS = ['risk', 'cred', 'cost'];

function apply(m, fx) {
  const out = { ...m };
  if (fx) KEYS.forEach(k => { out[k] = clamp(out[k] + (fx[k] || 0)); });
  return out;
}

/**
 * Walk a path from the start node. Invalid indices stop the walk.
 * Returns { steps, node, nodeId, meters, peak, path } where each step is
 * { nodeId, node, choice, opt, before, after, delta } for choices already made.
 */
export function walk(path = []) {
  let id = 'start';
  let meters = apply(START, NODES.start.enter);
  let peak = NODES.start.rung;
  const steps = [];
  const valid = [];
  for (const idx of path) {
    const node = NODES[id];
    const opt = node.opts && node.opts[idx];
    if (!opt) break;
    const before = meters;
    const nextId = opt.next;
    const afterChoice = apply(before, opt.fx);
    const after = apply(afterChoice, NODES[nextId].enter);
    const delta = Object.fromEntries(KEYS.map(k => [k, after[k] - before[k]]));
    steps.push({ nodeId: id, node, choice: idx, opt, before, after, delta });
    valid.push(idx);
    meters = after;
    id = nextId;
    peak = Math.max(peak, NODES[id].rung);
  }
  return { steps, node: NODES[id], nodeId: id, meters, peak, path: valid };
}

/** Node ids visited by a path, in order, including the current node. */
export function visited(path) {
  const w = walk(path);
  return [...w.steps.map(s => s.nodeId), w.nodeId];
}

/** Plain-language band for a meter value. */
export function band(v) {
  if (v >= 70) return 'very high';
  if (v >= 50) return 'high';
  if (v >= 30) return 'moderate';
  return 'low';
}

export { NODES, KEYS };
