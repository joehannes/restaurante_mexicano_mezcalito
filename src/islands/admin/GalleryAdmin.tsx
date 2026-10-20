/**
 * The polaroid wall, for staff: upload a photo or a short silent clip, write
 * its caption in marker, tilt it, choose whether it is on the home page, and
 * put the wall in order. What you see here is how guests see it.
 */
import { useEffect, useState } from 'react';
import type { Locale, Localized } from '../../domain/types';
import { localized } from '../../domain/types';
import type { AdminDictionary, AdminLocale } from '../../i18n/admin';
import type { GalleryItem } from '../../server/gallery';
import { api } from './api';
import { button, Field, ghost, LocalizedFields, PhotoField, Sheet, Toggle } from './ui';

const marker = { fontFamily: "'Permanent Marker', 'Comic Sans MS', cursive", color: '#1f2a6b' };

/** One polaroid, as it hangs on the wall. */
function Polaroid({ item, locale, size = 'w-40' }: { item: Pick<GalleryItem, 'kind' | 'src' | 'poster' | 'caption' | 'tilt'>; locale: Locale; size?: string }) {
  return (
    <figure className={`${size} shrink-0 bg-[#fffdf8] p-2 pb-0 shadow-[0_8px_18px_-6px_rgb(20_18_16/0.5)]`} style={{ rotate: `${item.tilt}deg` }}>
      <div className="aspect-square overflow-hidden bg-ink/80">
        {item.kind === 'video' ? (
          <video src={item.src} poster={item.poster ?? undefined} muted loop autoPlay playsInline className="size-full object-cover" />
        ) : (
          <img src={item.src} alt="" className="size-full object-cover" />
        )}
      </div>
      <figcaption className="grid min-h-10 place-items-center px-1 py-1.5 text-center text-sm leading-tight" style={marker}>
        {localized(item.caption, locale) || '…'}
      </figcaption>
    </figure>
  );
}

