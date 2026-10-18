/**
 * One day of bookings: how full each seating is, who is coming, and the
 * day's own rules (close it, or change its covers for an event). Below, the
 * party and catering requests waiting for a call back.
 */
import { useEffect, useState } from 'react';
import type { ReservationRules } from '../../domain/capacity';
import { addDays } from '../../domain/schedule';
import type { Locale } from '../../domain/types';
import { fillAdmin, type AdminDictionary, type AdminKey, type AdminLocale } from '../../i18n/admin';
import { formatClock } from '../../lib/format';
import { api } from './api';
import { button, ghost, field, input } from './ui';

interface Booking {
  code: string;
  time: string;
  party: number;
  status: string;
  name: string;
  phone: string;
  occasion: string | null;
  seating: string | null;
  addons: string[];
  notes: string | null;
}
interface Day {
  date: string;
  bookings: Booking[];
  slots: { time: string; remaining: number }[];
  rules: ReservationRules;
}
interface PartyRequest {
  id: number;
  kind: string;
  guests: number;
  date: string;
  time: string | null;
  name: string;
  phone: string;
  message: string | null;
  status: string;
  created_at: string;
}

const PARTY_STATUSES = ['new', 'contacted', 'booked', 'declined'] as const;
const wa = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

export default function BookingsAdmin({ dict, locale, today }: { dict: AdminDictionary; locale: AdminLocale; today: string }) {
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<Day>();
  const [parties, setParties] = useState<PartyRequest[]>();
  const [saving, setSaving] = useState(false);
  const loc = locale as Locale;
  const a = (key: AdminKey, vars?: Record<string, string | number>) => fillAdmin(dict, key, vars);

  const loadDay = async (d: string) => {
    setDay(undefined);
    const result = await api<Day>(`/reservations?date=${d}`);
    if (result.ok) setDay(result.data);
  };
  const loadParties = async () => {
    const result = await api<{ requests: PartyRequest[] }>('/parties');
    if (result.ok) setParties(result.data.requests);
  };
  useEffect(() => {
    loadDay(date);
  }, [date]);
  useEffect(() => {
    loadParties();
  }, []);

  const setStatus = async (b: Booking, status: string) => {
    if (status === 'cancelled' && !confirm(dict['common.confirmDelete'])) return;
    await api(`/reservations/${b.code}`, { method: 'PATCH', body: { status } });
    loadDay(date);
  };
  const setPartyStatus = async (p: PartyRequest, status: string) => {
    setParties((list) => list?.map((x) => (x.id === p.id ? { ...x, status } : x)));
    await api(`/parties/${p.id}`, { method: 'PATCH', body: { status } });
  };

  /** Replace this date's override in the reservation rules. */
  const saveOverride = async (change: { closed?: boolean; capacity?: number | null }) => {
    if (!day) return;
    const current = day.rules.overrides.find((o) => o.date === date) ?? { date };
    const next = { ...current, ...change };
    if (!next.closed) delete next.closed;
    if (next.capacity === null || next.capacity === undefined) delete next.capacity;
    const overrides = day.rules.overrides.filter((o) => o.date !== date);
    if (Object.keys(next).length > 1) overrides.push(next as (typeof overrides)[number]);
    setSaving(true);
    await api('/settings/reservations', { method: 'PUT', body: { value: { ...day.rules, overrides } } });
    setSaving(false);
    loadDay(date);
  };

  const override = day?.rules.overrides.find((o) => o.date === date);
  const capacity = override?.capacity ?? day?.rules.capacity ?? 0;
  const busiest = day?.slots.length ? capacity - Math.min(...day.slots.map((s) => s.remaining)) : 0;
  const longDate = new Intl.DateTimeFormat(locale === 'es' ? 'es-DO' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="mr-2 font-display text-3xl uppercase">{dict['bookings.title']}</h1>
          <button type="button" className={ghost} onClick={() => setDate(addDays(date, -1))} aria-label={dict['common.prev']}>
            ←
          </button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${field} w-auto`} />
          <button type="button" className={ghost} onClick={() => setDate(addDays(date, 1))} aria-label={dict['common.next']}>
            →
          </button>
          {date !== today && (
            <button type="button" className={ghost} onClick={() => setDate(today)}>
              {dict['common.today']}
            </button>
          )}
        </div>
        <p className="font-bold capitalize">{longDate}</p>

        {!day ? (
          <p>{dict['common.loading']}</p>
        ) : (
          <>
            <p className="mt-1 text-sm">{a('bookings.covers', { booked: busiest, capacity })}</p>
            {/* Free covers per seating: the taller the bar, the fuller the room. */}
            <div className="mt-3 flex h-20 items-end gap-0.5" aria-hidden="true">
              {day.slots.map((s) => {
                const full = capacity ? (capacity - s.remaining) / capacity : 0;
                return (
                  <div key={s.time} className="flex flex-1 flex-col items-center gap-1" title={`${formatClock(s.time, loc)} · ${capacity - s.remaining}/${capacity}`}>
                    <div className="w-full rounded-t bg-ink/10" style={{ height: '4rem', position: 'relative' }}>
                      <div className={`absolute inset-x-0 bottom-0 rounded-t ${full >= 1 ? 'bg-hibiscus' : full > 0.7 ? 'bg-sunset' : 'bg-jungle'}`} style={{ height: `${Math.round(full * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {day.slots.length > 0 && (
              <p className="flex justify-between text-xs text-ink/60">
                <span>{formatClock(day.slots[0]!.time, loc)}</span>
                <span>{formatClock(day.slots.at(-1)!.time, loc)}</span>
              </p>
            )}

            <ul className="mt-6 divide-y divide-ink/10 rounded-xl bg-white">
              {day.bookings.length === 0 && <li className="p-4 text-ink/60">{dict['common.none']}</li>}
              {day.bookings.map((b) => (
                <li key={b.code} className={`flex flex-wrap items-center gap-3 p-3 ${['cancelled', 'no_show'].includes(b.status) ? 'opacity-50' : ''}`}>
                  <span className="w-16 font-display text-xl">{formatClock(b.time, loc)}</span>
                  <span className="min-w-48 flex-1">
                    <span className="font-bold">{b.name}</span> · {a('bookings.party', { n: b.party })}
                    <span className="block text-sm text-ink/70">
                      {b.code} · {dict[`bookings.status.${b.status}` as AdminKey] ?? b.status}
                      {b.seating && b.seating !== 'any' && ` · ${b.seating}`}
                      {b.occasion && b.occasion !== 'none' && ` · ${b.occasion}`}
                      {b.addons.includes('sparklers') && ' · ✨'}
                    </span>
                    {b.notes && <span className="block text-sm">“{b.notes}”</span>}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {b.status === 'confirmed' && (
                      <>
                        <button type="button" className={button} onClick={() => setStatus(b, 'seated')}>
                          {dict['bookings.seat']}
                        </button>
                        <button type="button" className={ghost} onClick={() => setStatus(b, 'no_show')}>
                          {dict['bookings.noShow']}
                        </button>
                      </>
                    )}
                    {b.status === 'seated' && (
                      <button type="button" className={button} onClick={() => setStatus(b, 'completed')}>
                        {dict['bookings.complete']}
                      </button>
                    )}
                    {['confirmed', 'pending'].includes(b.status) && (
                      <button type="button" className={`${ghost} text-hibiscus`} onClick={() => setStatus(b, 'cancelled')}>
                        {dict['common.cancel']}
                      </button>
                    )}
                    <a className={ghost} href={wa(b.phone, b.code)}>
                      WhatsApp
                    </a>
                  </span>
                </li>
              ))}
            </ul>

            <fieldset className="mt-6 rounded-xl border-2 border-ink/10 p-3" disabled={saving}>
              <legend className="px-1 font-bold">{dict['bookings.dayRules']}</legend>
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" className="size-5" checked={!!override?.closed} onChange={(e) => saveOverride({ closed: e.target.checked })} />
                {dict['bookings.closeDay']}
              </label>
              <label className="mt-3 block text-sm font-semibold">
                {dict['bookings.dayCapacity']}
                <input
                  key={`${date}-${override?.capacity ?? ''}`}
                  type="number"
                  min={0}
                  defaultValue={override?.capacity ?? ''}
                  placeholder={String(day.rules.capacity)}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const n = v === '' ? null : Number(v);
                    if (n !== (override?.capacity ?? null)) saveOverride({ capacity: n });
                  }}
                  className={`${input} mt-1 w-32`}
                />
              </label>
            </fieldset>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl uppercase">{dict['bookings.parties']}</h2>
        {!parties ? (
          <p>{dict['common.loading']}</p>
        ) : parties.length === 0 ? (
          <p className="text-ink/60">{dict['common.none']}</p>
        ) : (
          <ul className="space-y-3">
            {parties.map((p) => (
              <li key={p.id} className={`rounded-xl bg-white p-3 ${p.status === 'new' ? 'ring-4 ring-gold' : ''}`}>
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-bold">
                    {p.name} · {p.kind} · {a('bookings.party', { n: p.guests })}
                  </span>
                  <span className="text-sm">
                    {p.date}
                    {p.time && ` · ${formatClock(p.time, loc)}`}
                  </span>
                </p>
                {p.message && <p className="mt-1 text-sm">“{p.message}”</p>}
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <a className={ghost} href={wa(p.phone, `Mezcalito · ${p.date}`)}>
                    {dict['bookings.message']}
                  </a>
                  <select value={p.status} onChange={(e) => setPartyStatus(p, e.target.value)} className={`${field} w-auto`}>
                    {PARTY_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {dict[`bookings.party.status.${s}`]}
                      </option>
                    ))}
                  </select>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
