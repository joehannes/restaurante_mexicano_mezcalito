/**
 * Loading the menu from D1 into the shape the pricing core works with.
 *
 * Five small tables become one list of items. `assembleMenu` is pure so the
 * same assembly can be tested against the seed data without a database.
 */
import type { Localized, MenuItem, ModifierGroup } from '../domain/types';

export interface ItemRow {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  unit: 'each' | 'lb';
  heat: number;
  fusion: number;
  tags: string;
  photo: string | null;
  sold_out: number;
  hidden: number;
}
export interface VariantRow {
  item_id: string;
  id: string;
  label: string;
  price: number;
  sold_out: number;
}
export interface GroupRow {
  id: string;
  label: string;
  min: number;
  max: number;
}
export interface OptionRow {
  group_id: string;
  id: string;
  label: string;
  price: number;
  sold_out: number;
}
export interface ItemGroupRow {
  item_id: string;
  group_id: string;
}

export interface MenuRows {
  items: ItemRow[];
  variants: VariantRow[];
  groups: GroupRow[];
  options: OptionRow[];
  itemGroups: ItemGroupRow[];
}

const text = (json: string): Localized => JSON.parse(json) as Localized;

/** Rows must arrive in display order (ORDER BY position). */
export function assembleMenu(rows: MenuRows): MenuItem[] {
  const groups = new Map<string, ModifierGroup>(
    rows.groups.map((g) => [g.id, { id: g.id, label: text(g.label), min: g.min, max: g.max, options: [] }]),
  );
  for (const o of rows.options) {
    groups.get(o.group_id)?.options.push({ id: o.id, label: text(o.label), price: o.price, soldOut: !!o.sold_out });
  }
  return rows.items.map((row) => {
    const variants = rows.variants
      .filter((v) => v.item_id === row.id)
      .map((v) => ({ id: v.id, label: text(v.label), price: v.price, soldOut: !!v.sold_out }));
    const modifierGroups = rows.itemGroups
      .filter((ig) => ig.item_id === row.id)
      .map((ig) => groups.get(ig.group_id))
      .filter((g): g is ModifierGroup => !!g);
    return {
      id: row.id,
      categoryId: row.category_id,
      name: text(row.name),
      description: row.description ? text(row.description) : undefined,
      price: row.price,
      unit: row.unit,
      variants: variants.length ? variants : undefined,
      modifierGroups: modifierGroups.length ? modifierGroups : undefined,
      heat: row.heat,
      fusion: row.fusion,
      tags: JSON.parse(row.tags) as string[],
      photo: row.photo ?? undefined,
      soldOut: !!row.sold_out,
      hidden: !!row.hidden,
    };
  });
}

export async function loadMenu(db: D1Database): Promise<MenuItem[]> {
  const [items, variants, groups, options, itemGroups] = await db.batch([
    db.prepare('SELECT * FROM menu_items ORDER BY position'),
    db.prepare('SELECT * FROM item_variants ORDER BY item_id, position'),
    db.prepare('SELECT * FROM modifier_groups'),
    db.prepare('SELECT * FROM modifier_options ORDER BY group_id, position'),
    db.prepare('SELECT * FROM item_modifier_groups ORDER BY item_id, position'),
  ]);
  return assembleMenu({
    items: items!.results as unknown as ItemRow[],
    variants: variants!.results as unknown as VariantRow[],
    groups: groups!.results as unknown as GroupRow[],
    options: options!.results as unknown as OptionRow[],
    itemGroups: itemGroups!.results as unknown as ItemGroupRow[],
  });
}

export interface Category {
  id: string;
  name: Localized;
}

export async function loadCategories(db: D1Database): Promise<Category[]> {
  const { results } = await db.prepare('SELECT id, name FROM categories WHERE hidden = 0 ORDER BY position').all<{ id: string; name: string }>();
  return results.map((r) => ({ id: r.id, name: text(r.name) }));
}
