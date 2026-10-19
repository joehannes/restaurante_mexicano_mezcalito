/**
 * Telling people things: guests on WhatsApp (and by email when they gave
 * one), staff by email. Every channel is optional — each switches on when its
 * secrets are set — and every send is best effort: an order or booking never
 * fails because a message did not go out. Callers run these in `waitUntil`.
 *
 * WhatsApp business messages outside a chat the guest started must use
 * templates approved in Meta Business Manager. They are written out in
 * domain/whatsappTemplates.ts, and Admin → WhatsApp shows them ready to copy;
 * only the languages staff have ticked as approved are ever sent.
 */
import { isLocale, longDate, t } from '../i18n/ui';
import { formatClock, formatPrice } from '../lib/format';
import { reservationIcs } from '../lib/ics';
import type { Locale } from '../domain/types';
import { siteUrl } from './origin';
import { parseWhatsAppSettings, templateLanguage, type TemplateName } from '../domain/whatsappTemplates';

export async function sendWhatsApp(env: Env, to: string, template: TemplateName, locale: Locale, params: string[]): Promise<boolean> {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) return false;
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'whatsapp'").first<{ value: string }>();
    const language = templateLanguage(row ? parseWhatsAppSettings(JSON.parse(row.value)) : undefined, template, locale);
    if (!language) return false;
    const response = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        type: 'template',
        template: {
          name: template,
          language: { code: language },
          components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
        },
      }),
    });
    if (!response.ok) console.error('whatsapp send failed', template, response.status, await response.text());
    return response.ok;
  } catch (error) {
    console.error('whatsapp send failed', template, error);
    return false;
  }
}

export async function sendEmail(
  env: Env,
  to: string | string[],
  subject: string,
  text: string,
  attachments: { filename: string; content: string }[] = [],
): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: Array.isArray(to) ? to : [to], subject, text, attachments }),
    });
    if (!response.ok) console.error('email send failed', response.status, await response.text());
    return response.ok;
  } catch (error) {
    console.error('email send failed', error);
    return false;
  }
}

const staffEmails = (env: Env) => (env.STAFF_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean);
const toLocale = (value: unknown): Locale => (isLocale(value as string) ? (value as Locale) : 'en');

// ── Orders ────────────────────────────────────────────────────────────────

interface OrderRow {
  code: string;
  access_key: string;
  locale: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  mode: string;
  table_label: string | null;
  total: number;
}

const loadOrderRow = (env: Env, code: string) =>
  env.DB.prepare('SELECT code, access_key, locale, customer_name, customer_phone, customer_email, mode, table_label, total FROM orders WHERE code = ?')
    .bind(code)
    .first<OrderRow>();

/** The kitchen has the order: tell the guest where to follow it, and the staff inbox. */
export async function notifyOrderPlaced(env: Env, code: string) {
  const order = await loadOrderRow(env, code);
  if (!order) return;
  const locale = toLocale(order.locale);
  const site = await siteUrl(env);
  const link = `${site}/${locale}/o/${order.code}?k=${order.access_key}`;
  const first = order.customer_name.split(/\s+/)[0] ?? order.customer_name;
  const total = formatPrice(order.total, locale);
  await Promise.all([
    // A guest at their table can see the kitchen; no message needed.
    order.mode !== 'dine_in' && sendWhatsApp(env, order.customer_phone, 'mezcalito_order_received', locale, [first, order.code, link]),
    order.customer_email &&
      sendEmail(env, order.customer_email, t(locale, 'mail.order.subject', { code: order.code }), t(locale, 'mail.order.body', { name: first, code: order.code, total, link })),
    staffEmails(env).length &&
      sendEmail(
        env,
        staffEmails(env),
        `New order ${order.code} · ${order.mode === 'dine_in' ? `table ${order.table_label}` : order.mode} · ${formatPrice(order.total, 'en')}`,
        `${order.customer_name} (${order.customer_phone})\n${site}/admin`,
      ),
  ]);
}

