import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { guard, json } from '../../../../server/admin';
import { removeStaff } from '../../../../server/staffData';

export const DELETE: APIRoute = async ({ locals, params }) => {
  const staff = guard(locals, 'staff');
  if (staff instanceof Response) return staff;
  const email = decodeURIComponent(String(params.email)).toLowerCase();
  if (email === staff.email) return json({ error: 'cannot_remove_self' }, 409);
  if (!(await removeStaff(env.DB, email))) return json({ error: 'not_found' }, 404);
  return json({ ok: true });
};
