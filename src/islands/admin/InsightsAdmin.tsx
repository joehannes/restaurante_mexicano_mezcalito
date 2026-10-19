/**
 * Insights: a KPI row with change against the period before, orders per day
 * as one-hue columns (hover for the day's numbers, or open the table), the
 * most ordered dishes, and how guests order, pay and answer the Radio.
 */
import { useEffect, useRef, useState } from 'react';
import type { Locale, Localized } from '../../domain/types';
import { localized } from '../../domain/types';
import { fillAdmin, type AdminDictionary, type AdminKey, type AdminLocale } from '../../i18n/admin';
import { formatPrice } from '../../lib/format';
import type { Insights } from '../../server/insights';
import { api } from './api';

const RANGES = [7, 30, 90];
/** One hue for magnitude: the brand's green, checked against the white card. */
const BAR = 'var(--c-jungle)';

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return null;
  const change = Math.round(((now - before) / before) * 100);
  const up = change >= 0;
  return (
    <span className={`text-sm font-semibold ${up ? 'text-jungle' : 'text-hibiscus'}`}>
      {up ? '▲' : '▼'} {Math.abs(change)}%
    </span>
  );
}

function DailyChart({ data, locale, dict }: { data: Insights['daily']; locale: Locale; dict: AdminDictionary }) {
  const [hover, setHover] = useState<number>();
  // Drawn at the width it is shown at, so text stays readable on a phone.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setW(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const max = Math.max(1, ...data.map((d) => d.orders));
  const TOP = 14;
  const H = 180;
  const step = W / data.length;
  const gap = Math.min(2, step * 0.2);
  const ticks = [0, Math.ceil(max / 2), max];
  const y = (v: number) => TOP + H - (v / max) * H;
  const day = (date: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-DO' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  const point = hover === undefined ? undefined : data[hover];
  return (
    <div className="relative" ref={box}>
      <svg viewBox={`0 0 ${W} ${TOP + H + 24}`} width={W} height={TOP + H + 24} className="block" role="img" aria-label={dict['insights.daily']} onMouseLeave={() => setHover(undefined)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="var(--c-ink)" strokeOpacity="0.08" />
            <text x="2" y={y(t) - 3} fontSize="11" fill="var(--c-ink)" fillOpacity="0.6">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.orders / max) * H;
          const x = i * step + gap / 2;
          const w = Math.max(1, step - gap);
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}>
              {/* The hit area is the whole column, not just the bar. */}
              <rect x={i * step} y={TOP} width={step} height={H} fill="transparent" />
              {d.orders > 0 && (
                // Rounded at the data end, square on the baseline.
                <path
                  d={`M${x} ${TOP + H}V${TOP + H - h + Math.min(4, h)}q0 -${Math.min(4, h)} ${Math.min(4, w / 2)} -${Math.min(4, h)}H${x + w - Math.min(4, w / 2)}q${Math.min(4, w / 2)} 0 ${Math.min(4, w / 2)} ${Math.min(4, h)}V${TOP + H}z`}
                  fill={BAR}
                  opacity={hover === undefined || hover === i ? 1 : 0.45}
                />
              )}
            </g>
          );
        })}
        <line x1="0" x2={W} y1={TOP + H} y2={TOP + H} stroke="var(--c-ink)" strokeOpacity="0.3" />
        {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((i, k) => (
          <text key={i} x={k === 0 ? 0 : k === 2 ? W : i * step + step / 2} y={TOP + H + 16} fontSize="11" textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'} fill="var(--c-ink)" fillOpacity="0.6">
            {day(data[i]!.date)}
          </text>
        ))}
      </svg>
      {point && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 rounded-lg bg-ink px-3 py-2 text-sm text-cream shadow"
          style={{ left: `min(calc(${((hover! + 0.5) / data.length) * 100}% + 8px), calc(100% - 10rem))` }}
        >
          <span className="block font-semibold">{day(point.date)}</span>
          {point.orders} · {formatPrice(Math.round(point.revenue / 100) * 100, locale)}
        </div>
      )}
    </div>
  );
}

