import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

/** Photos, flyers and audio from R2. Keys are random and never reused, so they cache forever. */
export const GET: APIRoute = async ({ params, request }) => {
  const key = String(params.key ?? '');
  if (!/^[a-z-]{1,20}\/[\w-]{1,80}\.(jpg|png|webp|avif|mp3|mp4)$/.test(key)) return new Response(null, { status: 404 });
  const object = await env.MEDIA.get(key, { onlyIf: request.headers, range: request.headers });
  if (!object) return new Response(null, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('accept-ranges', 'bytes');
  if (!('body' in object) || !object.body) return new Response(null, { status: 304, headers });
  const range = object.range as { offset: number; length: number } | undefined;
  if (range && request.headers.has('range')) {
    headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
    return new Response(object.body, { status: 206, headers });
  }
  return new Response(object.body, { headers });
};
