/**
 * seed/data.ts as table rows, in display order. Shared by the SQL generator
 * and the test that checks every seeded dish can actually be ordered.
 */
import { categories, groups, items, seasons, settings, specials } from './data.ts';

export function seedRows() {
  return {
    categories: categories.map((c, position) => ({ id: c.id, name: c.name, position })),
    modifier_groups: groups.map((g) => ({ id: g.id, label: g.label, min: g.min, max: g.max })),
    modifier_options: groups.flatMap((g) =>
      g.options.map((o, position) => ({ group_id: g.id, id: o.id, label: o.label, price: o.price, position })),
    ),
    menu_items: items.map((item, position) => ({
      id: item.id,
      category_id: item.category,
      name: item.name,
      description: item.description ?? null,
      price: item.price ?? 0,
      unit: item.unit ?? 'each',
      heat: item.heat ?? 0,
      fusion: item.fusion ?? 0,
      tags: item.tags ?? [],
      position,
    })),
    item_variants: items.flatMap((item) =>
      (item.variants ?? []).map((v, position) => ({ item_id: item.id, id: v.id, label: v.label, price: v.price, position })),
    ),
    item_modifier_groups: items.flatMap((item) =>
      (item.groups ?? []).map((group_id, position) => ({ item_id: item.id, group_id, position })),
    ),
    specials: specials.map((s, position) => ({
      id: s.id,
      title: s.title,
      body: s.body,
      days: s.days,
      start_time: s.start,
      end_time: s.end,
      price: s.price ?? null,
      cta: s.cta,
      item_ids: s.itemIds ?? [],
      flyer: s.flyer,
      position,
    })),
    seasons: seasons.map((s) => ({
      slug: s.slug,
      name: s.name,
      starts_on: s.startsOn,
      ends_on: s.endsOn,
      priority: s.priority,
      published: s.published,
      tokens: s.tokens,
      hero: s.hero,
    })),
    settings: Object.entries(settings).map(([key, value]) => ({ key, value })),
  };
}
