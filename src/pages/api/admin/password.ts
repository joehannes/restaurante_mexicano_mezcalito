import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { body, guard, json } from '../../../server/admin';
import { checkPassword, sessionCookie, setPassword, usingDefaultPassword } from '../../../server/password';

/** Whether the admin password is still the default "admin". */
export const GET: APIRoute = async ({ locals }) => {
  const staff = guard(locals, 'staff');
  if (staff instanceof Response) return staff;
  return json({ isDefault: await usingDefaultPassword(env.DB) });
};

/** Change the shared admin password. Every other session ends; this one is renewed. */
export const PUT: APIRoute = async ({ locals, request, url }) => {
  const staff = guard(locals, 'staff');
  if (staff instanceof Response) return staff;
  const input = await body<{ current?: unknown; next?: unknown }>(request);
  const current = typeof input?.current === 'string' ? input.current : '';
  const next = typeof input?.next === 'string' ? input.next : '';
  if (next.length < 8 || next.length > 200) return json({ error: 'invalid', fields: ['next'] }, 400);
  // Someone signed in through Access may set it without knowing the old one.
  if (staff.via === 'password' && !(await checkPassword(env.DB, current))) return json({ error: 'invalid', fields: ['current'] }, 400);
  await setPassword(env.DB, next);
  const response = json({ ok: true });
  if (staff.via === 'password') response.headers.set('set-cookie', await sessionCookie(env.DB, url.protocol === 'https:'));
  return response;
};
