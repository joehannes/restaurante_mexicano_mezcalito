/**
 * The kitchen's screen. Orders arrive over the KitchenRoom WebSocket with a
 * chime; one big button moves each ticket on. Built for a tablet propped on
 * the pass and a phone in an apron pocket alike.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { nextStatus, type OrderStatus } from '../../domain/orderStatus';
import { localized, type Locale, type Localized } from '../../domain/types';
import { fillAdmin, type AdminDictionary, type AdminKey, type AdminLocale } from '../../i18n/admin';
import { formatClock, formatPrice } from '../../lib/format';
import type { BoardOrder } from '../../server/staffData';
import { api } from './api';
import { button, ghost } from './ui';

interface Booking {
  code: string;
  time: string;
  party: number;
  name: string;
  phone: string;
  occasion: string | null;
  seating: string | null;
  addons: string[];
  notes: string | null;
  status: string;
}
interface Board {
  orders: BoardOrder[];
  bookings: Booking[];
  newParties: number;
  labels: { options: Record<string, Record<string, Localized>>; variants: Record<string, Record<string, Localized>> };
}

const COLUMNS: [AdminKey, OrderStatus[]][] = [
  ['board.col.new', ['awaiting_payment', 'received']],
  ['board.col.cooking', ['preparing']],
  ['board.col.out', ['ready', 'on_the_way']],
  ['board.col.done', ['done', 'cancelled']],
];
const ACTION: Partial<Record<OrderStatus, AdminKey>> = {
  preparing: 'board.start',
  ready: 'board.ready',
  on_the_way: 'board.out',
  done: 'board.done',
};
/** One step back, for a tap on the wrong ticket. */
const previous = (order: BoardOrder): OrderStatus | undefined =>
  (({ preparing: 'received', ready: 'preparing', on_the_way: 'preparing', done: order.mode === 'delivery' ? 'on_the_way' : 'ready' }) as Partial<Record<OrderStatus, OrderStatus>>)[order.status];