export default function GalleryAdmin({ dict, locale }: { dict: AdminDictionary; locale: AdminLocale }) {
  const [items, setItems] = useState<GalleryItem[]>();
  const [editing, setEditing] = useState<GalleryItem | 'new'>();
  const loc = locale as Locale;

  const load = async () => {
    const result = await api<{ items: GalleryItem[] }>('/gallery');
    if (result.ok) setItems(result.data.items);
  };
  useEffect(() => {
    load();
  }, []);

  const save = (g: GalleryItem) => api(`/gallery/${g.id}`, { method: 'PUT', body: g });
  const set = async (g: GalleryItem, patch: Partial<GalleryItem>) => {
    setItems((list) => list?.map((x) => (x.id === g.id ? { ...x, ...patch } : x)));
    if (!(await save({ ...g, ...patch })).ok) load();
  };
  const move = async (index: number, by: number) => {
    if (!items) return;
    const list = [...items];
    const [it] = list.splice(index, 1);
    list.splice(index + by, 0, it!);
    setItems(list);
    await api('/gallery', { method: 'PUT', body: { ids: list.map((g) => g.id) } });
  };

  if (!items) return <p>{dict['common.loading']}</p>;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl uppercase">{dict['gallery.title']}</h1>
        <button type="button" className={button} onClick={() => setEditing('new')}>
          + {dict['gallery.new']}
        </button>
        <a href="/en/gallery" className={ghost} target="_blank" rel="noreferrer">
          {dict['gallery.view']} ↗
        </a>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-ink/70">{dict['gallery.intro']}</p>
      {!items.length && <p>{dict['common.none']}</p>}
      <ul className="grid gap-3">
        {items.map((g, i) => (
          <li key={g.id} className={`flex flex-wrap items-center gap-4 rounded-xl bg-white p-3 ${g.published ? '' : 'opacity-60'}`}>
            <Polaroid item={g} locale={loc} size="w-24" />
            <span className="min-w-40 flex-1">
              <span className="font-bold">{localized(g.caption, loc)}</span>
              <span className="block text-sm text-ink/60">
                {g.kind === 'video' ? `🎥 ${dict['gallery.video']}` : `📷 ${dict['gallery.photo']}`} · {g.tilt}°
              </span>
            </span>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-5" checked={g.onHome} onChange={(e) => set(g, { onHome: e.target.checked })} />
              {dict['gallery.onHome']}
            </label>
            <Toggle on={g.published} onChange={(on) => set(g, { published: on })} labels={[dict['common.active'], dict['common.hidden']]} />
            <span className="flex gap-1">
              <button type="button" className={ghost} disabled={i === 0} onClick={() => move(i, -1)} aria-label={dict['common.up']}>
                ↑
              </button>
              <button type="button" className={ghost} disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={dict['common.down']}>
                ↓
              </button>
            </span>
            <button type="button" className={ghost} onClick={() => setEditing(g)}>
              {dict['common.edit']}
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <GalleryEditor
          item={editing === 'new' ? undefined : editing}
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

function GalleryEditor({ item, dict, locale, onClose, onSaved }: { item?: GalleryItem; dict: AdminDictionary; locale: Locale; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<'photo' | 'video'>(item?.kind ?? 'photo');
  const [src, setSrc] = useState<string | null>(item?.src ?? null);
  const [poster, setPoster] = useState<string | null>(item?.poster ?? null);
  const [caption, setCaption] = useState<Partial<Localized>>(item?.caption ?? {});
  // A new one gets a random lean, so the wall never lines up.
  const [tilt, setTilt] = useState(item?.tilt ?? Math.round((Math.random() * 12 - 6) * 2) / 2);
  const [onHome, setOnHome] = useState(item?.onHome ?? true);
  const [published, setPublished] = useState(item?.published ?? true);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const body = { kind, src, poster: kind === 'video' ? poster : null, caption, tilt, onHome, published };
    setSaving(true);
    const result = item ? await api(`/gallery/${item.id}`, { method: 'PUT', body }) : await api('/gallery', { body });
    setSaving(false);
    if (result.ok) onSaved();
    else setErrors(result.fields.length ? result.fields : ['error']);
  };
  const remove = async () => {
    if (!item || !confirm(dict['common.confirmDelete'])) return;
    if ((await api(`/gallery/${item.id}`, { method: 'DELETE' })).ok) onSaved();
  };
  const bad = (f: string) => (errors.includes(f) ? 'ring-2 ring-hibiscus rounded-xl' : '');

  return (
    <Sheet title={item ? localized(item.caption, locale) : dict['gallery.new']} onClose={onClose} dict={dict}>
      <div className="grid gap-4">
        <div className="flex justify-center rounded-xl bg-mezcal py-8">
          {src ? <Polaroid item={{ kind, src, poster, caption: caption as Localized, tilt }} locale={locale} size="w-48" /> : <p className="text-cream">{dict['gallery.pick']}</p>}
        </div>
        <Field label={dict['gallery.kind']} group>
          <div className="flex gap-2">
            {(['photo', 'video'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  if (k !== kind) setSrc(null);
                  setKind(k);
                }}
                aria-pressed={kind === k}
                className={`rounded-full px-4 py-2 text-sm font-bold ${kind === k ? 'bg-ink text-cream' : 'bg-ink/10'}`}
              >
                {k === 'video' ? `🎥 ${dict['gallery.video']}` : `📷 ${dict['gallery.photo']}`}
              </button>
            ))}
          </div>
        </Field>
        <div className={bad('src')}>
          <Field label={kind === 'video' ? dict['gallery.videoFile'] : dict['gallery.photoFile']} hint={kind === 'video' ? dict['gallery.videoHint'] : dict['gallery.photoHint']} group>
            <PhotoField value={src} onChange={setSrc} dict={dict} folder="gallery" video={kind === 'video'} />
          </Field>
        </div>
        {kind === 'video' && (
          <Field label={dict['gallery.poster']} hint={dict['gallery.posterHint']} group>
            <PhotoField value={poster} onChange={setPoster} dict={dict} folder="gallery" />
          </Field>
        )}
        <div className={bad('caption')}>
          <LocalizedFields label={dict['gallery.caption']} value={caption} onChange={setCaption} dict={dict} />
        </div>
        <Field label={`${dict['gallery.tilt']}: ${tilt}°`}>
          <input type="range" min={-12} max={12} step={0.5} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} className="w-full accent-hibiscus" />
        </Field>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={onHome} onChange={(e) => setOnHome(e.target.checked)} className="size-5" />
          {dict['gallery.onHome']}
        </label>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="size-5" />
          {dict['gallery.published']}
        </label>
        {errors.length > 0 && (
          <p role="alert" className="font-semibold text-hibiscus">
            {dict['common.error']}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={save} disabled={saving || !src} className={`${button} flex-1 py-3 text-base`}>
            {saving ? dict['common.saving'] : dict['common.save']}
          </button>
          {item && (
            <button type="button" onClick={remove} className={`${ghost} text-hibiscus`}>
              {dict['common.delete']}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
