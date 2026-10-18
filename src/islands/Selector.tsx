/**
 * The Selector: a few taps (or a sentence) about appetite, heat, side of the
 * island, budget and diet, then three plates and a drink — with a record
 * spinning while it thinks.
 */
import { useState } from 'react';
import { DIETS, HEATS, HUNGERS, LEANINGS, type Preferences } from '../domain/selector';
import type { Locale, MenuItem, PricingSettings } from '../domain/types';
import type { Dictionary } from '../i18n/fill';
import { formatPrice } from '../lib/format';
import PlateView, { type ServedPlate } from './PlateView';

interface Props {
  locale: Locale;
  dict: Dictionary;
  menu: MenuItem[];
  pricing: PricingSettings;
  menuHref: string;
  checkoutHref: string;
  reserveHref: string;
  radioHref: string;
}

/** Budgets per person in centavos; undefined is "any". */
const BUDGETS = [undefined, 60_000, 100_000, 150_000];

export function Vinyl({ spinning }: { spinning: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={`size-28 ${spinning ? 'animate-[spin_1.6s_linear_infinite]' : ''}`} aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="var(--c-ink)" />
      {[40, 34, 28].map((r) => (
        <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="var(--c-cream)" strokeOpacity="0.15" />
      ))}
      <circle cx="50" cy="50" r="16" fill="var(--c-hibiscus)" />
      <path d="M50 34a16 16 0 0 1 16 16H50z" fill="var(--c-gold)" />
      <circle cx="50" cy="50" r="2.5" fill="var(--c-cream)" />
    </svg>
  );
}

export default function Selector(props: Props) {
  const { locale, dict } = props;
  const [prefs, setPrefs] = useState<Preferences>({ hunger: 'meal', heat: 'medium', leaning: 'both', diet: [], firstTime: false, party: 2 });
  const [wish, setWish] = useState('');
  const [thinking, setThinking] = useState(false);
  const [plate, setPlate] = useState<ServedPlate>();
  const [problem, setProblem] = useState(false);
  const set = (patch: Partial<Preferences>) => setPrefs((p) => ({ ...p, ...patch }));
  const chip = (on: boolean) => `rounded-full border-2 px-4 py-2 text-sm font-semibold ${on ? 'border-ink bg-ink text-cream' : 'border-ink/20 bg-white'}`;

  const spin = async () => {
    setThinking(true);
    setProblem(false);
    setPlate(undefined);
    try {
      const response = await fetch('/api/selector', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...prefs, locale, wish }) });
      if (!response.ok) throw new Error(String(response.status));
      setPlate((await response.json()) as ServedPlate);
    } catch {
      setProblem(true);
    }
    setThinking(false);
    requestAnimationFrame(() => document.getElementById('plate')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const group = <T extends string>(title: string, list: readonly T[], value: T, onPick: (v: T) => void, label: (v: T) => string) => (
    <fieldset>
      <legend className="font-display text-2xl uppercase">{title}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {list.map((v) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onPick(v)} className={chip(value === v)}>
            {label(v)}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-7 px-4 pb-32">
      {group(dict['selector.hunger'], HUNGERS, prefs.hunger, (hunger) => set({ hunger }), (v) => dict[`selector.hunger.${v}`])}
      {group(dict['selector.heat'], HEATS, prefs.heat, (heat) => set({ heat }), (v) => dict[`selector.heat.${v}`])}
      {group(dict['selector.leaning'], LEANINGS, prefs.leaning, (leaning) => set({ leaning }), (v) => dict[`selector.leaning.${v}`])}
      <fieldset>
        <legend className="font-display text-2xl uppercase">{dict['selector.budget']}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {BUDGETS.map((b) => (
            <button key={b ?? 'any'} type="button" aria-pressed={prefs.budget === b} onClick={() => set({ budget: b })} className={chip(prefs.budget === b)}>
              {b ? `≤ ${formatPrice(b, locale)}` : dict['selector.budget.any']}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-display text-2xl uppercase">{dict['selector.diet']}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIETS.map((d) => {
            const on = prefs.diet.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                className={chip(on)}
                // Seafood lover and no seafood cancel out; keep the latest tap.
                onClick={() => set({ diet: on ? prefs.diet.filter((x) => x !== d) : [...prefs.diet.filter((x) => !(d === 'seafood' ? x === 'no-seafood' : d === 'no-seafood' ? x === 'seafood' : false)), d] })}
              >
                {dict[`selector.diet.${d}`]}
              </button>
            );
          })}
          <button type="button" aria-pressed={prefs.firstTime} onClick={() => set({ firstTime: !prefs.firstTime })} className={chip(prefs.firstTime)}>
            {dict['selector.firstTime']}
          </button>
        </div>
      </fieldset>
      <section className="flex items-center justify-between">
        <span className="font-display text-2xl uppercase">{dict['selector.party']}</span>
        <span className="flex items-center gap-4">
          <button type="button" className="size-11 rounded-full border-2 border-ink text-xl font-bold" onClick={() => set({ party: Math.max(1, prefs.party - 1) })} aria-label="−">
            −
          </button>
          <span className="w-8 text-center text-2xl font-bold" aria-live="polite">
            {prefs.party}
          </span>
          <button type="button" className="size-11 rounded-full border-2 border-ink text-xl font-bold" onClick={() => set({ party: Math.min(30, prefs.party + 1) })} aria-label="+">
            +
          </button>
        </span>
      </section>
      <label className="block">
        <span className="mb-1 block font-semibold">{dict['selector.wish']}</span>
        <input value={wish} onChange={(e) => setWish(e.target.value)} maxLength={200} placeholder={dict['selector.wishHint']} className="w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-3" />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={spin}
          disabled={thinking}
          className="cone rounded-full bg-hibiscus px-8 py-4 text-lg font-bold text-cream shadow-[4px_4px_0_var(--c-ink)] disabled:animate-none disabled:opacity-60"
        >
          {plate ? dict['selector.again'] : dict['selector.go']}
        </button>
        <a href={props.radioHref} className="font-semibold underline">
          📻 {dict['selector.radio']}
        </a>
      </div>

      <section id="plate" aria-live="polite" className="scroll-mt-20">
        {thinking && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Vinyl spinning />
            <p className="font-semibold">{dict['selector.thinking']}</p>
          </div>
        )}
        {problem && <p className="rounded-xl bg-hibiscus/10 p-3 font-semibold text-hibiscus">{dict['checkout.error']}</p>}
        {plate && (
          <>
            <h2 className="mb-4 font-display text-4xl uppercase">{dict['selector.result']}</h2>
            <PlateView plate={plate} menu={props.menu} pricing={props.pricing} locale={locale} dict={dict} menuHref={props.menuHref} checkoutHref={props.checkoutHref} />
            <p className="mt-6">
              <a href={props.reserveHref} className="underline">
                {dict['selector.book']} →
              </a>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
