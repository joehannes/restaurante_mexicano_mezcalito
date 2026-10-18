/**
 * Settings, one card per thing with its own Save: hours and holidays,
 * contact (the fix for three different phone numbers online), address, links,
 * the Google rating, tax and service, reservation rules and delivery zones.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { DayOverride, ReservationRules } from '../../domain/capacity';
import type { Closure, DeliveryZone, Localized, PricingSettings, TimeRange, WeeklyHours } from '../../domain/types';
import { fillAdmin, type AdminDictionary, type AdminLocale } from '../../i18n/admin';
import type { SiteSettings } from '../../server/content';
import { api, toCentavos, toPesos } from './api';
import { button, Field, ghost, field, input, LocalizedFields } from './ui';

type Settings = SiteSettings & { reservations: ReservationRules };
type Status = 'idle' | 'saving' | 'saved' | 'error';

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const dayName = (n: number, locale: string) =>
  new Intl.DateTimeFormat(locale === 'es' ? 'es-DO' : 'en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 18 + n, 12)));
const pct = (rate: number) => String(Math.round(rate * 10_000) / 100);
const rate = (text: string) => Number(text) / 100;

function Card({ title, onSave, status, dict, children }: { title: string; onSave: () => void; status: Status; dict: AdminDictionary; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4">
      <h2 className="mb-3 font-display text-2xl uppercase">{title}</h2>
      <div className="grid gap-3">{children}</div>
      <p className="mt-4 flex items-center gap-3">
        <button type="button" className={button} onClick={onSave} disabled={status === 'saving'}>
          {status === 'saving' ? dict['common.saving'] : dict['common.save']}
        </button>
        {status === 'saved' && <span className="font-semibold text-jungle">✓ {dict['common.saved']}</span>}
        {status === 'error' && <span className="font-semibold text-hibiscus">{dict['common.error']}</span>}
      </p>
    </section>
  );
}

/** One weekday's single opening range, or closed. */
function DayRange({ label, value, onChange, dict }: { label: string; value: TimeRange[]; onChange: (v: TimeRange[]) => void; dict: AdminDictionary }) {
  const range = value[0];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 font-semibold capitalize">{label}</span>
      <label className="flex items-center gap-1 text-sm">
        <input type="checkbox" checked={!range} onChange={(e) => onChange(e.target.checked ? [] : [{ open: '08:00', close: '24:00' }])} />
        {dict['settings.closed']}
      </label>
      {range && (
        <>
          <input value={range.open} onChange={(e) => onChange([{ ...range, open: e.target.value }, ...value.slice(1)])} className={`${field} w-24`} placeholder="08:00" />
          –
          <input value={range.close} onChange={(e) => onChange([{ ...range, close: e.target.value }, ...value.slice(1)])} className={`${field} w-24`} placeholder="24:00" />
        </>
      )}
    </div>
  );
}

