import { describe, expect, it } from 'vitest';
import { priceCart } from '../src/domain/pricing';
import type { CartLine, PricingSettings } from '../src/domain/types';
import { assembleMenu } from '../src/server/menu';
import { categories, groups, specials } from './data';
import { seedRows } from './rows';

// The seed goes through the same JSON round trip D1 gives it.
const json = (v: unknown) => JSON.stringify(v);
const rows = seedRows();
const menu = assembleMenu({
  items: rows.menu_items.map((r) => ({ ...r, name: json(r.name), description: r.description && json(r.description), tags: json(r.tags), photo: null, sold_out: 0, hidden: 0 })),
  variants: rows.item_variants.map((r) => ({ ...r, label: json(r.label), sold_out: 0 })),
  groups: rows.modifier_groups.map((r) => ({ ...r, label: json(r.label) })),
  options: rows.modifier_options.map((r) => ({ ...r, label: json(r.label), sold_out: 0 })),
  itemGroups: rows.item_modifier_groups,
});
const settings = Object.fromEntries(rows.settings.map((s) => [s.key, s.value])) as { pricing: PricingSettings };

describe('seed', () => {
  it('has unique ids and only known categories and groups', () => {
    const ids = menu.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const cats = new Set(categories.map((c) => c.id));
    expect(menu.filter((i) => !cats.has(i.categoryId))).toEqual([]);
    const groupIds = new Set(groups.map((g) => g.id));
    expect(rows.item_modifier_groups.filter((ig) => !groupIds.has(ig.group_id))).toEqual([]);
    expect(menu.length).toBeGreaterThan(60);
  });

  it('can price every dish with its required choices made', () => {
    for (const item of menu) {
      const line: CartLine = {
        itemId: item.id,
        qty: 1,
        variantId: item.variants?.[0]?.id,
        weightLb: item.unit === 'lb' ? 1 : undefined,
        options: Object.fromEntries(
          (item.modifierGroups ?? []).filter((g) => g.min > 0).map((g) => [g.id, g.options.slice(0, g.min).map((o) => o.id)]),
        ),
      };
      const result = priceCart(menu, [line], settings.pricing, 'pickup');
      expect(result, item.id).toMatchObject({ ok: true });
      if (result.ok) expect(result.subtotal, item.id).toBeGreaterThan(0);
    }
  });

  it('keeps the menu’s headline prices', () => {
    const price = (id: string, variant?: string) => {
      const item = menu.find((i) => i.id === id)!;
      return variant ? item.variants!.find((v) => v.id === variant)!.price : item.price;
    };
    expect(price('braised-oxtail')).toBe(179_900);
    expect(price('rasta-pasta', 'oxtail')).toBe(159_500);
    expect(price('quesabirria')).toBe(59_500);
    expect(price('lobster')).toBe(198_500);
  });

  it('only points specials at dishes that exist', () => {
    const ids = new Set(menu.map((i) => i.id));
    expect(specials.flatMap((s) => s.itemIds ?? []).filter((id) => !ids.has(id))).toEqual([]);
  });
});
