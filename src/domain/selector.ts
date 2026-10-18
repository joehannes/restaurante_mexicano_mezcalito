/**
 * The Selector picks a plate the way a selector picks the record: read the
 * room, then play the right three. This is the deterministic half — the
 * scoring used whenever the AI is slow, unsure or unavailable, and the
 * checks every AI answer must pass before a guest sees it.
 */
import type { MenuItem } from './types';

export const HUNGERS = ['snack', 'meal', 'feast'] as const;
export const HEATS = ['mild', 'medium', 'hot'] as const;
export const LEANINGS = ['ja', 'mx', 'both'] as const;
export const DIETS = ['vegetarian', 'no-seafood', 'seafood'] as const;

export interface Preferences {
  hunger: (typeof HUNGERS)[number];
  heat: (typeof HEATS)[number];
  leaning: (typeof LEANINGS)[number];
  /** Most a guest wants to spend on their own food, in centavos, before ITBIS and service. */
  budget?: number;
  diet: (typeof DIETS)[number][];
  firstTime: boolean;
  party: number;
}

export type Reason = 'signature' | 'firstTimer' | 'heat' | 'gentle' | 'jamaica' | 'mexico' | 'fusion' | 'seafood' | 'vegetarian' | 'popular' | 'tonight' | 'pairs';

export interface Pick {
  id: string;
  reasons: Reason[];
}
export interface Plate {
  picks: Pick[];
  drink?: Pick;
}

export interface Context {
  /** Times each dish was ordered recently: what guests actually choose. */
  popularity?: ReadonlyMap<string, number>;
  /** Dishes on tonight's offers. */
  tonight?: ReadonlySet<string>;
}

const STARTERS = ['appetizers'];
const MAINS = ['rasta-pasta', 'specialties', 'tacos', 'seafood', 'bowls-wraps', 'burgers', 'salads'];
const DESSERTS = ['desserts'];
const PICKABLE = new Set([...STARTERS, ...MAINS, ...DESSERTS]);

/** The cheapest way to order the dish. */
export const priceOf = (item: MenuItem) => {
  const variants = item.variants?.filter((v) => !v.soldOut);
  return variants?.length ? Math.min(...variants.map((v) => v.price)) : item.price;
};

const isVegetarian = (item: MenuItem) => item.tags.includes('vegetarian') || item.tags.includes('vegetarian-option');

/** May this guest be offered this dish at all? */
export function allowed(item: MenuItem, prefs: Preferences): boolean {
  if (item.hidden || item.soldOut || !PICKABLE.has(item.categoryId)) return false;
  if (item.variants?.length && item.variants.every((v) => v.soldOut)) return false;
  if (prefs.diet.includes('vegetarian') && !isVegetarian(item)) return false;
  if (prefs.diet.includes('no-seafood') && item.tags.includes('seafood')) return false;
  if (prefs.heat === 'mild' && item.heat >= 3) return false;
  return true;
}

const HEAT_TARGET = { mild: 0.5, medium: 2.5, hot: 4.5 } as const;

export function score(item: MenuItem, prefs: Preferences, ctx: Context = {}): { score: number; reasons: Reason[] } {
  const reasons: [Reason, number][] = [];
  let total = 0;
  const add = (points: number, reason?: Reason) => {
    total += points;
    if (reason && points > 0) reasons.push([reason, points]);
  };

  add(-Math.abs(item.heat - HEAT_TARGET[prefs.heat]) * 0.8);
  if (prefs.heat === 'hot' && item.heat >= 4) add(1.5, 'heat');
  if (prefs.heat === 'mild' && item.heat <= 1) add(0.5, 'gentle');

  if (prefs.leaning === 'ja') add(-item.fusion * 1.2, 'jamaica');
  else if (prefs.leaning === 'mx') add(item.fusion * 1.2, 'mexico');
  else add((2 - Math.abs(item.fusion)) * 0.8, 'fusion');

  if (item.tags.includes('signature')) add(2, 'signature');
  if (prefs.firstTime && item.tags.includes('first-timer')) add(3, 'firstTimer');
  if (prefs.diet.includes('seafood') && item.tags.includes('seafood')) add(3, 'seafood');
  if (prefs.diet.includes('vegetarian')) add(0.1, 'vegetarian');

  const ordered = ctx.popularity?.get(item.id) ?? 0;
  if (ordered > 0) add(Math.log2(1 + ordered) * 0.6, 'popular');
  if (ctx.tonight?.has(item.id)) add(2, 'tonight');

  return { score: total, reasons: reasons.sort((a, b) => b[1] - a[1]).map(([r]) => r).slice(0, 2) };
}

/** Which courses make up each kind of hunger. */
const SHAPES: Record<Preferences['hunger'], string[][]> = {
  snack: [STARTERS, [...STARTERS, 'tacos'], [...STARTERS, 'tacos']],
  meal: [MAINS, MAINS, MAINS],
  feast: [STARTERS, MAINS, DESSERTS],
};

