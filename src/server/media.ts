/**
 * Every write to R2 goes through here, so the bucket never leaves
 * Cloudflare's free tier. R2 has no spending cap of its own: past 10 GB
 * stored or a million writes a month it bills. Reads need no guard, since
 * the Workers Free plan's 100,000 requests a day stay under R2's ten million
 * free reads a month.
 *
 * Nothing deletes media, so the byte count only grows; overwriting a key
 * counts it twice. Both err on the side of refusing early.
 */

/** Under the free 10 GB and 1,000,000 writes a month, whenever the month starts. */
export const MEDIA_LIMITS = { bytes: 9 * 1024 ** 3, writesPerDay: 25_000 };

type Body = ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob;

/**
 * Stores `body` under `key` if the free tier has room for `size` more bytes
 * and one more write today. False when it has not; nothing is written then.
 */
export async function putMedia(env: Env, key: string, body: Body, size: number, contentType: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const reserved = await env.DB.prepare(
    `UPDATE media_usage
        SET writes = CASE WHEN day = ?1 THEN writes + 1 ELSE 1 END, day = ?1, bytes = bytes + ?2
      WHERE id = 1 AND bytes + ?2 <= ?3 AND (day <> ?1 OR writes < ?4)
      RETURNING bytes`,
  )
    .bind(day, size, MEDIA_LIMITS.bytes, MEDIA_LIMITS.writesPerDay)
    .first();
  if (!reserved) {
    console.warn('media write refused: free tier limit', key, size);
    return false;
  }
  try {
    await env.MEDIA.put(key, body, { httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' } });
    return true;
  } catch (error) {
    await env.DB.prepare('UPDATE media_usage SET bytes = MAX(0, bytes - ?) WHERE id = 1').bind(size).run();
    throw error;
  }
}
