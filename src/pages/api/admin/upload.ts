import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { guard, json } from '../../../server/admin';

const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'audio/mpeg': 'mp3',
};
const MAX_BYTES = 8 * 1024 * 1024;

/** A photo, flyer or audio file into R2. Returns the public /media/ path. */
export const POST: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'menu');
  if (staff instanceof Response) return staff;
  const form = await request.formData().catch(() => undefined);
  const file = form?.get('file');
  if (!(file instanceof File)) return json({ error: 'invalid', fields: ['file'] }, 400);
  const ext = TYPES[file.type];
  if (!ext) return json({ error: 'unsupported_type' }, 415);
  if (file.size > MAX_BYTES) return json({ error: 'too_large' }, 413);
  const folder = String(form?.get('folder') ?? 'menu').replace(/[^a-z-]/g, '').slice(0, 20) || 'menu';
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' } });
  return json({ path: `/media/${key}` }, 201);
};