export default function SettingsAdmin({ dict, locale }: { dict: AdminDictionary; locale: AdminLocale }) {
  const [s, setS] = useState<Settings>();
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [zoneText, setZoneText] = useState<string[]>([]);

  useEffect(() => {
    api<Settings>('/settings').then((r) => {
      if (!r.ok) return;
      setS(r.data);
      setZoneText((r.data.deliveryZones ?? []).map((z) => z.polygon.map(([lng, lat]) => `${lat}, ${lng}`).join('\n')));
    });
  }, []);
  if (!s) return <p>{dict['common.loading']}</p>;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setS((prev) => prev && { ...prev, [key]: value });
  const save = async (key: keyof Settings, value: unknown = s[key]) => {
    setStatus((st) => ({ ...st, [key]: 'saving' }));
    const result = await api<{ value: unknown }>(`/settings/${key}`, { method: 'PUT', body: { value } });
    if (result.ok) set(key, result.data.value as never);
    setStatus((st) => ({ ...st, [key]: result.ok ? 'saved' : 'error' }));
  };
  const card = (key: keyof Settings, title: string, children: ReactNode, value?: () => unknown) => (
    <Card title={title} status={status[key] ?? 'idle'} dict={dict} onSave={() => save(key, value?.())}>
      {children}
    </Card>
  );

  const hours = (value: WeeklyHours, onChange: (v: WeeklyHours) => void) =>
    WEEK.map((d) => (
      <DayRange key={d} label={dayName(d, locale)} value={value[d] ?? []} dict={dict} onChange={(r) => onChange(value.map((x, i) => (i === d ? r : x)))} />
    ));

  const pricing: PricingSettings = s.pricing;
  const rules = s.reservations;
  const setRules = (patch: Partial<ReservationRules>) => set('reservations', { ...rules, ...patch });
  const num = (label: string, value: number, onChange: (n: number) => void, step = 1) => (
    <Field label={label}>
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={input} />
    </Field>
  );
  const zones: DeliveryZone[] = s.deliveryZones ?? [];

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-3xl uppercase">{dict['settings.title']}</h1>

      {card('hours', dict['settings.hours'], hours(s.hours, (v) => set('hours', v)))}

      {card(
        'closures',
        dict['settings.closures'],
        <>
          {s.closures.map((c: Closure, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 border-b border-ink/10 pb-2">
              <input type="date" value={c.date} onChange={(e) => set('closures', s.closures.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className={`${field} w-auto`} />
              <DayRange label="" value={c.ranges} dict={dict} onChange={(ranges) => set('closures', s.closures.map((x, j) => (j === i ? { ...x, ranges } : x)))} />
              <input
                value={c.reason ?? ''}
                placeholder={dict['settings.closureReason']}
                onChange={(e) => set('closures', s.closures.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))}
                className={`${field} w-48`}
              />
              <button type="button" className={ghost} onClick={() => set('closures', s.closures.filter((_, j) => j !== i))}>
                {dict['common.remove']}
              </button>
            </div>
          ))}
          <button type="button" className={`${ghost} justify-self-start`} onClick={() => set('closures', [...s.closures, { date: '', ranges: [] }])}>
            + {dict['common.add']}
          </button>
        </>,
      )}

      {card(
        'contact',
        dict['settings.contact'],
        <>
          {(['phone', 'whatsapp', 'email'] as const).map((k) => (
            <Field key={k} label={dict[`settings.${k}`]}>
              <input value={s.contact[k]} onChange={(e) => set('contact', { ...s.contact, [k]: e.target.value })} className={input} type={k === 'email' ? 'email' : 'tel'} />
            </Field>
          ))}
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              className="size-5"
              checked={!!(s.contact as { confirmed?: boolean }).confirmed}
              onChange={(e) => set('contact', { ...s.contact, confirmed: e.target.checked } as Settings['contact'])}
            />
            {dict['settings.confirmed']}
          </label>
        </>,
      )}

      {card(
        'address',
        dict['settings.address'],
        <>
          {(['street', 'locality', 'region'] as const).map((k) => (
            <Field key={k} label={dict[`settings.${k}`]}>
              <input value={s.address[k]} onChange={(e) => set('address', { ...s.address, [k]: e.target.value })} className={input} />
            </Field>
          ))}
          <div className="grid grid-cols-2 gap-3">
            {num(dict['settings.lat'], s.address.lat, (n) => set('address', { ...s.address, lat: n }), 0.00001)}
            {num(dict['settings.lng'], s.address.lng, (n) => set('address', { ...s.address, lng: n }), 0.00001)}
          </div>
          <LocalizedFields label={dict['settings.note']} value={s.address.note} onChange={(note) => set('address', { ...s.address, note: note as Localized })} dict={dict} />
        </>,
      )}

      {card(
        'social',
        dict['settings.social'],
        (['instagram', 'tiktok', 'facebook', 'ubereats', 'pedidosya'] as const).map((k) => (
          <Field key={k} label={k}>
            <input value={s.social[k] ?? ''} onChange={(e) => set('social', { ...s.social, [k]: e.target.value })} className={input} type="url" placeholder="https://" />
          </Field>
        )),
      )}

      {card(
        'reviewsSummary',
        dict['settings.reviews'],
        <div className="grid grid-cols-2 gap-3">
          {num(dict['settings.rating'], s.reviewsSummary?.rating ?? 0, (n) => set('reviewsSummary', { ...s.reviewsSummary!, rating: n }), 0.1)}
          {num(dict['settings.count'], s.reviewsSummary?.count ?? 0, (n) => set('reviewsSummary', { ...s.reviewsSummary!, count: n }))}
          <Field label={dict['settings.asOf']}>
            <input value={s.reviewsSummary?.asOf ?? ''} onChange={(e) => set('reviewsSummary', { ...s.reviewsSummary!, asOf: e.target.value })} className={input} />
          </Field>
          <Field label="Source">
            <input value={s.reviewsSummary?.source ?? 'Google'} onChange={(e) => set('reviewsSummary', { ...s.reviewsSummary!, source: e.target.value })} className={input} />
          </Field>
        </div>,
      )}

      {card(
        'pricing',
        dict['settings.pricing'],
        <div className="grid grid-cols-2 gap-3">
          <Field label={dict['settings.itbis']}>
            <input defaultValue={pct(pricing.itbisRate)} onChange={(e) => set('pricing', { ...pricing, itbisRate: rate(e.target.value) })} className={input} inputMode="decimal" />
          </Field>
          {(['dine_in', 'pickup', 'delivery'] as const).map((mode) => (
            <Field key={mode} label={fillAdmin(dict, 'settings.service', { mode: mode.replace('_', '-') })}>
              <input
                defaultValue={pct(pricing.serviceRate[mode])}
                onChange={(e) => set('pricing', { ...pricing, serviceRate: { ...pricing.serviceRate, [mode]: rate(e.target.value) } })}
                className={input}
                inputMode="decimal"
              />
            </Field>
          ))}
          {num(dict['settings.usd'], pricing.usdRate, (n) => set('pricing', { ...pricing, usdRate: n }), 0.01)}
        </div>,
      )}

      {card(
        'reservations',
        dict['settings.reservations'],
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {num(dict['settings.capacity'], rules.capacity, (n) => setRules({ capacity: n }))}
            {num(dict['settings.seating'], rules.seatingMinutes, (n) => setRules({ seatingMinutes: n }))}
            {num(dict['settings.slot'], rules.slotMinutes, (n) => setRules({ slotMinutes: n }))}
            {num(dict['settings.maxParty'], rules.maxParty, (n) => setRules({ maxParty: n }))}
            {num(dict['settings.lead'], rules.minLeadMinutes, (n) => setRules({ minLeadMinutes: n }))}
            {num(dict['settings.ahead'], rules.maxDaysAhead, (n) => setRules({ maxDaysAhead: n }))}
          </div>
          <p className="mt-2 font-semibold">{dict['settings.windows']}</p>
          {hours(rules.windows, (windows) => setRules({ windows }))}
          {rules.overrides.length > 0 && (
            <p className="text-sm text-ink/60">
              {rules.overrides.map((o: DayOverride) => `${o.date}${o.closed ? ' ✕' : ''}${o.capacity !== undefined ? ` (${o.capacity})` : ''}`).join(' · ')}
            </p>
          )}
        </>,
      )}

      {card(
        'deliveryZones',
        dict['settings.zones'],
        <>
          <p className="text-sm text-ink/70">{dict['settings.zonesHint']}</p>
          {zones.map((z, i) => (
            <div key={i} className="grid gap-2 rounded-xl border-2 border-ink/10 p-3 md:grid-cols-3">
              <Field label={dict['settings.zoneName']}>
                <input
                  value={z.name}
                  onChange={(e) =>
                    set(
                      'deliveryZones',
                      zones.map((x, j) => (j === i ? { ...x, name: e.target.value, id: x.id || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') } : x)),
                    )
                  }
                  className={input}
                />
              </Field>
              <Field label={dict['settings.fee']}>
                <input defaultValue={toPesos(z.fee)} onChange={(e) => set('deliveryZones', zones.map((x, j) => (j === i ? { ...x, fee: toCentavos(e.target.value) ?? -1 } : x)))} className={input} inputMode="decimal" />
              </Field>
              <Field label={dict['settings.minOrder']}>
                <input
                  defaultValue={toPesos(z.minOrder)}
                  onChange={(e) => set('deliveryZones', zones.map((x, j) => (j === i ? { ...x, minOrder: toCentavos(e.target.value) ?? -1 } : x)))}
                  className={input}
                  inputMode="decimal"
                />
              </Field>
              <Field label={dict['settings.corners']}>
                <textarea rows={4} value={zoneText[i] ?? ''} onChange={(e) => setZoneText((t) => t.map((x, j) => (j === i ? e.target.value : x)))} className={`${input} font-mono text-sm md:col-span-3`} />
              </Field>
              <button type="button" className={`${ghost} justify-self-start`} onClick={() => (set('deliveryZones', zones.filter((_, j) => j !== i)), setZoneText((t) => t.filter((_, j) => j !== i)))}>
                {dict['common.remove']}
              </button>
            </div>
          ))}
          <button
            type="button"
            className={`${ghost} justify-self-start`}
            onClick={() => (set('deliveryZones', [...zones, { id: '', name: '', polygon: [], fee: 0, minOrder: 0 }]), setZoneText((t) => [...t, '']))}
          >
            + {dict['common.add']}
          </button>
        </>,
        // Corners are typed as "lat, lng" (what Google Maps copies); zones store [lng, lat].
        () =>
          zones.map((z, i) => ({
            ...z,
            polygon: (zoneText[i] ?? '')
              .split('\n')
              .map((line) => line.split(',').map((n) => Number(n.trim())))
              .filter((p) => p.length === 2 && p.every(Number.isFinite))
              .map(([lat, lng]) => [lng, lat]),
          })),
      )}
    </div>
  );
}
