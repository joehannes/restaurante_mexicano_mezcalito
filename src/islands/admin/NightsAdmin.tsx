/**
 * Nights and offers: the one list every deal on the site comes from. Each
 * night is edited as a flyer, with a live preview in its own colours.
 */
import { useEffect, useState } from 'react';
import { PALETTE } from '../../domain/adminInput';
import type { Locale, Localized } from '../../domain/types';
import { localized } from '../../domain/types';
import type { AdminDictionary, AdminLocale } from '../../i18n/admin';
import { formatClock, formatPrice } from '../../lib/format';
import type { SpecialRecord } from '../../server/content';
import { api, toCentavos, toPesos } from './api';
import { button, Field, ghost, input, LocalizedFields, Sheet, Toggle } from './ui';

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

/** 2026-10-18 is a Sunday, so weekday n falls on the 18th + n. */
const dayName = (n: number, locale: string) =>
  new Intl.DateTimeFormat(locale === 'es' ? 'es-DO' : 'en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 18 + n, 12)));

export default function NightsAdmin({ dict, locale }: { dict: AdminDictionary; locale: AdminLocale }) {
  const [specials, setSpecials] = useState<SpecialRecord[]>();
  const [editing, setEditing] = useState<SpecialRecord | 'new'>();
  const loc = locale as Locale;

  const load = async () => {
    const result = await api<{ specials: SpecialRecord[] }>('/specials');
    if (result.ok) setSpecials(result.data.specials);
  };
  useEffect(() => {
    load();
  }, []);

  const save = (s: SpecialRecord) =>
    api('/specials', {
      body: { ...s, body: s.body ?? null, validFrom: s.validFrom ?? null, validTo: s.validTo ?? null },
    });

  const setActive = async (s: SpecialRecord, active: boolean) => {
    setSpecials((list) => list?.map((x) => (x.id === s.id ? { ...x, active } : x)));
    if (!(await save({ ...s, active })).ok) load();
  };
  const move = async (index: number, by: number) => {
    if (!specials) return;
    const list = [...specials];
    const [it] = list.splice(index, 1);
    list.splice(index + by, 0, it!);
    setSpecials(list);
    await api('/specials', { body: { order: list.map((s) => s.id) } });
  };

  if (!specials) return <p>{dict['common.loading']}</p>;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl uppercase">{dict['nights.title']}</h1>
        <button type="button" className={button} onClick={() => setEditing('new')}>
          + {dict['nights.new']}
        </button>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-ink/70">{dict['nights.intro']}</p>
      <ul className="space-y-3">
        {specials.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3">
            <span className="h-12 w-3 rounded-full" style={{ background: `var(--c-${s.flyer.bg})` }} aria-hidden="true" />
            <span className="min-w-48 flex-1">
              <span className="font-bold">{localized(s.title, loc)}</span>
              <span className="block text-sm text-ink/60">
                {s.days.length ? s.days.map((d) => dayName(d, locale)).join(' · ') : dict['nights.daily']} ·{' '}
                {formatClock(s.start, loc)}–{formatClock(s.end, loc)}
                {s.price !== null && ` · ${formatPrice(s.price, loc)}`}
              </span>
            </span>
            <Toggle on={s.active} onChange={(on) => setActive(s, on)} labels={[dict['common.active'], dict['common.hidden']]} />
            <span className="flex gap-1">
              <button type="button" className={ghost} disabled={i === 0} onClick={() => move(i, -1)} aria-label={dict['common.up']}>
                ↑
              </button>
              <button type="button" className={ghost} disabled={i === specials.length - 1} onClick={() => move(i, 1)} aria-label={dict['common.down']}>
                ↓
              </button>
            </span>
            <button type="button" className={ghost} onClick={() => setEditing(s)}>
              {dict['common.edit']}
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <NightEditor
          special={editing === 'new' ? undefined : editing}
          dict={dict}
          locale={loc}
          adminLocale={locale}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await load();
          }}
        />
      )}
    </div>
  );
}

