/** Shared plumbing for the staff API routes. */
import { can, type Permission } from '../domain/roles';
import type { Staff } from './access';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** The signed-in staff member if they hold `permission`, else the response to send. */
export function guard(locals: App.Locals, permission: Permission): Staff | Response {
  const staff = locals.staff;
  if (!staff) return json({ error: 'unauthorized' }, 401);
  if (!can(staff.role, permission)) return json({ error: 'forbidden' }, 403);
  return staff;
}

export async function body<T = Record<string, unknown>>(request: Request): Promise<T | undefined> {
  try {
    const value = await request.json();
    return value && typeof value === 'object' ? (value as T) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Bump the content version after any change guests can see. Public pages are
 * cached at the edge under this version, so the next request renders fresh.
 */
export async function contentChanged(env: Env) {
  const current = Number((await env.CACHE.get('content-version')) ?? 0);
  await env.CACHE.put('content-version', String(current + 1));
}
