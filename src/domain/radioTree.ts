/**
 * Mezcalito Radio: a short branching path of spoken questions that ends in a
 * plate. Each answer carries traits — pieces of Selector preferences — and
 * the path's traits add up to the guest's preferences.
 */
import { DIETS, HEATS, HUNGERS, LEANINGS, type Preferences } from './selector';
import type { Localized } from './types';

export interface RadioOption {
  id: string;
  label: Localized;
  /** The next question; none ends the path. */
  next?: string;
  traits: Partial<Preferences>;
}

export interface RadioNode {
  id: string;
  prompt: Localized;
  options: RadioOption[];
}

export const START = 'start';

export interface Answer {
  node: string;
  option: string;
}

const BASE: Preferences = { hunger: 'meal', heat: 'medium', leaning: 'both', diet: [], firstTime: false, party: 2 };

/** Merge traits: later answers win, diets add up. */
export function preferencesFrom(traits: Partial<Preferences>[]): Preferences {
  return traits.reduce<Preferences>((prefs, t) => ({ ...prefs, ...t, diet: [...new Set([...prefs.diet, ...(t.diet ?? [])])] }), { ...BASE, diet: [] });
}

/**
 * Follows the answers from the start. Stops at the first answer that does
 * not fit the tree, so a tampered or stale path still yields a plate from
 * what was valid.
 */
export function walk(nodes: readonly RadioNode[], answers: readonly Answer[]): { prefs: Preferences; path: Answer[]; next?: RadioNode } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: Answer[] = [];
  const traits: Partial<Preferences>[] = [];
  let node = byId.get(START);
  for (const answer of answers) {
    if (!node || answer.node !== node.id) break;
    const option = node.options.find((o) => o.id === answer.option);
    if (!option) break;
    path.push(answer);
    traits.push(option.traits);
    node = option.next ? byId.get(option.next) : undefined;
  }
  return { prefs: preferencesFrom(traits), path, next: node };
}

/** Options in the order past guests chose them most, ties kept as written. */
export function byPopularity(options: readonly RadioOption[], counts: ReadonlyMap<string, number> = new Map()): RadioOption[] {
  return options
    .map((o, i) => ({ o, i, n: counts.get(o.id) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map(({ o }) => o);
}

/** Problems that would strand a guest: a missing start, dead links, loops, questions no path reaches. */
export function treeProblems(nodes: readonly RadioNode[]): string[] {
  const problems: string[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (!byId.has(START)) problems.push(`no "${START}" question`);
  for (const n of nodes) {
    if (!n.options.length) problems.push(`${n.id}: no answers`);
    for (const o of n.options) if (o.next && !byId.has(o.next)) problems.push(`${n.id}/${o.id}: leads to missing "${o.next}"`);
  }
  // Every path must end: depth-first search for a cycle.
  const state = new Map<string, 'open' | 'done'>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 'open') return false;
    if (state.get(id) === 'done') return true;
    state.set(id, 'open');
    const ok = (byId.get(id)?.options ?? []).every((o) => !o.next || !byId.has(o.next) || visit(o.next));
    state.set(id, 'done');
    return ok;
  };
  if (byId.has(START) && !visit(START)) problems.push('a path loops back on itself');
  for (const n of nodes) if (!state.has(n.id)) problems.push(`${n.id}: no path reaches it`);
  return problems;
}

/** Traits from untrusted input: only known preference values survive. */
export function cleanTraits(v: unknown): Partial<Preferences> {
  if (!v || typeof v !== 'object') return {};
  const t = v as Record<string, unknown>;
  const out: Partial<Preferences> = {};
  if (HUNGERS.includes(t.hunger as never)) out.hunger = t.hunger as Preferences['hunger'];
  if (HEATS.includes(t.heat as never)) out.heat = t.heat as Preferences['heat'];
  if (LEANINGS.includes(t.leaning as never)) out.leaning = t.leaning as Preferences['leaning'];
  if (Number.isInteger(t.budget) && (t.budget as number) > 0) out.budget = t.budget as number;
  if (Array.isArray(t.diet)) out.diet = t.diet.filter((d): d is Preferences['diet'][number] => DIETS.includes(d as never));
  if (t.firstTime === true) out.firstTime = true;
  if (Number.isInteger(t.party) && (t.party as number) >= 1 && (t.party as number) <= 30) out.party = t.party as number;
  return out;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ');

/** Which answer a spoken phrase means: the whole label, or one of its longer words. */
export function matchAnswer(heard: string, options: readonly { id: string; label: string }[]): string | undefined {
  const said = fold(heard);
  const words = new Set(said.split(/\s+/).filter((w) => w.length >= 4));
  return (
    options.find((o) => said.includes(fold(o.label).trim()))?.id ??
    options.find((o) =>
      fold(o.label)
        .split(/\s+/)
        .some((w) => w.length >= 4 && words.has(w)),
    )?.id
  );
}
