import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isRole } from '../../../../domain/roles';
import { body, guard, json } from '../../../../server/admin';
import { saveStaff, staffList } from '../../../../server/staffData';

export const GET: APIRoute = async ({ locals }) => {
  const staff = guard(locals, 'staff');
  if (staff instanceof Response) return staff;
  const owners = (env.OWNER_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return json({ staff: await staffList(env.DB), owners });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'staff');
  if (staff instanceof Response) return staff;
  const input = await body<{ email?: string; name?: string; role?: string }>(request);
  const email = String(input?.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return json({ error: 'invalid', fields: ['email'] }, 400);
  if (!isRole(input?.role)) return json({ error: 'invalid', fields: ['role'] }, 400);
  await saveStaff(env.DB, email, String(input?.name ?? '').trim().slice(0, 60) || null, input.role);
  return json({ ok: true });
};
