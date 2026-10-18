/**
 * The party and catering request: what, how many, when, who. Staff answer on
 * WhatsApp, so this only has to collect enough to start that conversation.
 */
import { useEffect, useState } from 'react';
import { PARTY_KINDS, type PartyField, type PartyKind } from '../domain/partyInput';
import type { Locale } from '../domain/types';
import type { Dictionary } from '../i18n/fill';

interface Props {
  locale: Locale;
  dict: Dictionary;
  /** YYYY-MM-DD, Bávaro's today: the earliest date the picker offers. */
  today: string;
}

const PROFILE_KEY = 'mezcalito.guest.v1';

export default function Parties({ locale, dict, today }: Props) {
  const [kind, setKind] = useState<PartyKind>('birthday');
  const [guests, setGuests] = useState('20');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<PartyField[]>([]);
  const [problem, setProblem] = useState<string>();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}') as { name?: string; phone?: string };
      if (saved.name) setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
    } catch {}
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setProblem(undefined);
    setErrors([]);
    const website = (new FormData(event.currentTarget).get('website') as string) ?? '';
    try {
      const response = await fetch('/api/parties', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale, kind, guests: Number(guests), date, time, name, phone, message, website }),
      });
      const body = (await response.json()) as { id?: number; fields?: PartyField[] };
      if (response.ok && body.id) {
        try {
          localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, phone }));
        } catch {}
        setDone(true);
      } else if (body.fields) {
        setErrors(body.fields);
        setProblem(dict['checkout.fix']);
      } else setProblem(dict['checkout.error']);
    } catch {
      setProblem(dict['checkout.error']);
    }
    setSending(false);
  };

  if (done) {
    return (
      <p role="status" className="rounded-2xl bg-jungle p-6 text-lg font-semibold text-cream">
        {dict['parties.done']}
      </p>
    );
  }

  const field = (key: PartyField) => (errors.includes(key) ? 'border-hibiscus bg-hibiscus/5' : 'border-ink/15 bg-white');
  const chip = (on: boolean) => `rounded-full border-2 px-4 py-2 text-sm font-semibold ${on ? 'border-ink bg-ink text-cream' : 'border-ink/20 bg-white'}`;
  const input = 'w-full rounded-xl border-2 px-3 py-3';

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <fieldset>
        <legend className="font-display text-2xl uppercase">{dict['parties.kind']}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {PARTY_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
              {dict[`parties.kind.${k}`]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{dict['parties.guests']}</span>
          <input value={guests} onChange={(e) => setGuests(e.target.value)} type="number" inputMode="numeric" min={1} max={500} className={`${input} ${field('guests')}`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{dict['parties.date']}</span>
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" min={today} className={`${input} ${field('date')}`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">
            {dict['parties.time']} <span className="font-normal text-ink/60">({dict['common.optional']})</span>
          </span>
          <input value={time} onChange={(e) => setTime(e.target.value)} type="time" step={1800} className={`${input} ${field('time')}`} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{dict['checkout.name']}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={`${input} ${field('name')}`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{dict['checkout.phone']}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" className={`${input} ${field('phone')}`} />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">{dict['parties.message']}</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={1000} className="w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2" />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0" aria-hidden="true" />

      {problem && (
        <p role="alert" className="rounded-xl bg-hibiscus/10 p-3 font-semibold text-hibiscus">
          {problem}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-full bg-hibiscus px-6 py-4 text-lg font-bold text-cream shadow-[4px_4px_0_var(--c-ink)] disabled:bg-ink/40 disabled:shadow-none sm:w-auto"
      >
        {sending ? dict['parties.sending'] : dict['parties.submit']}
      </button>
    </form>
  );
}
