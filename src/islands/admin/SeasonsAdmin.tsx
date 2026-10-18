/**
 * Seasons: start one from a preset, then shape it — dates, colours, the home
 * hero, its own page, a playlist and a share image — preview it as a guest
 * would see it, and publish.
 */
import { useEffect, useState } from 'react';
import { PALETTE } from '../../domain/adminInput';
import type { SeasonBlock } from '../../domain/seasonPresets';
import type { Locale, Localized } from '../../domain/types';
import { localized } from '../../domain/types';
import type { AdminDictionary, AdminKey, AdminLocale } from '../../i18n/admin';
import type { SeasonRecord } from '../../server/content';
import { api } from './api';
import { button, Field, field, ghost, input, LocalizedFields, PhotoField, Sheet } from './ui';

interface Data {
  seasons: SeasonRecord[];
  presets: { slug: string; name: Localized }[];
  dishes: { id: string; name: Localized }[];
  nights: { id: string; title: Localized }[];
  today: string;
}

/** The default skin, from global.css: what a season starts from. */
const DEFAULTS: Record<(typeof PALETTE)[number], string> = {
  ink: '#141210',
  cream: '#fbf3e4',
  gold: '#f6b818',
  hibiscus: '#e5267a',
  jungle: '#138a43',
  sunset: '#f2581d',
  lagoon: '#12b3b8',
  mezcal: '#4b2a7a',
};

const statusOf = (s: SeasonRecord, today: string): 'live' | 'scheduled' | 'draft' | 'ended' =>
  !s.published ? 'draft' : today > s.endsOn ? 'ended' : today < s.startsOn ? 'scheduled' : 'live';
const STATUS_STYLE = { live: 'bg-jungle text-cream', scheduled: 'bg-gold', draft: 'bg-ink/10', ended: 'bg-ink/10 opacity-60' };

