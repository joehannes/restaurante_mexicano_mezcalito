import { describe, expect, it } from 'vitest';
import { seedRows } from '../../seed/rows';
import { assembleMenu } from '../server/menu';
import { allowed, checkAiPlate, parsePreferences, priceOf, selectPlate, type Preferences } from './selector';

const rows = seedRows();
const json = (v: unknown) => JSON.stringify(v);
const menu = assembleMenu({
  items: rows.menu_items.map((i) => ({ ...i, name: json(i.name), description: i.description ? json(i.description) : null, tags: json(i.tags), photo: null, sold_out: 0, hidden: 0 })),
  variants: rows.item_variants.map((v) => ({ ...v, label: json(v.label), sold_out: 0 })),
  groups: rows.modifier_groups.map((g) => ({ ...g, label: json(g.label) })),
  options: rows.modifier_options.map((o) => ({ ...o, label: json(o.label), sold_out: 0 })),
  itemGroups: rows.item_modifier_groups,
});
const byId = new Map(menu.map((i) => [i.id, i]));
const base: Preferences = { hunger: 'meal', heat: 'medium', leaning: 'both', diet: [], firstTime: false, party: 2 };

describe('selectPlate', () => {
  it('always gives three picks and a drink from the real menu', () => {
    const plate = selectPlate(menu, base);
    expect(plate.picks).toHaveLength(3);
    expect(new Set(plate.picks.map((p) => p.id)).size).toBe(3);
    expect(byId.get(plate.drink!.id)?.categoryId).toBe('drinks');
  });
  it('builds a feast as starter, main and dessert', () => {
    const plate = selectPlate(menu, { ...base, hunger: 'feast' });
    expect(plate.picks.map((p) => byId.get(p.id)!.categoryId)).toEqual(['appetizers', expect.any(String), 'desserts']);
  });
  it('keeps a vegetarian plate vegetarian and a mild plate mild', () => {
    for (const p of selectPlate(menu, { ...base, diet: ['vegetarian'] }).picks) {
      const tags = byId.get(p.id)!.tags;
      expect(tags.includes('vegetarian') || tags.includes('vegetarian-option'), p.id).toBe(true);
    }
    for (const p of selectPlate(menu, { ...base, heat: 'mild' }).picks) expect(byId.get(p.id)!.heat, p.id).toBeLessThan(3);
  });
  it('leans to the island the guest asks for', () => {
    const fusion = (l: Preferences['leaning']) => selectPlate(menu, { ...base, leaning: l }).picks.reduce((s, p) => s + byId.get(p.id)!.fusion, 0);
    expect(fusion('ja')).toBeLessThan(fusion('mx'));
  });
  it('fits a shared plate within everyone’s budget together, and each meal pick within one person’s', () => {
    const snack = selectPlate(menu, { ...base, hunger: 'snack', budget: 75_000, party: 2 });
    expect(snack.picks).toHaveLength(3);
    expect(snack.picks.reduce((s, p) => s + priceOf(byId.get(p.id)!), 0)).toBeLessThanOrEqual(150_000);
    const feast = selectPlate(menu, { ...base, hunger: 'feast', budget: 100_000, party: 8 });
    expect(feast.picks).toHaveLength(3);
    for (const p of selectPlate(menu, { ...base, budget: 60_000 }).picks) expect(priceOf(byId.get(p.id)!)).toBeLessThanOrEqual(60_000);
  });
  it('lets what guests order, and tonight’s offers, tip the balance', () => {
    const quiet = selectPlate(menu, { ...base, hunger: 'snack' }).picks.map((p) => p.id);
    const loved = menu.find((i) => i.categoryId === 'appetizers' && !quiet.includes(i.id))!;
    const plate = selectPlate(menu, { ...base, hunger: 'snack' }, { popularity: new Map([[loved.id, 400]]), tonight: new Set([loved.id]) });
    expect(plate.picks[0]!.id).toBe(loved.id);
    expect(plate.picks[0]!.reasons).toEqual(expect.arrayContaining(['tonight']));
  });
  it('never offers what is sold out', () => {
    const top = selectPlate(menu, base).picks[0]!.id;
    const soldOut = menu.map((i) => (i.id === top ? { ...i, soldOut: true } : i));
    expect(selectPlate(soldOut, base).picks.map((p) => p.id)).not.toContain(top);
  });
});

describe('checkAiPlate', () => {
  const good = { picks: [{ id: 'braised-oxtail', why: 'The one Punta Cana talks about' }, { id: 'quesabirria', why: 'x' }, { id: 'rasta-pasta', why: 'y' }], drink: { id: 'drink-mango', why: 'z' } };
  it('keeps a valid answer', () => {
    expect(checkAiPlate(good, menu, base)).toMatchObject({ picks: [{ id: 'braised-oxtail' }, { id: 'quesabirria' }, { id: 'rasta-pasta' }], drink: { id: 'drink-mango' } });
  });
  it('rejects invented, repeated, sold-out or off-diet dishes, and the wrong count', () => {
    expect(checkAiPlate({ ...good, picks: [...good.picks.slice(0, 2), { id: 'unicorn-steak', why: '' }] }, menu, base)).toBeUndefined();
    expect(checkAiPlate({ ...good, picks: [good.picks[0], good.picks[0], good.picks[1]] }, menu, base)).toBeUndefined();
    expect(checkAiPlate({ ...good, picks: good.picks.slice(0, 2) }, menu, base)).toBeUndefined();
    expect(checkAiPlate(good, menu, { ...base, diet: ['vegetarian'] })).toBeUndefined();
    const soldOut = menu.map((i) => (i.id === 'quesabirria' ? { ...i, soldOut: true } : i));
    expect(checkAiPlate(good, soldOut, base)).toBeUndefined();
  });
  it('rejects a plate over budget and drops a drink that is not a drink', () => {
    expect(checkAiPlate(good, menu, { ...base, budget: 100_000 })).toBeUndefined();
    expect(checkAiPlate(good, menu, { ...base, hunger: 'feast', budget: 100_000, party: 2 })).toBeUndefined();
    expect(checkAiPlate(good, menu, { ...base, hunger: 'feast', budget: 100_000, party: 6 })).toBeDefined();
    expect(checkAiPlate({ ...good, drink: { id: 'wings', why: '' } }, menu, base)?.drink).toBeUndefined();
  });
});

describe('parsePreferences and allowed', () => {
  it('defaults anything missing or unknown', () => {
    expect(parsePreferences({ hunger: 'starving', diet: ['vegan', 'vegetarian'], party: 99, budget: -5 })).toEqual({
      hunger: 'meal',
      heat: 'medium',
      leaning: 'both',
      budget: undefined,
      diet: ['vegetarian'],
      firstTime: false,
      party: 30,
    });
  });
  it('never offers sides or drinks as a dish', () => {
    expect(allowed(byId.get('drink-mango')!, base)).toBe(false);
  });
});
