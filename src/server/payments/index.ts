/**
 * Paying online. An order paid online is stored as `awaiting_payment` and
 * reaches the kitchen only once the provider's signed answer says it is
 * paid; until then the guest can try again or switch to paying in person.
 * Unpaid orders are cancelled by the cron after half an hour.
 */
import { waitUntil } from 'cloudflare:workers';
import { notifyOrderPlaced } from '../notify';
import { tellKitchen } from '../orders';
import type { PaymentCredentials, PaymentSettings } from '../../domain/adminInput';
import { getPrivate } from '../password';
import { azulConfig, azulForm, azulPageUrl, azulResult } from './azul';
import { usdCharge } from '../../lib/format';
import { paypalCapture, paypalConfig, paypalStart } from './paypal';

export type Provider = 'azul' | 'paypal';

/** Each provider's settings: the Worker's secrets win over what was typed in the admin. */
export async function providerConfigs(env: Env) {
  const stored = (await getPrivate<PaymentCredentials>(env.DB, 'payment_credentials')) ?? {};
  return { azul: azulConfig(env, stored.azul), paypal: paypalConfig(env, stored.paypal) };
}

/** The ways to pay guests are offered (Admin → Settings → Payments). Each is on until switched off. */
export async function paymentChoices(env: Env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'payments'").first<{ value: string }>();
  return (row ? JSON.parse(row.value) : {}) as Partial<PaymentSettings>;
}

/** Online providers that are set up and switched on. */
export async function onlineProviders(env: Env): Promise<Provider[]> {
  const [configs, choices] = await Promise.all([providerConfigs(env), paymentChoices(env)]);
  return [
    ...(configs.azul && choices.azul !== false ? (['azul'] as const) : []),
    ...(configs.paypal && choices.paypal !== false ? (['paypal'] as const) : []),
  ];
}

interface PayableOrder {
  id: number;
  code: string;
  access_key: string;
  status: string;
  payment_method: string;
  payment_status: string;
  locale: string;
  total: number;
  itbis: number;
}

async function payable(env: Env, code: string, key: string): Promise<PayableOrder | undefined> {
  const order = await env.DB.prepare('SELECT id, code, access_key, status, payment_method, payment_status, locale, total, itbis FROM orders WHERE code = ?')
    .bind(code)
    .first<PayableOrder>();
  return order && order.access_key === key ? order : undefined;
}