export default function SeasonsAdmin({ dict, locale }: { dict: AdminDictionary; locale: AdminLocale }) {
  const [data, setData] = useState<Data>();
  const [preset, setPreset] = useState('');
  const [editing, setEditing] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const loc = locale as Locale;

  const load = async () => {
    const result = await api<Data>('/seasons');
    if (result.ok) setData(result.data);
  };
  useEffect(() => {
    load();
  }, []);

  const start = async () => {
    if (!preset) return;
    const result = await api<{ slug: string }>('/seasons', { body: { preset } });
    await load();
    if (result.ok) setEditing(result.data.slug);
    else if (result.error === 'exists') setNotice(dict['seasons.exists']);
  };

  if (!data) return <p>{dict['common.loading']}</p>;
  const current = data.seasons.find((s) => s.slug === editing);
  return (
    <div>
      <h1 className="font-display text-3xl uppercase">{dict['seasons.title']}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">{dict['seasons.intro']}</p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field label={dict['seasons.fromPreset']}>
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className={`${field} w-auto`}>
            <option value="">—</option>
            {data.presets.map((p) => (
              <option key={p.slug} value={p.slug}>
                {localized(p.name, loc)}
              </option>
            ))}
          </select>
        </Field>
        <button type="button" className={button} disabled={!preset} onClick={start}>
          {dict['seasons.start']}
        </button>
        {notice && <span className="text-sm font-semibold text-hibiscus">{notice}</span>}
      </div>

      <ul className="mt-6 space-y-3">
        {data.seasons.map((s) => {
          const status = statusOf(s, data.today);
          return (
            <li key={s.slug} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3">
              <span className="flex gap-0.5" aria-hidden="true">
                {['mezcal', 'gold', 'hibiscus'].map((c) => (
                  <span key={c} className="h-10 w-3 rounded-full" style={{ background: s.tokens[`--c-${c}`] ?? DEFAULTS[c as keyof typeof DEFAULTS] }} />
                ))}
              </span>
              <span className="min-w-48 flex-1">
                <span className="font-bold">{localized(s.name, loc)}</span>
                <span className="block text-sm text-ink/60">
                  {s.startsOn} → {s.endsOn} · {s.priority}
                </span>
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[status]}`}>{dict[`seasons.status.${status}`]}</span>
              <button type="button" className={ghost} onClick={() => setEditing(s.slug)}>
                {dict['common.edit']}
              </button>
            </li>
          );
        })}
      </ul>

      {current && (
        <SeasonEditor
          key={current.slug}
          season={current}
          data={data}
          dict={dict}
          locale={loc}
          onClose={() => setEditing(undefined)}
          onSaved={async (close) => {
            await load();
            if (close) setEditing(undefined);
          }}
        />
      )}
    </div>
  );
}

/** Draws a 1200×630 poster from the season's colours and copy, in the brand's poster type. */
async function sharePoster(season: { tokens: Record<string, string>; hero: SeasonRecord['hero']; name: Localized }): Promise<Blob | null> {
  const color = (name: keyof typeof DEFAULTS) => season.tokens[`--c-${name}`] ?? DEFAULTS[name];
  await document.fonts.load('80px Anton');
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const g = canvas.getContext('2d')!;
  g.fillStyle = color('mezcal');
  g.fillRect(0, 0, 1200, 630);
  // Papel picado along the top.
  const flags = [color('hibiscus'), color('gold'), color('jungle'), color('lagoon')];
  for (let i = 0; i < 24; i++) {
    g.fillStyle = flags[i % flags.length]!;
    g.beginPath();
    g.moveTo(i * 50, 0);
    g.lineTo(i * 50 + 50, 0);
    g.lineTo(i * 50 + 25, 46);
    g.fill();
  }
  g.textBaseline = 'alphabetic';
  g.fillStyle = color('gold');
  g.font = '44px Anton, Impact, sans-serif';
  g.fillText(season.hero.kicker.en.toUpperCase(), 70, 150);
  // The headline, wrapped to the width.
  g.fillStyle = color('cream');
  g.font = '112px Anton, Impact, sans-serif';
  const words = season.hero.headline.en.toUpperCase().split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last && g.measureText(`${last} ${word}`).width < 1060) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  lines.slice(0, 3).forEach((line, i) => g.fillText(line, 70, 270 + i * 112));
  g.fillStyle = color('gold');
  g.fillRect(0, 560, 1200, 70);
  g.fillStyle = color('ink');
  g.font = '40px Anton, Impact, sans-serif';
  g.fillText('MEZCALITO  ·  BÁVARO, PUNTA CANA', 70, 610);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function SeasonEditor({
  season,
  data,
  dict,
  locale,
  onClose,
  onSaved,
}: {
  season: SeasonRecord;
  data: Data;
  dict: AdminDictionary;
  locale: Locale;
  onClose: () => void;
  onSaved: (close: boolean) => void;
}) {
  const [s, setS] = useState(season);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [making, setMaking] = useState(false);
  const set = (patch: Partial<SeasonRecord>) => setS((prev) => ({ ...prev, ...patch }));
  const setBlock = (i: number, block: SeasonBlock) => set({ blocks: s.blocks.map((b, j) => (j === i ? block : b)) });
  const moveBlock = (i: number, by: number) => {
    const blocks = [...s.blocks];
    const [b] = blocks.splice(i, 1);
    blocks.splice(i + by, 0, b!);
    set({ blocks });
  };
  const emptyText: Localized = { en: '' };
  const newBlock = (type: SeasonBlock['type']): SeasonBlock =>
    type === 'story'
      ? { type, title: emptyText, body: emptyText }
      : type === 'dishes'
        ? { type, title: { en: 'On the menu this season' }, itemIds: [] }
        : type === 'nights'
          ? { type, specialIds: [] }
          : { type, images: [] };

  const save = async (close: boolean) => {
    setSaving(true);
    const result = await api(`/seasons/${s.slug}`, { method: 'PUT', body: s });
    setSaving(false);
    if (result.ok) {
      setErrors([]);
      onSaved(close);
    } else setErrors(result.fields.length ? result.fields : ['error']);
  };
  const remove = async () => {
    if (!confirm(dict['common.confirmDelete'])) return;
    if ((await api(`/seasons/${s.slug}`, { method: 'DELETE' })).ok) onSaved(true);
  };
  const makePoster = async () => {
    setMaking(true);
    const blob = await sharePoster(s);
    if (blob) {
      const form = new FormData();
      form.set('file', new File([blob], `${s.slug}.png`, { type: 'image/png' }));
      form.set('folder', 'seasons');
      const result = await api<{ path: string }>('/upload', { form });
      if (result.ok) set({ ogImage: result.data.path });
    }
    setMaking(false);
  };
  const bad = (f: string) => (errors.includes(f) ? 'ring-2 ring-hibiscus rounded-xl' : '');
  const toggleId = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const chip = (on: boolean) => `rounded-full border-2 px-3 py-1 text-sm ${on ? 'border-ink bg-ink text-cream' : 'border-ink/20 bg-white'}`;

  return (
    <Sheet title={localized(s.name, locale)} onClose={onClose} dict={dict}>
      <div className="grid gap-4">
        <p className="flex flex-wrap gap-2">
          <a className={ghost} href={`/${locale}/?season=${s.slug}`} target="_blank" rel="noopener">
            {dict['seasons.previewHome']} ↗
          </a>
          <a className={ghost} href={`/${locale}/season/${s.slug}?season=${s.slug}`} target="_blank" rel="noopener">
            {dict['seasons.previewPage']} ↗
          </a>
        </p>
        <div className={bad('name')}>
          <LocalizedFields label={dict['seasons.name']} value={s.name} onChange={(name) => set({ name: name as Localized })} dict={dict} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Field label={dict['seasons.startsOn']}>
            <input type="date" value={s.startsOn} onChange={(e) => set({ startsOn: e.target.value })} className={`${input} ${bad('startsOn')}`} />
          </Field>
          <Field label={dict['seasons.endsOn']}>
            <input type="date" value={s.endsOn} onChange={(e) => set({ endsOn: e.target.value })} className={`${input} ${bad('endsOn')}`} />
          </Field>
          <Field label={dict['seasons.priority']}>
            <input type="number" min={0} max={100} value={s.priority} onChange={(e) => set({ priority: Number(e.target.value) })} className={input} />
          </Field>
        </div>
        <label className="flex items-center gap-2 rounded-xl bg-gold/40 p-3 font-semibold">
          <input type="checkbox" className="size-5" checked={s.published} onChange={(e) => set({ published: e.target.checked })} />
          {dict['seasons.published']}
        </label>

        <fieldset className={`rounded-xl border-2 border-ink/10 p-3 ${bad('tokens')}`}>
          <legend className="px-1 text-sm font-bold">{dict['seasons.palette']}</legend>
          <p className="mb-2 text-xs text-ink/60">{dict['seasons.paletteHint']}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PALETTE.map((c) => {
              const key = `--c-${c}`;
              const on = key in s.tokens;
              return (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      const tokens = { ...s.tokens };
                      if (e.target.checked) tokens[key] = DEFAULTS[c];
                      else delete tokens[key];
                      set({ tokens });
                    }}
                  />
                  <input
                    type="color"
                    value={s.tokens[key] ?? DEFAULTS[c]}
                    disabled={!on}
                    onChange={(e) => set({ tokens: { ...s.tokens, [key]: e.target.value } })}
                    className="h-8 w-10 rounded disabled:opacity-40"
                  />
                  {c}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className={`grid gap-3 ${bad('hero')}`}>
          <legend className="font-display text-xl uppercase">{dict['seasons.hero']}</legend>
          <LocalizedFields label={dict['seasons.kicker']} value={s.hero.kicker} onChange={(kicker) => set({ hero: { ...s.hero, kicker: kicker as Localized } })} dict={dict} />
          <LocalizedFields label={dict['seasons.headline']} value={s.hero.headline} onChange={(headline) => set({ hero: { ...s.hero, headline: headline as Localized } })} dict={dict} />
          <LocalizedFields label={dict['seasons.body']} value={s.hero.body} onChange={(body) => set({ hero: { ...s.hero, body: body as Localized } })} dict={dict} multiline />
          <Field label={dict['seasons.cta']}>
            <select value={s.hero.cta} onChange={(e) => set({ hero: { ...s.hero, cta: e.target.value as 'order' | 'book' } })} className={input}>
              <option value="book">{dict['nights.cta.book']}</option>
              <option value="order">{dict['nights.cta.order']}</option>
            </select>
          </Field>
        </fieldset>

        <fieldset className={`grid gap-3 ${bad('blocks')}`}>
          <legend className="font-display text-xl uppercase">{dict['seasons.blocks']}</legend>
          {s.blocks.map((block, i) => (
            <div key={i} className="rounded-xl border-2 border-ink/10 bg-white p-3">
              <p className="mb-2 flex items-center gap-2">
                <span className="flex-1 font-bold">{dict[`seasons.block.${block.type}` as AdminKey]}</span>
                <button type="button" className={ghost} disabled={i === 0} onClick={() => moveBlock(i, -1)} aria-label={dict['common.up']}>
                  ↑
                </button>
                <button type="button" className={ghost} disabled={i === s.blocks.length - 1} onClick={() => moveBlock(i, 1)} aria-label={dict['common.down']}>
                  ↓
                </button>
                <button type="button" className={`${ghost} text-hibiscus`} onClick={() => set({ blocks: s.blocks.filter((_, j) => j !== i) })}>
                  {dict['common.remove']}
                </button>
              </p>
              {block.type === 'story' && (
                <div className="grid gap-2">
                  <LocalizedFields label={dict['seasons.blockTitle']} value={block.title} onChange={(title) => setBlock(i, { ...block, title: title as Localized })} dict={dict} />
                  <LocalizedFields label={dict['seasons.blockBody']} value={block.body} onChange={(body) => setBlock(i, { ...block, body: body as Localized })} dict={dict} multiline />
                </div>
              )}
              {block.type === 'dishes' && (
                <div className="grid gap-2">
                  <LocalizedFields label={dict['seasons.blockTitle']} value={block.title} onChange={(title) => setBlock(i, { ...block, title: title as Localized })} dict={dict} />
                  <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto">
                    {data.dishes.map((d) => (
                      <button key={d.id} type="button" className={chip(block.itemIds.includes(d.id))} onClick={() => setBlock(i, { ...block, itemIds: toggleId(block.itemIds, d.id) })}>
                        {localized(d.name, locale)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {block.type === 'nights' && (
                <div className="flex flex-wrap gap-1">
                  {data.nights.map((n) => (
                    <button key={n.id} type="button" className={chip(block.specialIds.includes(n.id))} onClick={() => setBlock(i, { ...block, specialIds: toggleId(block.specialIds, n.id) })}>
                      {localized(n.title, locale)}
                    </button>
                  ))}
                </div>
              )}
              {block.type === 'gallery' && (
                <div className="grid gap-2">
                  {block.images.map((src, k) => (
                    <PhotoField key={src} value={src} folder="seasons" dict={dict} onChange={(path) => setBlock(i, { ...block, images: path ? block.images.map((x, j) => (j === k ? path : x)) : block.images.filter((_, j) => j !== k) })} />
                  ))}
                  <PhotoField value={null} folder="seasons" dict={dict} onChange={(path) => path && setBlock(i, { ...block, images: [...block.images, path] })} />
                </div>
              )}
            </div>
          ))}
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{dict['seasons.addBlock']}:</span>
            {(['story', 'dishes', 'nights', 'gallery'] as const).map((type) => (
              <button key={type} type="button" className={ghost} onClick={() => set({ blocks: [...s.blocks, newBlock(type)] })}>
                + {dict[`seasons.block.${type}`]}
              </button>
            ))}
          </p>
        </fieldset>

        <Field label={dict['seasons.playlist']}>
          <input type="url" value={s.playlistUrl ?? ''} onChange={(e) => set({ playlistUrl: e.target.value || null })} placeholder="https://" className={`${input} ${bad('playlistUrl')}`} />
        </Field>
        <Field label={dict['seasons.shareImage']} group>
          <div className="grid gap-2">
            {s.ogImage && <img src={s.ogImage} alt="" className="aspect-[1200/630] w-full max-w-sm rounded-lg object-cover" />}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={ghost} onClick={makePoster} disabled={making}>
                {making ? dict['common.saving'] : dict['seasons.generate']}
              </button>
              <PhotoField value={null} folder="seasons" dict={dict} onChange={(path) => path && set({ ogImage: path })} />
            </div>
          </div>
        </Field>

        {errors.length > 0 && (
          <p role="alert" className="font-semibold text-hibiscus">
            {dict['common.error']}
          </p>
        )}
        <div className="sticky bottom-0 flex gap-3 bg-cream py-2">
          <button type="button" onClick={() => save(false)} disabled={saving} className={`${button} flex-1 py-3 text-base`}>
            {saving ? dict['common.saving'] : dict['common.save']}
          </button>
          <button type="button" onClick={remove} className={`${ghost} text-hibiscus`}>
            {dict['common.delete']}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
