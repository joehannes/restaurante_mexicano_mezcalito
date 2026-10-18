import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseSetting, type SettingKey } from '../../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../../server/admin';
import { saveSetting } from '../../../../server/staffData';

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const staff = guard(locals, 'settings');
  if (staff instanceof Response) return staff;
  const input = await body<{ value?: unknown }>(request);
  const parsed = parseSetting(String(params.key), input?.value);
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  await saveSetting(env.DB, params.key as SettingKey, parsed.value);
  await contentChanged(env);
  return json({ value: parsed.value });
};