function NightEditor({
  special,
  dict,
  locale,
  adminLocale,
  onClose,
  onSaved,
}: {
  special?: SpecialRecord;
  dict: AdminDictionary;
  locale: Locale;
  adminLocale: AdminLocale;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState<Partial<Localized>>(special?.title ?? {});
  const [body, setBody] = useState<Partial<Localized>>(special?.body ?? {});
  const [days, setDays] = useState<number[]>(special?.days ?? []);
  const [start, setStart] = useState(special?.start ?? '18:00');
  const [end, setEnd] = useState(special?.end ?? '24:00');
  const [validFrom, setValidFrom] = useState(special?.validFrom ?? '');
  const [validTo, setValidTo] = useState(special?.validTo ?? '');
  const [price, setPrice] = useState(toPesos(special?.price));
  const [cta, setCta] = useState(special?.cta ?? 'book');
  const [bg, setBg] = useState(special?.flyer.bg ?? 'hibiscus');
  const [ink, setInk] = useState(special?.flyer.ink ?? 'cream');
  const [sticker, setSticker] = useState(special?.flyer.sticker ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const id = special?.id ?? slug(title.en ?? '');
  const save = async () => {
    setSaving(true);
    const result = await api('/specials', {
      body: {
        id,
        title,
        body: body.en?.trim() ? body : null,
        days,
        start,
        end,
        validFrom: validFrom || null,
        validTo: validTo || null,
        price: price.trim() ? (toCentavos(price) ?? -1) : null,
        cta,
        itemIds: special?.itemIds ?? [],
        flyer: { bg, ink, ...(sticker.trim() ? { sticker: sticker.trim() } : {}) },
        active: special?.active ?? true,
      },
    });
    setSaving(false);
    if (result.ok) onSaved();
    else setErrors(result.fields.length ? result.fields : ['error']);
  };
  const remove = async () => {
    if (!special || !confirm(dict['common.confirmDelete'])) return;
    if ((await api(`/specials/${special.id}`, { method: 'DELETE' })).ok) onSaved();
  };
  const bad = (f: string) => (errors.includes(f) ? 'ring-2 ring-hibiscus rounded-xl' : '');
  const palette = (value: string, set: (v: string) => void) => (
    <span className="flex flex-wrap gap-1">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={value === c}
          onClick={() => set(c)}
          className={`size-8 rounded-full border-2 ${value === c ? 'border-ink ring-2 ring-ink ring-offset-2' : 'border-ink/20'}`}
          style={{ background: `var(--c-${c})` }}
        />
      ))}
    </span>
  );

  return (
    <Sheet title={special ? localized(special.title, locale) : dict['nights.new']} onClose={onClose} dict={dict}>
      <div className="grid gap-4">
        {/* The flyer as guests will see it. */}
        <div className="halftone rounded-2xl p-5 shadow-[6px_6px_0_var(--c-ink)]" style={{ backgroundColor: `var(--c-${bg})`, color: `var(--c-${ink})` }}>
          <p className="text-xs font-bold tracking-[0.18em] uppercase">{days.length ? days.map((d) => dayName(d, adminLocale)).join(' · ') : dict['nights.daily']}</p>
          <p className="font-display text-4xl leading-[0.9] uppercase">{title[locale] || title.en || '…'}</p>
          {(body[locale] || body.en) && <p className="mt-2 text-sm">{body[locale] || body.en}</p>}
          {sticker && <span className="sticker mt-3 bg-cream text-ink">{sticker}</span>}
        </div>

        <div className={bad('title')}>
          <LocalizedFields label={dict['nights.headline']} value={title} onChange={setTitle} dict={dict} />
        </div>
        <LocalizedFields label={dict['nights.body']} value={body} onChange={setBody} dict={dict} multiline />

        <fieldset className={bad('days')}>
          <legend className="text-sm font-semibold">{dict['nights.days']}</legend>
          <div className="mt-1 flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                onClick={() => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]))}
                className={`rounded-full border-2 px-3 py-1 text-sm font-semibold capitalize ${days.includes(d) ? 'border-ink bg-ink text-cream' : 'border-ink/20'}`}
              >
                {dayName(d, adminLocale)}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink/60">{dict['nights.everyDay']}</p>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label={dict['nights.start']}>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${input} ${bad('start')}`} />
          </Field>
          <Field label={dict['nights.end']} hint="24:00 = midnight">
            <input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="24:00" pattern="\d{2}:\d{2}" className={`${input} ${bad('end')}`} />
          </Field>
          <Field label={dict['nights.from']}>
            <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={`${input} ${bad('validFrom')}`} />
          </Field>
          <Field label={dict['nights.to']}>
            <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={`${input} ${bad('validTo')}`} />
          </Field>
          <Field label={dict['nights.price']}>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={`${input} ${bad('price')}`} />
          </Field>
          <Field label={dict['nights.cta']}>
            <select value={cta} onChange={(e) => setCta(e.target.value as typeof cta)} className={input}>
              {(['order', 'book', 'none'] as const).map((c) => (
                <option key={c} value={c}>
                  {dict[`nights.cta.${c}`]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className={`grid gap-2 ${bad('flyer')}`}>
          <legend className="text-sm font-semibold">{dict['nights.flyer']}</legend>
          <span className="text-xs font-bold uppercase">{dict['nights.background']}</span>
          {palette(bg, setBg)}
          <span className="text-xs font-bold uppercase">{dict['nights.ink']}</span>
          {palette(ink, setInk)}
          <Field label={dict['nights.sticker']}>
            <input value={sticker} onChange={(e) => setSticker(e.target.value)} maxLength={12} className={input} />
          </Field>
        </fieldset>

        {!special && (
          <p className={`text-sm ${bad('id')}`}>
            {dict['nights.id']}: <code>{id || '…'}</code>
          </p>
        )}
        {errors.length > 0 && (
          <p role="alert" className="font-semibold text-hibiscus">
            {dict['common.error']}
          </p>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={save} disabled={saving} className={`${button} flex-1 py-3 text-base`}>
            {saving ? dict['common.saving'] : dict['common.save']}
          </button>
          {special && (
            <button type="button" onClick={remove} className={`${ghost} text-hibiscus`}>
              {dict['common.delete']}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