const orderPage = (origin: string, order: { code: string; access_key: string; locale: string }, extra = '') =>
  `${origin}/${order.locale}/o/${order.code}?k=${order.access_key}${extra}`;

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Sends the guest's browser on to the provider: a self-posting form for Azul, a redirect for PayPal. */
export async function startPayment(env: Env, origin: string, code: string, key: string, provider: Provider): Promise<Response> {
  const order = await payable(env, code, key);
  if (!order) return new Response('Not found', { status: 404 });
  if (order.status !== 'awaiting_payment' || order.payment_status === 'paid') return Response.redirect(orderPage(origin, order), 303);
  const back = `${code}/${key}`;

  if (provider === 'azul') {
    const config = (await providerConfigs(env)).azul;
    if (!config) return Response.redirect(orderPage(origin, order), 303);
    const fields = await azulForm(
      config,
      { number: code, total: order.total, itbis: order.itbis, locale: order.locale },
      {
        approved: `${origin}/api/pay/azul/approved/${back}`,
        declined: `${origin}/api/pay/azul/declined/${back}`,
        cancel: `${origin}/api/pay/azul/cancelled/${back}`,
      },
    );
    await env.DB.prepare("UPDATE orders SET payment_provider = 'azul', payment_status = 'pending' WHERE id = ?").bind(order.id).run();
    const inputs = Object.entries(fields)
      .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
      .join('');
    return new Response(
      `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Azul</title>` +
        `<form id="pay" method="post" action="${azulPageUrl(config.mode)}">${inputs}<noscript><button>Continue to payment</button></noscript></form>` +
        `<script>document.getElementById('pay').submit()</script>`,
      { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
    );
  }

  const config = (await providerConfigs(env)).paypal;
  if (!config) return Response.redirect(orderPage(origin, order), 303);
  const rate = await env.DB.prepare("SELECT value FROM settings WHERE key = 'pricing'").first<{ value: string }>();
  const usd = usdCharge(order.total, (JSON.parse(rate!.value) as { usdRate: number }).usdRate);
  try {
    const { id, approveUrl } = await paypalStart(config, { code, usd, locale: order.locale }, {
      returnUrl: `${origin}/api/pay/paypal/return/${back}`,
      cancelUrl: `${origin}/api/pay/paypal/cancelled/${back}`,
    });
    await env.DB.prepare("UPDATE orders SET payment_provider = 'paypal', payment_status = 'pending', payment_ref = ? WHERE id = ?").bind(`paypal-order:${id}:${usd}`, order.id).run();
    return Response.redirect(approveUrl, 303);
  } catch (error) {
    console.error('paypal start failed', error);
    return Response.redirect(orderPage(origin, order, '&pay=failed'), 303);
  }
}

/** Paid: the order goes to the kitchen now. Idempotent — a repeated return changes nothing. */
async function markPaid(env: Env, order: PayableOrder, provider: Provider, reference: string) {
  const [update] = await env.DB.batch([
    env.DB.prepare(
      "UPDATE orders SET status = 'received', payment_status = 'paid', payment_provider = ?, payment_ref = ? WHERE id = ? AND status = 'awaiting_payment'",
    ).bind(provider, reference, order.id),
    env.DB.prepare("INSERT INTO order_events (order_id, status, actor) SELECT ?, 'received', 'system' WHERE changes() > 0").bind(order.id),
  ]);
  if (!update!.meta.changes) return;
  await Promise.all([tellKitchen(env, 'board', { type: 'order.created', code: order.code }), tellKitchen(env, `order:${order.code}`, { status: 'received' })]);
  waitUntil(notifyOrderPlaced(env, order.code));
}

async function markFailed(env: Env, order: PayableOrder) {
  await env.DB.prepare("UPDATE orders SET payment_status = 'failed' WHERE id = ? AND payment_status != 'paid'").bind(order.id).run();
}

export async function azulReturn(env: Env, origin: string, outcome: string, code: string, key: string, params: URLSearchParams): Promise<Response> {
  const order = await payable(env, code, key);
  const config = (await providerConfigs(env)).azul;
  if (!order || !config) return new Response('Not found', { status: 404 });
  if (outcome === 'approved') {
    const result = await azulResult(config, params);
    if (result.ok && result.approved && result.orderNumber === code && result.amount === order.total) {
      await markPaid(env, order, 'azul', result.reference);
      return Response.redirect(orderPage(origin, order), 303);
    }
    if (!result.ok) console.error('azul return rejected', code, result.reason);
  }
  await markFailed(env, order);
  return Response.redirect(orderPage(origin, order, '&pay=failed'), 303);
}

export async function paypalReturn(env: Env, origin: string, outcome: string, code: string, key: string, params: URLSearchParams): Promise<Response> {
  const order = await payable(env, code, key);
  const config = (await providerConfigs(env)).paypal;
  if (!order || !config) return new Response('Not found', { status: 404 });
  const token = params.get('token') ?? '';
  // Only the PayPal order we created for this order may pay for it.
  const stored = await env.DB.prepare('SELECT payment_ref FROM orders WHERE id = ?').bind(order.id).first<{ payment_ref: string | null }>();
  const [, paypalId, usd] = stored?.payment_ref?.split(':') ?? [];
  if (outcome === 'return' && token && token === paypalId) {
    const capture = await paypalCapture(config, token);
    if (capture.paid && capture.code === code && capture.usd === usd) {
      await markPaid(env, order, 'paypal', `paypal:${capture.reference}:USD ${capture.usd}`);
      return Response.redirect(orderPage(origin, order), 303);
    }
  }
  if (order.status === 'awaiting_payment') await markFailed(env, order);
  return Response.redirect(orderPage(origin, order, '&pay=failed'), 303);
}

/** The guest gives up on paying online and will pay at the counter or the door. */
export async function switchToCash(env: Env, code: string, key: string): Promise<boolean> {
  const order = await payable(env, code, key);
  if (!order || order.status !== 'awaiting_payment' || order.payment_status === 'paid') return false;
  await env.DB.batch([
    env.DB.prepare("UPDATE orders SET status = 'received', payment_method = 'cash', payment_status = 'unpaid' WHERE id = ? AND status = 'awaiting_payment'").bind(order.id),
    env.DB.prepare("INSERT INTO order_events (order_id, status, actor) SELECT ?, 'received', 'guest' WHERE changes() > 0").bind(order.id),
  ]);
  await Promise.all([tellKitchen(env, 'board', { type: 'order.created', code }), tellKitchen(env, `order:${code}`, { status: 'received' })]);
  waitUntil(notifyOrderPlaced(env, code));
  return true;
}

/** Cron: online orders left unpaid for half an hour are cancelled. */
export async function expireUnpaid(env: Env, now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 60_000).toISOString();
  const { results } = await env.DB.prepare("SELECT id, code FROM orders WHERE status = 'awaiting_payment' AND created_at < ?").bind(cutoff).all<{ id: number; code: string }>();
  for (const o of results) {
    await env.DB.batch([
      env.DB.prepare("UPDATE orders SET status = 'cancelled', payment_status = CASE WHEN payment_status = 'paid' THEN 'paid' ELSE 'failed' END WHERE id = ? AND status = 'awaiting_payment'").bind(o.id),
      env.DB.prepare("INSERT INTO order_events (order_id, status, actor) SELECT ?, 'cancelled', 'system' WHERE changes() > 0").bind(o.id),
    ]);
    await tellKitchen(env, `order:${o.code}`, { status: 'cancelled' });
  }
}
