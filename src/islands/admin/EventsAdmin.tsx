/**
 * Marketing events, for staff: a launch, a big match, a guest DJ. Each gets
 * its own page; the one on today (or coming up next) is featured on the home
 * page as a ticket and at /event.
 */
import { useEffect, useState } from 'react';
import { EVENT_CTAS, PALETTE } from '../../domain/adminInput';
import type { Locale, Localized } from '../../domain/types';
import { localized } from '../../domain/types';
import type { AdminDictionary, AdminLocale } from '../../i18n/admin';
import { formatPrice } from '../../lib/format';
import type { EventRecord } from '../../server/events';
import { api, toCentavos, toPesos } from './api';
import { button, Field, ghost, input, LocalizedFields, PhotoField, Sheet, Toggle } from './ui';

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

/** Today in Bávaro, YYYY-MM-DD. */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo' }).format(new Date());

const payload = (e: EventRecord) => ({ ...e, price: e.price ?? null });

export default function EventsAdmin({ dict, locale }: { dict: AdminDictionary; locale: AdminLocale }) {
  const [events, setEvents] = useState<EventRecord[]>();
  const [editing, setEditing] = useState<EventRecord | 'new'>();
  const loc = locale as Locale;

  const load = async () => {
    const result = await api<{ events: EventRecord[] }>('/events');
    if (result.ok) setEvents(result.data.events);
  };
  useEffect(() => {
    load();
  }, []);

  const setPublished = async (e: EventRecord, published: boolean) => {
    setEvents((list) => list?.map((x) => (x.slug === e.slug ? { ...x, published } : x)));
    if (!(await api('/events', { body: payload({ ...e, published }) })).ok) load();
  };

  if (!events) return <p>{dict['common.loading']}</p>;
  const now = today();
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl uppercase">{dict['events.title']}</h1>
        <button type="button" className={button} onClick={() => setEditing('new')}>
          + {dict['events.new']}
        </button>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-ink/70">{dict['events.intro']}</p>
      {!events.length && <p>{dict['common.none']}</p>}
      <ul className="space-y-3">
        {events.map((e) => {
          const state = now > e.endsOn ? 'over' : now >= e.startsOn ? 'live' : 'soon';
          return (
            <li key={e.slug} className={`flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ${state === 'over' ? 'opacity-60' : ''}`}>
              <span className="h-12 w-3 rounded-full" style={{ background: `var(--c-${e.color})` }} aria-hidden="true" />
              <span className="min-w-48 flex-1">
                <span className="font-bold">{localized(e.title, loc)}</span>
                <span className="ml-2 rounded bg-ink/10 px-1.5 text-xs font-bold uppercase">{dict[`events.state.${state}`]}</span>
                <span className="block text-sm text-ink/60">
                  {e.startsOn === e.endsOn ? e.startsOn : `${e.startsOn} → ${e.endsOn}`}
                  {e.price !== null && ` · ${formatPrice(e.price, loc)}`}
                </span>
              </span>
              <Toggle on={e.published} onChange={(on) => setPublished(e, on)} labels={[dict['events.published'], dict['events.draft']]} />
              <a href={`/${loc === 'es' ? 'es' : 'en'}/event/${e.slug}`} target="_blank" rel="noreferrer" className={ghost}>
                {dict['events.open']} ↗
              </a>
              <button type="button" className={ghost} onClick={() => setEditing(e)}>
                {dict['common.edit']}
              </button>
            </li>
          );
        })}
      </ul>
      {editing && (
        <EventEditor
          event={editing === 'new' ? undefined : editing}
          dict={dict}
          locale={loc}
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

function EventEditor({ event, dict, locale, onClose, onSaved }: { event?: EventRecord; dict: AdminDictionary; locale: Locale; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState<Partial<Localized>>(event?.title ?? {});
  const [kicker, setKicker] = useState<Partial<Localized>>(event?.kicker ?? {});
  const [body, setBody] = useState<Partial<Localized>>(event?.body ?? {});
  const [startsOn, setStartsOn] = useState(event?.startsOn ?? today());
  const [endsOn, setEndsOn] = useState(event?.endsOn ?? today());
  const [startTime, setStartTime] = useState(event?.startTime ?? '');
  const [endTime, setEndTime] = useState(event?.endTime ?? '');
  const [price, setPrice] = useState(toPesos(event?.price));
  const [image, setImage] = useState<string | null>(event?.image ?? null);
  const [video, setVideo] = useState<string | null>(event?.video ?? null);
  const [cta, setCta] = useState<EventRecord['cta']>(event?.cta ?? 'book');
  const [ctaUrl, setCtaUrl] = useState(event?.ctaUrl ?? '');
  const [ctaLabel, setCtaLabel] = useState<Partial<Localized>>(event?.ctaLabel ?? {});
  const [highlights, setHighlights] = useState<Partial<Localized>[]>(event?.highlights ?? []);
  const [color, setColor] = useState<EventRecord['color']>(event?.color ?? 'hibiscus');
  const [published, setPublished] = useState(event?.published ?? false);
  const [priority, setPriority] = useState(event?.priority ?? 0);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const id = event?.slug ?? slug(title.en ?? '');
  const optional = (v: Partial<Localized>) => (v.en?.trim() ? v : null);
  const save = async () => {
    setSaving(true);
    const result = await api('/events', {
      body: {
        slug: id,
        title,
        kicker: optional(kicker),
        body: optional(body),
        startsOn,
        endsOn,
        startTime: startTime || null,
        endTime: endTime || null,
        price: price.trim() ? (toCentavos(price) ?? -1) : null,
        image,
        video,
        cta,
        ctaUrl: ctaUrl.trim() || null,
        ctaLabel: optional(ctaLabel),
        highlights: highlights.filter((h) => h.en?.trim()),
        color,
        published,
        priority,
      },
    });
    setSaving(false);
    if (result.ok) onSaved();
    else setErrors(result.fields.length ? result.fields : ['error']);
  };
  const remove = async () => {
    if (!event || !confirm(dict['common.confirmDelete'])) return;
    if ((await api(`/events/${event.slug}`, { method: 'DELETE' })).ok) onSaved();
  };
  const bad = (f: string) => (errors.includes(f) ? 'ring-2 ring-hibiscus rounded-xl' : '');
  const ink = color === 'gold' || color === 'lagoon' ? 'var(--c-ink)' : 'var(--c-cream)';

  return (
    <Sheet title={event ? localized(event.title, locale) : dict['events.new']} onClose={onClose} dict={dict}>
      <div className="grid gap-4">
        {/* The ticket as guests will see it on the home page. */}
        <div className="halftone flex items-center gap-4 rounded-2xl border-4 border-ink p-5 shadow-[6px_6px_0_var(--c-ink)]" style={{ background: `var(--c-${color})`, color: ink }}>
          {image && <img src={image} alt="" className="size-20 -rotate-3 rounded-lg border-4 border-current object-cover" />}
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase">{kicker[locale] || kicker.en || ''}</span>
            <span className="block font-display text-4xl leading-[0.9] uppercase">{title[locale] || title.en || '…'}</span>
            <span className="block text-sm font-semibold">{startsOn === endsOn ? startsOn : `${startsOn} → ${endsOn}`}</span>
          </span>
        </div>

        <div className={bad('title')}>
          <LocalizedFields label={dict['events.headline']} value={title} onChange={setTitle} dict={dict} />
        </div>
        <LocalizedFields label={dict['events.kicker']} value={kicker} onChange={setKicker} dict={dict} />
        <LocalizedFields label={dict['events.body']} value={body} onChange={setBody} dict={dict} multiline />

        <div className="grid grid-cols-2 gap-3">
          <Field label={dict['events.startsOn']}>
            <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={`${input} ${bad('startsOn')}`} />
          </Field>
          <Field label={dict['events.endsOn']}>
            <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={`${input} ${bad('endsOn')}`} />
          </Field>
          <Field label={dict['events.startTime']}>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${input} ${bad('startTime')}`} />
          </Field>
          <Field label={dict['events.endTime']} hint="24:00 = midnight">
            <input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="24:00" className={`${input} ${bad('endTime')}`} />
          </Field>
          <Field label={dict['events.price']}>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={`${input} ${bad('price')}`} />
          </Field>
          <Field label={dict['events.priority']} hint={dict['events.priorityHint']}>
            <input type="number" min={0} max={100} value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={input} />
          </Field>
        </div>

        <fieldset className="grid gap-3 rounded-xl border-2 border-ink/10 p-3">
          <legend className="px-1 text-sm font-bold">{dict['events.button']}</legend>
          <select value={cta} onChange={(e) => setCta(e.target.value as EventRecord['cta'])} className={input}>
            {EVENT_CTAS.map((c) => (
              <option key={c} value={c}>
                {dict[`events.cta.${c}`]}
              </option>
            ))}
          </select>
          {cta === 'link' && (
            <Field label={dict['events.ctaUrl']}>
              <input type="url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://" className={`${input} ${bad('ctaUrl')}`} />
            </Field>
          )}
          {cta !== 'none' && <LocalizedFields label={dict['events.ctaLabel']} value={ctaLabel} onChange={setCtaLabel} dict={dict} />}
        </fieldset>

        <fieldset className={`grid gap-3 rounded-xl border-2 border-ink/10 p-3 ${bad('highlights')}`}>
          <legend className="px-1 text-sm font-bold">{dict['events.highlights']}</legend>
          {highlights.map((h, i) => (
            <div key={i} className="grid gap-1">
              <LocalizedFields label={`#${i + 1}`} value={h} onChange={(v) => setHighlights((list) => list.map((x, j) => (j === i ? v : x)))} dict={dict} />
              <button type="button" className={`${ghost} justify-self-start text-hibiscus`} onClick={() => setHighlights((list) => list.filter((_, j) => j !== i))}>
                {dict['common.remove']}
              </button>
            </div>
          ))}
          {highlights.length < 8 && (
            <button type="button" className={`${ghost} justify-self-start`} onClick={() => setHighlights((list) => [...list, {}])}>
              + {dict['common.add']}
            </button>
          )}
        </fieldset>

        <fieldset className={`grid gap-2 ${bad('color')}`}>
          <legend className="text-sm font-semibold">{dict['events.color']}</legend>
          <span className="flex flex-wrap gap-1">
            {PALETTE.filter((c) => c !== 'cream').map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`size-8 rounded-full border-2 ${color === c ? 'border-ink ring-2 ring-ink ring-offset-2' : 'border-ink/20'}`}
                style={{ background: `var(--c-${c})` }}
              />
            ))}
          </span>
        </fieldset>
        <Field label={dict['events.image']} group>
          <PhotoField value={image} onChange={setImage} dict={dict} folder="events" />
        </Field>
        <Field label={dict['events.video']} hint={dict['gallery.videoHint']} group>
          <PhotoField value={video} onChange={setVideo} dict={dict} folder="events" video />
        </Field>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="size-5" />
          {dict['events.publishNow']}
        </label>

        {!event && (
          <p className={`text-sm ${bad('slug')}`}>
            {dict['events.address']}: <code>/event/{id || '…'}</code>
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
          {event && (
            <button type="button" onClick={remove} className={`${ghost} text-hibiscus`}>
              {dict['common.delete']}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