/** Three picks and a drink, from the rules alone. Always answers, even if only with fewer picks. */
export function selectPlate(menu: readonly MenuItem[], prefs: Preferences, ctx: Context = {}): Plate {
  const ranked = menu
    .filter((i) => allowed(i, prefs))
    .map((item) => ({ item, ...score(item, prefs, ctx) }))
    .sort((a, b) => b.score - a.score || priceOf(a.item) - priceOf(b.item) || a.item.id.localeCompare(b.item.id));

  // A snack or a feast is shared by the party, so everyone's budget covers
  // all three together; for a meal the three are alternatives, so each must
  // fit one person's budget on its own.
  const shared = prefs.hunger !== 'meal';
  const limit = prefs.budget === undefined ? undefined : shared ? prefs.budget * prefs.party : prefs.budget;
  const picks: Pick[] = [];
  const used = new Set<string>();
  const categories = new Set<string>();
  let spent = 0;
  for (const course of SHAPES[prefs.hunger]) {
    const fits = (r: (typeof ranked)[number]) =>
      !used.has(r.item.id) && course.includes(r.item.categoryId) && (limit === undefined || (shared ? spent : 0) + priceOf(r.item) <= limit);
    // Prefer a course from a category not yet on the plate, for variety.
    const choice = ranked.find((r) => fits(r) && !categories.has(r.item.categoryId)) ?? ranked.find(fits);
    if (!choice) continue;
    used.add(choice.item.id);
    categories.add(choice.item.categoryId);
    spent += priceOf(choice.item);
    picks.push({ id: choice.item.id, reasons: choice.reasons });
  }
  return { picks, drink: pickDrink(menu, prefs, ctx) };
}

/** Juices to cool the heat or match the island; sodas otherwise; the most ordered wins a tie. */
const DRINK_LIKES: Record<Preferences['leaning'], string[]> = {
  ja: ['drink-ginger-ale', 'drink-mango', 'drink-pineapple'],
  mx: ['drink-mango', 'drink-pineapple', 'drink-passionfruit'],
  both: ['drink-passionfruit', 'drink-pineapple', 'drink-mango'],
};

function pickDrink(menu: readonly MenuItem[], prefs: Preferences, ctx: Context): Pick | undefined {
  const drinks = menu.filter((i) => i.categoryId === 'drinks' && !i.soldOut && !i.hidden);
  const likes = prefs.heat === 'hot' ? ['drink-pineapple', 'drink-passionfruit', ...DRINK_LIKES[prefs.leaning]] : DRINK_LIKES[prefs.leaning];
  const preferred = likes.map((id) => drinks.find((d) => d.id === id)).find(Boolean);
  const popular = [...drinks].sort((a, b) => (ctx.popularity?.get(b.id) ?? 0) - (ctx.popularity?.get(a.id) ?? 0))[0];
  const drink = preferred ?? popular;
  return drink ? { id: drink.id, reasons: preferred ? ['pairs'] : ['popular'] } : undefined;
}

export interface AiPlate {
  picks: { id: string; why: string }[];
  drink?: { id: string; why: string };
  note?: string;
}

/**
 * Keep an AI answer only if every id is a real, available dish this guest
 * may have, there are no repeats, it fits the budget, and there are three.
 */
export function checkAiPlate(raw: unknown, menu: readonly MenuItem[], prefs: Preferences): AiPlate | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as { picks?: unknown; drink?: unknown; note?: unknown };
  if (!Array.isArray(r.picks) || r.picks.length !== 3) return undefined;
  const byId = new Map(menu.map((i) => [i.id, i]));
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const picks: AiPlate['picks'] = [];
  for (const p of r.picks as { id?: unknown; why?: unknown }[]) {
    const item = byId.get(String(p?.id));
    if (!item || !allowed(item, prefs) || picks.some((x) => x.id === item.id)) return undefined;
    picks.push({ id: item.id, why: text(p.why, 200) });
  }
  if (prefs.budget !== undefined) {
    const prices = picks.map((p) => priceOf(byId.get(p.id)!));
    const over = prefs.hunger === 'meal' ? prices.some((x) => x > prefs.budget!) : prices.reduce((a, b) => a + b, 0) > prefs.budget * prefs.party;
    if (over) return undefined;
  }
  let drink: AiPlate['drink'];
  if (r.drink && typeof r.drink === 'object') {
    const d = byId.get(String((r.drink as { id?: unknown }).id));
    if (d && d.categoryId === 'drinks' && !d.soldOut && !d.hidden) drink = { id: d.id, why: text((r.drink as { why?: unknown }).why, 200) };
  }
  return { picks, drink, note: text(r.note, 300) || undefined };
}

/** Preferences from a request body, with safe defaults for anything missing. */
export function parsePreferences(body: unknown): Preferences {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const one = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
  const budget = Number.isInteger(b.budget) && (b.budget as number) > 0 && (b.budget as number) <= 10_000_000 ? (b.budget as number) : undefined;
  const party = Number.isInteger(b.party) ? Math.min(30, Math.max(1, b.party as number)) : 2;
  return {
    hunger: one(HUNGERS, b.hunger, 'meal'),
    heat: one(HEATS, b.heat, 'medium'),
    leaning: one(LEANINGS, b.leaning, 'both'),
    budget,
    diet: Array.isArray(b.diet) ? [...new Set(b.diet.filter((d): d is Preferences['diet'][number] => DIETS.includes(d as never)))] : [],
    firstTime: b.firstTime === true,
    party,
  };
}
