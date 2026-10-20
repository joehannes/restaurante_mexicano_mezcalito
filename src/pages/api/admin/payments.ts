import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseCredentials, type PaymentCredentials } from '../../../domain/adminInput';
import { body, contentChanged, guard, json } from '../../../server/admin';
import { getPrivate, setPrivate, usingDefaultPassword } from '../../../server/password';

const KEY = 'payment_credentials';

/** What is set up, never the secrets themselves. Owners only. */
export const GET: APIRoute = async ({ locals }) => {
  const staff = guard(locals, 'staff');
  if (staff instanceof Response) return staff;
  const stored = (await getPrivate<PaymentCredentials>(env.DB, KEY)) ?? {};
  return json({
    azul: stored.azul
      ? { merchantId: stored.azul.merchantId, merchantName: stored.azul.merchantName, merchantType: stored.azul.merchantType, mode: stored.azul.mode, hasKey: true }
      : null,
    paypal: stored.paypal ? { clientId: stored.paypal.clientId, mode: stored.paypal.mode, hasKey: true } : null,
    // Secrets set on the Worker win over these.
    fromWorker: { azul: !!(env.AZUL_MERCHANT_ID && env.AZUL_AUTH_KEY), paypal: !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET) },
  });
};

export const PUT: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'staff');
  if (staff instanceof Response) return staff;
  // Anyone could guess "admin": where the money goes waits until the password is changed.
  if (staff.via === 'password' && (await usingDefaultPassword(env.DB))) return json({ error: 'change_password_first' }, 403);
  const stored = (await getPrivate<PaymentCredentials>(env.DB, KEY)) ?? {};
  const parsed = parseCredentials(await body(request), stored);
  if (!parsed.ok) return json({ error: 'invalid', fields: parsed.errors }, 400);
  await setPrivate(env.DB, KEY, parsed.value);
  await contentChanged(env);
  return json({ ok: true });
};