export default function InsightsAdmin({ dict, locale }: { dict: AdminDictionary; locale: AdminLocale }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Insights>();
  const loc = locale as Locale;
  const a = (key: AdminKey, vars?: Record<string, string | number>) => fillAdmin(dict, key, vars);

  useEffect(() => {
    setData(undefined);
    api<Insights>(`/insights?days=${days}`).then((r) => r.ok && setData(r.data));
  }, [days]);

  const name = (json: string) => {
    try {
      return localized(JSON.parse(json) as Localized, loc);
    } catch {
      return json;
    }
  };
  const tiles: [AdminKey, keyof Insights['kpis'], (n: number) => string][] = [
    ['insights.orders', 'orders', String],
    // Whole pesos: centavos are noise at this scale.
    ['insights.revenue', 'revenue', (n) => formatPrice(Math.round(n / 100) * 100, loc)],
    ['insights.avgTicket', 'avgTicket', (n) => formatPrice(Math.round(n / 100) * 100, loc)],
    ['insights.covers', 'covers', String],
    ['insights.parties', 'parties', String],
  ];
  const modeLabel: Record<string, AdminKey> = { pickup: 'board.pickup', delivery: 'board.delivery', dine_in: 'board.table' };
  const payLabel: Record<string, string> = { cash: dict['board.cash'], card_on_delivery: dict['board.card'], azul: 'Azul', paypal: 'PayPal', online: dict['board.paid'] };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 font-display text-3xl uppercase">{dict['insights.title']}</h1>
        {RANGES.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={days === n}
            onClick={() => setDays(n)}
            className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${days === n ? 'border-ink bg-ink text-cream' : 'border-ink/20 bg-white'}`}
          >
            {a('insights.range', { n })}
          </button>
        ))}
      </div>

      {!data ? (
        <p>{dict['common.loading']}</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {tiles.map(([label, key, show]) => (
              <div key={key} className="rounded-2xl bg-white p-4">
                <p className="text-sm text-ink/70">{dict[label]}</p>
                <p className="mt-1 text-2xl font-bold break-words lg:text-3xl">{show(data.kpis[key])}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-1 text-xs text-ink/60">
                  <Delta now={data.kpis[key]} before={data.previous[key]} /> {data.previous[key] ? a('insights.vsPrevious', { n: data.days }) : ''}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl bg-white p-4">
            <h2 className="font-bold">{dict['insights.daily']}</h2>
            {data.kpis.orders === 0 ? <p className="mt-2 text-ink/60">{dict['insights.none']}</p> : <DailyChart data={data.daily} locale={loc} dict={dict} />}
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer font-semibold">{dict['insights.table']}</summary>
              <table className="mt-2 w-full">
                <thead>
                  <tr className="text-left text-ink/60">
                    <th className="py-1">{dict['insights.date']}</th>
                    <th className="py-1 text-right">{dict['insights.orders']}</th>
                    <th className="py-1 text-right">{dict['insights.revenue']}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((d) => (
                    <tr key={d.date} className="border-t border-ink/10">
                      <td className="py-1">{d.date}</td>
                      <td className="py-1 text-right">{d.orders}</td>
                      <td className="py-1 text-right">{formatPrice(d.revenue, loc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl bg-white p-4">
              <h2 className="font-bold">{dict['insights.top']}</h2>
              <ol className="mt-3 space-y-2">
                {data.topItems.map((t) => {
                  const max = data.topItems[0]?.qty ?? 1;
                  return (
                    <li key={t.itemId}>
                      <p className="flex justify-between gap-2 text-sm">
                        <span>{name(t.name)}</span>
                        <span className="font-semibold">
                          {t.qty} · {formatPrice(t.revenue, loc)}
                        </span>
                      </p>
                      <span className="mt-1 block h-2 rounded-full" style={{ width: `${Math.max(4, (t.qty / max) * 100)}%`, background: BAR }} aria-hidden="true" />
                    </li>
                  );
                })}
              </ol>
            </section>
            <section className="space-y-4 rounded-2xl bg-white p-4">
              {(
                [
                  ['insights.modes', data.modes, (k: string) => (modeLabel[k] ? a(modeLabel[k]!, { table: '' }).trim() : k)],
                  ['insights.payments', data.payments, (k: string) => payLabel[k] ?? k],
                ] as const
              ).map(([title, counts, label]) => (
                <div key={title}>
                  <h2 className="font-bold">{dict[title]}</h2>
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {Object.entries(counts)
                        .sort((x, y) => y[1] - x[1])
                        .map(([k, n]) => (
                          <tr key={k} className="border-t border-ink/10">
                            <td className="py-1">{label(k)}</td>
                            <td className="py-1 text-right font-semibold">{n}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          </div>

          <section className="rounded-2xl bg-white p-4">
            <h2 className="font-bold">{dict['insights.radio']}</h2>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {data.radio.map((r) => (
                  <tr key={`${r.node}-${r.option}`} className="border-t border-ink/10">
                    <td className="py-1 text-ink/60">{r.node}</td>
                    <td className="py-1">{r.option}</td>
                    <td className="py-1 text-right font-semibold">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-ink/60">{dict['insights.more']}</p>
          </section>
        </>
      )}
    </div>
  );
}