/** Ready for pickup, or out for delivery. */
export async function notifyOrderStatus(env: Env, code: string, status: string) {
  if (status !== 'ready' && status !== 'on_the_way') return;
  const order = await loadOrderRow(env, code);
  if (!order || order.mode === 'dine_in') return;
  const locale = toLocale(order.locale);
  const ready = status === 'ready';
  await Promise.all([
    sendWhatsApp(env, order.customer_phone, ready ? 'mezcalito_order_ready' : 'mezcalito_order_on_the_way', locale, [order.code]),
    order.customer_email &&
      sendEmail(env, order.customer_email, t(locale, 'mail.order.subject', { code: order.code }), t(locale, ready ? 'mail.ready.body' : 'mail.onTheWay.body', { code: order.code })),
  ]);
}

// ── Reservations and parties ──────────────────────────────────────────────

interface ReservationRow {
  code: string;
  date: string;
  time: string;
  party: number;
  name: string;
  phone: string;
  email: string | null;
  locale: string;
}

export async function notifyReservation(env: Env, code: string, seatingMinutes: number) {
  const r = await env.DB.prepare('SELECT code, date, time, party, name, phone, email, locale FROM reservations WHERE code = ?').bind(code).first<ReservationRow>();
  if (!r) return;
  const locale = toLocale(r.locale);
  const first = r.name.split(/\s+/)[0] ?? r.name;
  const date = longDate(r.date, locale);
  const time = formatClock(r.time, locale);
  const ics = reservationIcs({ code: r.code, date: r.date, time: r.time, minutes: seatingMinutes, title: `Mezcalito · ${r.party}`, location: 'Mezcalito Bar & Grill, Calle Pedro Mir, Bávaro', description: r.code });
  await Promise.all([
    sendWhatsApp(env, r.phone, 'mezcalito_reservation_confirmed', locale, [first, `${date}, ${time}`, String(r.party), r.code]),
    r.email &&
      sendEmail(env, r.email, t(locale, 'mail.reservation.subject', { date, time }), t(locale, 'mail.reservation.body', { name: first, party: r.party, date, time, code: r.code }), [
        { filename: `mezcalito-${r.code}.ics`, content: btoa(String.fromCharCode(...new TextEncoder().encode(ics))) },
      ]),
  ]);
}

export async function notifyParty(env: Env, id: number) {
  const p = await env.DB.prepare('SELECT * FROM party_requests WHERE id = ?').bind(id).first<Record<string, string | number | null>>();
  if (!p || !staffEmails(env).length) return;
  await sendEmail(
    env,
    staffEmails(env),
    `Party request: ${p.kind}, ${p.guests} guests, ${p.date}`,
    `${p.name} (${p.phone}${p.email ? `, ${p.email}` : ''})\n${p.date}${p.time ? ` ${p.time}` : ''} · ${p.guests} guests · ${p.kind}\n\n${p.message ?? ''}\n\n${await siteUrl(env)}/admin/bookings`,
  );
}

/**
 * Same-day reminders, sent once, about three hours ahead. Called from the
 * cron every five minutes with Bávaro's date and minutes-since-midnight.
 */
export async function sendReminders(env: Env, today: string, minutes: number) {
  // Seatings after midnight are tomorrow's; that day's crons remind them.
  if (minutes + 180 >= 1440) return;
  const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const [from, to] = [clock(minutes + 150), clock(minutes + 180)];
  const { results } = await env.DB.prepare(
    `SELECT code, date, time, party, name, phone, email, locale FROM reservations
     WHERE date = ? AND time > ? AND time <= ? AND status = 'confirmed' AND reminded_at IS NULL`,
  )
    .bind(today, from, to)
    .all<ReservationRow>();
  for (const r of results) {
    const locale = toLocale(r.locale);
    const first = r.name.split(/\s+/)[0] ?? r.name;
    const time = formatClock(r.time, locale);
    await env.DB.prepare("UPDATE reservations SET reminded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE code = ?").bind(r.code).run();
    await Promise.all([
      sendWhatsApp(env, r.phone, 'mezcalito_reservation_reminder', locale, [first, time, r.code]),
      r.email && sendEmail(env, r.email, t(locale, 'mail.reminder.subject'), t(locale, 'mail.reminder.body', { name: first, time, party: r.party, code: r.code })),
    ]);
  }
}
