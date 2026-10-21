/**
 * The polaroid wall: photos and short silent clips of guests, the crowd and
 * the nights, captioned by hand. Staff add, caption, tilt, order and hide
 * them under Admin → Polaroid wall.
 */
import type { GalleryInput } from '../domain/adminInput';
import type { Localized } from '../domain/types';

export interface GalleryItem {
  id: number;
  kind: 'photo' | 'video';
  src: string;
  poster: string | null;
  caption: Localized;
  tilt: number;
  onHome: boolean;
  /** Pegged to the string of lights across the home page's hero. */
  onHero: boolean;
  published: boolean;
}

const row = (r: Record<string, unknown>): GalleryItem => ({
  id: Number(r.id),
  kind: r.kind === 'video' ? 'video' : 'photo',
  src: String(r.src),
  poster: (r.poster as string | null) ?? null,
  caption: JSON.parse(String(r.caption)),
  tilt: Number(r.tilt),
  onHome: !!r.on_home,
  onHero: !!r.on_hero,
  published: !!r.published,
});

/** What guests see: published only; `home` or `hero` narrows to those picked for that spot. */
export async function loadGallery(db: D1Database, { home = false, hero = false, all = false } = {}): Promise<GalleryItem[]> {
  const where = all ? '' : hero ? 'WHERE published = 1 AND on_hero = 1' : home ? 'WHERE published = 1 AND on_home = 1' : 'WHERE published = 1';
  const { results } = await db.prepare(`SELECT * FROM gallery ${where} ORDER BY position, id`).all<Record<string, unknown>>();
  return results.map(row);
}

export async function saveGalleryItem(db: D1Database, g: GalleryInput, id?: number): Promise<number | undefined> {
  const values = [g.kind, g.src, g.poster, JSON.stringify(g.caption), g.tilt, Number(g.onHome), Number(g.onHero), Number(g.published)];
  if (id !== undefined) {
    const r = await db
      .prepare('UPDATE gallery SET kind = ?, src = ?, poster = ?, caption = ?, tilt = ?, on_home = ?, on_hero = ?, published = ? WHERE id = ?')
      .bind(...values, id)
      .run();
    return r.meta.changes > 0 ? id : undefined;
  }
  // New pictures go to the front of the wall.
  const created = await db
    .prepare(
      `INSERT INTO gallery (kind, src, poster, caption, tilt, on_home, on_hero, published, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MIN(position), 1) - 1 FROM gallery)) RETURNING id`,
    )
    .bind(...values)
    .first<{ id: number }>();
  return created?.id;
}

export async function deleteGalleryItem(db: D1Database, id: number) {
  return (await db.prepare('DELETE FROM gallery WHERE id = ?').bind(id).run()).meta.changes > 0;
}

/** Saves the wall's order: `ids` first to last. */
export async function orderGallery(db: D1Database, ids: number[]) {
  await db.batch(ids.map((id, i) => db.prepare('UPDATE gallery SET position = ? WHERE id = ?').bind(i, id)));
}
