import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { body, guard, json } from '../../../../server/admin';
import { moveOrder } from '../../../../server/staffData';

export const POST: APIRoute = async ({ locals, params, request }) => {
  const staff = guard(locals, 'orders');
  if (staff instanceof Response) return staff;
  const input = await body<{ status?: string }>(request);
  const result = await moveOrder(env, String(params.code), input?.status, staff.email);
  if (!result.ok) return json({ error: result.error }, result.error === 'not_found' ? 404 : 409);
  return json({ status: result.status });
};