/** Two short notes on the Web Audio clock — loud enough for a busy kitchen, no file to load. */
function chime(ctx: AudioContext) {
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'triangle';
    const t = ctx.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

export default function OrdersBoard({ dict, locale }: { dict: AdminDictionary; locale: AdminLocale }) {
  const [board, setBoard] = useState<Board>();
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [calls, setCalls] = useState<{ key: string; table: string; request: 'waiter' | 'bill' }[]>([]);
  const audio = useRef<AudioContext | null>(null);
  const a = (key: AdminKey, vars?: Record<string, string | number>) => fillAdmin(dict, key, vars);
  const loc = locale as Locale;

  const load = useCallback(async () => {
    const result = await api<Board>('/orders');
    if (result.ok) {
      setBoard(result.data);
      setOffline(false);
    } else setOffline(true);
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 60_000);
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const connect = () => {
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/admin/ws`);
      socket.onopen = () => setOffline(false);
      socket.onmessage = (event) => {
        let data: { type?: string; code?: string; table?: string; request?: 'waiter' | 'bill'; at?: string } = {};
        try {
          data = JSON.parse(event.data);
        } catch {}
        if (data.type === 'table.call' && data.table && data.request) {
          const call = { key: `${data.table}-${data.request}-${data.at}`, table: data.table, request: data.request };
          setCalls((list) => [...list.filter((c) => !(c.table === call.table && c.request === call.request)), call]);
          if (audio.current) chime(audio.current);
          const text = fillAdmin(dict, `board.call.${call.request}`, { table: call.table });
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(text);
          return;
        }
        if (data.type === 'order.created') {
          if (audio.current) chime(audio.current);
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(fillAdmin(dict, 'board.newOrder', { code: data.code ?? '' }));
          }
        }
        load();
      };
      socket.onclose = () => {
        if (closed) return;
        setOffline(true);
        retry = setTimeout(connect, 4000);
      };
    };
    connect();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      closed = true;
      clearInterval(poll);
      clearInterval(clock);
      clearTimeout(retry);
      socket?.close();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, dict]);

  const enableSound = () => {
    audio.current ??= new AudioContext();
    audio.current.resume();
    chime(audio.current);
    setSound(true);
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  };

  const move = async (order: BoardOrder, to: OrderStatus) => {
    if (to === 'cancelled' && !confirm(a('board.confirmCancel', { code: order.code }))) return;
    setBusy(order.code);
    await api(`/orders/${order.code}`, { body: { status: to } });
    await load();
    setBusy(undefined);
  };

  const label = (json: string) => {
    try {
      return localized(JSON.parse(json) as Localized, loc);
    } catch {
      return json;
    }
  };
  const optionText = (item: BoardOrder['items'][number]) => {
    const parts: string[] = [];
    if (item.variantId) parts.push(localized(board?.labels.variants[item.itemId]?.[item.variantId] ?? { en: item.variantId }, loc));
    for (const [group, ids] of Object.entries(item.options))
      for (const id of ids) parts.push(localized(board?.labels.options[group]?.[id] ?? { en: id }, loc));
    if (item.weightLb) parts.push(`${item.weightLb} lb`);
    return parts.join(' · ');
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl uppercase">{dict['board.title']}</h1>
        <button type="button" onClick={enableSound} className={sound ? ghost : `${button} bg-hibiscus`}>
          {sound ? `🔔 ${dict['board.soundOn']}` : `🔕 ${dict['board.sound']}`}
        </button>
        {offline && (
          <span role="status" className="rounded-full bg-sunset px-3 py-1 text-sm font-bold text-cream">
            {dict['common.offline']}
          </span>
        )}
        {!!board?.newParties && (
          <a href="/admin/bookings" className="rounded-full bg-gold px-3 py-1 text-sm font-bold">
            {a('board.newParties', { n: board.newParties })}
          </a>
        )}
      </div>

      {calls.length > 0 && (
        <ul className="mb-4 space-y-2" aria-live="assertive">
          {calls.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-3 rounded-xl bg-gold p-3 text-lg font-bold">
              {c.request === 'bill' ? '🧾' : '🙋'} {a(`board.call.${c.request}`, { table: c.table })}
              <button type="button" className={button} onClick={() => setCalls((list) => list.filter((x) => x.key !== c.key))}>
                {dict['board.dismiss']}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!board ? (
        <p>{dict['common.loading']}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
          <div className="grid gap-4 md:grid-cols-3">
            {COLUMNS.slice(0, 3).map(([title, statuses]) => {
              const orders = board.orders.filter((o) => statuses.includes(o.status));
              return (
                <section key={title} aria-label={dict[title]}>
                  <h2 className="mb-2 flex items-center gap-2 font-bold uppercase">
                    {dict[title]} <span className="rounded-full bg-ink px-2 text-sm text-cream">{orders.length}</span>
                  </h2>
                  {orders.length === 0 && <p className="rounded-xl border-2 border-dashed border-ink/15 p-4 text-sm text-ink/60">{dict['board.empty']}</p>}
                  <ul className="space-y-3">
                    {orders.map((order) => {
                      const next = nextStatus(order.mode, order.status);
                      const back = previous(order);
                      const minutes = Math.max(0, Math.round((now - Date.parse(order.createdAt)) / 60_000));
                      return (
                        <li key={order.code} className={`rounded-xl bg-white p-3 shadow-[3px_3px_0_var(--c-ink)] ${order.status === 'received' ? 'ring-4 ring-hibiscus' : ''}`}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-display text-2xl">{order.code}</span>
                            <span className="text-sm font-semibold">{a('board.ago', { n: minutes })}</span>
                          </div>
                          <p className="mt-1 flex flex-wrap gap-2 text-sm font-bold">
                            <span className="rounded bg-ink px-2 text-cream">
                              {order.mode === 'dine_in' ? a('board.table', { table: order.table ?? '?' }) : dict[`board.${order.mode}`]}
                            </span>
                            {order.scheduledFor && <span className="rounded bg-gold px-2">{a('board.at', { time: formatClock(order.scheduledFor, loc) })}</span>}
                            {order.status === 'awaiting_payment' && <span className="rounded bg-sunset px-2 text-cream">{dict['board.awaitingPayment']}</span>}
                          </p>
                          <ul className="mt-2 space-y-1">
                            {order.items.map((item, i) => (
                              <li key={i}>
                                <span className="font-bold">{item.qty}×</span> {label(item.name)}
                                {optionText(item) && <span className="block pl-5 text-sm text-ink/70">{optionText(item)}</span>}
                                {item.note && <span className="block pl-5 text-sm font-semibold text-hibiscus">“{item.note}”</span>}
                              </li>
                            ))}
                          </ul>
                          {order.notes && <p className="mt-2 rounded bg-gold/30 p-2 text-sm">“{order.notes}”</p>}
                          <p className="mt-2 text-sm">
                            {order.name} ·{' '}
                            <a className="underline" href={`https://wa.me/${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent(order.code)}`}>
                              {order.phone}
                            </a>
                            {order.address?.street && (
                              <span className="block">
                                {order.address.street}
                                {order.address.reference && ` · ${order.address.reference}`}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-sm">
                            {formatPrice(order.total, loc)} ·{' '}
                            {order.paymentStatus === 'paid' ? dict['board.paid'] : order.payment === 'cash' ? dict['board.cash'] : dict['board.card']}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {next && (
                              <button type="button" disabled={busy === order.code} onClick={() => move(order, next)} className="flex-1 rounded-full bg-jungle px-4 py-3 font-bold text-cream disabled:opacity-50">
                                {dict[ACTION[next]!]}
                              </button>
                            )}
                            {back && (
                              <button type="button" disabled={busy === order.code} onClick={() => move(order, back)} className={ghost}>
                                {dict['board.undo']}
                              </button>
                            )}
                            <button type="button" disabled={busy === order.code} onClick={() => move(order, 'cancelled')} className={`${ghost} text-hibiscus`}>
                              {dict['board.cancel']}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          <aside className="space-y-6">
            <section>
              <h2 className="mb-2 font-bold uppercase">{dict['board.bookingsToday']}</h2>
              {board.bookings.length === 0 && <p className="text-sm text-ink/60">{dict['board.noBookings']}</p>}
              <ul className="space-y-2">
                {board.bookings.map((b) => (
                  <li key={b.code} className="rounded-xl bg-white p-2 text-sm">
                    <span className="font-bold">{formatClock(b.time, loc)}</span> · {fillAdmin(dict, 'bookings.party', { n: b.party })} · {b.name}
                    {b.addons.includes('sparklers') && <span className="ml-1 rounded bg-gold px-1 font-bold">✨ {dict['board.sparklers']}</span>}
                    {b.notes && <span className="block text-ink/70">“{b.notes}”</span>}
                  </li>
                ))}
              </ul>
            </section>
            {(() => {
              const done = board.orders.filter((o) => o.status === 'done' || o.status === 'cancelled');
              return done.length > 0 ? (
                <section>
                  <h2 className="mb-2 font-bold uppercase">{dict['board.col.done']}</h2>
                  <ul className="space-y-2">
                    {done.map((o) => (
                      <li key={o.code} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2 text-sm">
                        <span className={o.status === 'cancelled' ? 'line-through' : ''}>{o.code}</span>
                        {o.status === 'done' && (
                          <button type="button" className={ghost} onClick={() => move(o, previous(o)!)} disabled={busy === o.code}>
                            {dict['board.undo']}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null;
            })()}
          </aside>
        </div>
      )}
    </div>
  );
}
