/**
 * Booking a table: guests, day, time, then who — on one screen. Times come
 * live from /api/reserve/slots, so a guest only ever sees seatings that have
 * room for their whole party.
 */
import { useEffect, useState } from 'react';
import type { ReservationField } from '../domain/reservationInput';
import { OCCASIONS, SEATING } from '../domain/reservationInput';
import type { Locale } from '../domain/types';
import { fill, type Dictionary } from '../i18n/fill';
import { formatClock } from '../lib/format';
import { reservationIcs } from '../lib/ics';

interface Props {
  locale: Locale;
  dict: Dictionary;
  /** The next days that can be booked, YYYY-MM-DD, with display labels. */
  days: { date: string; label: string }[];
  maxParty: number;
  partiesHref: string;
  address: string;
}

interface Slot {
  time: string;
  remaining: number;
  bookable: boolean;
}

const PROFILE_KEY = 'mezcalito.guest.v1';

export default function Reserve({ locale, dict, days, maxParty, partiesHref, address }: Props) {
  const [party, setParty] = useState(2);
  const [date, setDate] = useState(days[0]?.date ?? '');
  const [slots, setSlots] = useState<Slot[] | undefined>();
  const [time, setTime] = useState<string>();
  const [occasion, setOccasion] = useState<(typeof OCCASIONS)[number]>('none');
  const [seating, setSeating] = useState<(typeof SEATING)[number]>('any');
  const [sparklers, setSparklers] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<ReservationField[]>([]);
  const [problem, setProblem] = useState<string>();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ code: string; minutes: number }>();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}') as { name?: string; phone?: string };
      if (saved.name) setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
    } catch {}
  }, []);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setSlots(undefined);
    fetch(`/api/reserve/slots?date=${date}&party=${party}`)
      .then((r) => r.json() as Promise<{ slots: Slot[] }>)
      .then((body) => {
        if (!live) return;
        setSlots(body.slots);
        setTime((t) => (body.slots.some((s) => s.time === t && s.bookable) ? t : undefined));
      })
      .catch(() => live && setSlots([]));
    return () => {
      live = false;
    };
  }, [date, party]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!time) return;
    setSending(true);
    setProblem(undefined);
    setErrors([]);
    const website = (new FormData(event.currentTarget).get('website') as string) ?? '';
    try {
      const response = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale, date, time, party, name, phone, occasion, seating, sparklers, notes, website }),
      });
      const body = (await response.json()) as { code?: string; seatingMinutes?: number; error?: string; fields?: ReservationField[] };
      if (response.ok && body.code) {
        try {
          localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, phone }));
        } catch {}
        setDone({ code: body.code, minutes: body.seatingMinutes ?? 90 });
      } else if (body.fields) {
        setErrors(body.fields);
        setProblem(dict['checkout.fix']);
      } else if (body.error === 'full') {
        setProblem(dict['reserve.full']);
        setTime(undefined);
        setSlots(undefined);
        const fresh = (await fetch(`/api/reserve/slots?date=${date}&party=${party}`).then((r) => r.json())) as { slots: Slot[] };
        setSlots(fresh.slots);
      } else setProblem(dict['checkout.error']);
    } catch {
      setProblem(dict['checkout.error']);
    }
    setSending(false);
  };

  const dayLabel = days.find((d) => d.date === date)?.label ?? date;

  if (done) {
    const ics = reservationIcs({
      code: done.code,
      date,
      time: time!,
      minutes: done.minutes,
      title: `Mezcalito · ${party}`,
      location: address,
      description: done.code,
    });
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <p className="sticker bg-gold text-2xl">{done.code}</p>
        <h2 className="mt-6 font-display text-4xl uppercase">{fill(dict, 'reserve.done', { code: done.code })}</h2>
        <p className="mt-3 text-lg">{fill(dict, 'reserve.doneDetail', { party, date: dayLabel, time: formatClock(time!, locale) })}</p>
        <a
          href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`}
          download={`mezcalito-${done.code}.ics`}
          className="mt-8 inline-block rounded-full bg-ink px-6 py-3 font-bold text-cream"
        >
          {dict['reserve.addToCalendar']}
        </a>
      </div>
    );
  }

  const field = (key: ReservationField) => (errors.includes(key) ? 'border-hibiscus bg-hibiscus/5' : 'border-ink/15 bg-white');
  const chip = (on: boolean) => `rounded-full border-2 px-4 py-2 text-sm font-semibold ${on ? 'border-ink bg-ink text-cream' : 'border-ink/20 bg-white'}`;

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-8 px-4 pb-40" noValidate>
      <section className="flex items-center justify-between">
        <span className="font-display text-2xl uppercase">{dict['reserve.party']}</span>
        <span className="flex items-center gap-4">
          <button type="button" className="size-11 rounded-full border-2 border-ink text-xl font-bold" onClick={() => setParty((p) => Math.max(1, p - 1))} aria-label="−">
            −
          </button>
          <span className="w-8 text-center text-2xl font-bold" aria-live="polite">
            {party}
          </span>
          <button type="button" className="size-11 rounded-full border-2 border-ink text-xl font-bold" onClick={() => setParty((p) => Math.min(maxParty, p + 1))} aria-label="+">
            +
          </button>
        </span>
      </section>
      {party >= maxParty && (
        <p className="-mt-6 text-sm">
          <a className="underline" href={partiesHref}>
            {fill(dict, 'reserve.tooMany', { n: maxParty + 1 })}
          </a>
        </p>
      )}

      <section>
        <h2 className="font-display text-2xl uppercase">{dict['reserve.date']}</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button key={d.date} type="button" aria-pressed={date === d.date} onClick={() => setDate(d.date)} className={`shrink-0 ${chip(date === d.date)}`}>
              {d.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl uppercase">{dict['reserve.time']}</h2>
        {!slots && <p className="mt-3 h-10 animate-pulse rounded-xl bg-ink/10" />}
        {slots && !slots.some((s) => s.bookable) && <p className="mt-3">{dict['reserve.noSlots']}</p>}
        {slots && slots.some((s) => s.bookable) && (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots
              .filter((s) => s.bookable)
              .map((s) => (
                <button key={s.time} type="button" aria-pressed={time === s.time} onClick={() => setTime(s.time)} className={chip(time === s.time)}>
                  {formatClock(s.time, locale)}
                </button>
              ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl uppercase">{dict['reserve.occasion']}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <button key={o} type="button" aria-pressed={occasion === o} onClick={() => setOccasion(o)} className={chip(occasion === o)}>
              {dict[`reserve.occasion.${o}`]}
            </button>
          ))}
        </div>
        {occasion === 'birthday' && (
          <label className="mt-3 flex items-center gap-3 rounded-xl bg-gold px-4 py-3 font-semibold">
            <input type="checkbox" checked={sparklers} onChange={(e) => setSparklers(e.target.checked)} className="size-5 accent-ink" />
            {dict['reserve.sparklers']} ✨
          </label>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl uppercase">{dict['reserve.seating']}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {SEATING.map((s) => (
            <button key={s} type="button" aria-pressed={seating === s} onClick={() => setSeating(s)} className={chip(seating === s)}>
              {dict[`reserve.seating.${s}`]}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl uppercase">{dict['checkout.you']}</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{dict['checkout.name']}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={`w-full rounded-xl border-2 px-3 py-3 ${field('name')}`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{dict['checkout.phone']}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" className={`w-full rounded-xl border-2 px-3 py-3 ${field('phone')}`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{dict['reserve.notes']}</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className="w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2" />
        </label>
        <input name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0" aria-hidden="true" />
      </section>

      {problem && (
        <p role="alert" className="rounded-xl bg-hibiscus/10 p-3 font-semibold text-hibiscus">
          {problem}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-6">
        <button
          type="submit"
          disabled={!time || sending}
          className="mx-auto block w-full max-w-md rounded-full bg-hibiscus px-6 py-4 text-lg font-bold text-cream shadow-[4px_4px_0_var(--c-ink)] disabled:bg-ink/40 disabled:shadow-none"
        >
          {sending ? dict['reserve.booking'] : time ? `${dict['reserve.submit']} · ${dayLabel}, ${formatClock(time, locale)}` : dict['reserve.pickTime']}
        </button>
      </div>
    </form>
  );
}
