/**
 * The menu, for staff. The kitchen gets one big "86 it" switch per dish and
 * per side; managers can also open a dish to change its words, price, photo,
 * heat, fusion and tags, or add a new one.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Locale, Localized, MenuItem } from '../../domain/types';
import { localized } from '../../domain/types';
import type { AdminDictionary, AdminLocale } from '../../i18n/admin';
import { formatPrice } from '../../lib/format';
import { fromPrice } from '../../lib/menuView';
import { api, toCentavos, toPesos } from './api';
import { button, Field, ghost, field, input, LocalizedFields, PhotoField, Sheet, Toggle } from './ui';

interface Category {
  id: string;
  name: Localized;
  hidden: boolean;
}
interface Group {
  id: string;
  label: Localized;
  options: { id: string; label: Localized; price: number; soldOut: boolean }[];
}
interface MenuData {
  items: MenuItem[];
  categories: Category[];
  groups: Group[];
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function MenuAdmin({ dict, locale, canEdit }: { dict: AdminDictionary; locale: AdminLocale; canEdit: boolean }) {
  const [data, setData] = useState<MenuData>();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<MenuItem | 'new'>();
  const [problem, setProblem] = useState<string>();
  const loc = locale as Locale;

  const load = async () => {
    const result = await api<MenuData>('/menu');
    if (result.ok) setData(result.data);
  };
  useEffect(() => {
    load();
  }, []);

  /** Flip a switch at once, put it back if the server says no. */
  const flip = async (path: string, change: (d: MenuData, on: boolean) => MenuData, soldOut: boolean) => {
    setData((d) => d && change(d, soldOut));
    const result = await api(path, { method: 'PATCH', body: { soldOut } });
    if (!result.ok) {
      setData((d) => d && change(d, !soldOut));
      setProblem(dict['common.error']);
    } else setProblem(undefined);
  };
  const setItem = (id: string, soldOut: boolean) =>
    flip(`/menu/items/${id}`, (d, s) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, soldOut: s } : i)) }), soldOut);
  const setVariant = (itemId: string, variantId: string, soldOut: boolean) =>
    flip(
      `/menu/variants/${itemId}/${variantId}`,
      (d, s) => ({
        ...d,
        items: d.items.map((i) => (i.id === itemId ? { ...i, variants: i.variants?.map((v) => (v.id === variantId ? { ...v, soldOut: s } : v)) } : i)),
      }),
      soldOut,
    );
  const setOption = (groupId: string, optionId: string, soldOut: boolean) =>
    flip(
      `/menu/options/${groupId}/${optionId}`,
      (d, s) => ({
        ...d,
        groups: d.groups.map((g) => (g.id === groupId ? { ...g, options: g.options.map((o) => (o.id === optionId ? { ...o, soldOut: s } : o)) } : g)),
      }),
      soldOut,
    );

  const visible = useMemo(() => {
    if (!data) return [];
    const q = fold(query.trim());
    return data.items.filter((i) => !q || fold(Object.values(i.name).join(' ')).includes(q));
  }, [data, query]);

  if (!data) return <p>{dict['common.loading']}</p>;
  const toggleLabels: [string, string] = [dict['menu.available'], dict['menu.soldOut']];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl uppercase">{dict['menu.title']}</h1>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={dict['common.search']} className={`${input} max-w-xs`} type="search" />
        {canEdit && (
          <button type="button" className={button} onClick={() => setEditing('new')}>
            + {dict['menu.newDish']}
          </button>
        )}
      </div>
      {problem && (
        <p role="alert" className="mb-3 rounded-xl bg-hibiscus/10 p-3 font-semibold text-hibiscus">
          {problem}
        </p>
      )}

      {data.categories.map((category) => {
        const items = visible.filter((i) => i.categoryId === category.id);
        if (!items.length) return null;
        return (
          <section key={category.id} className="mb-8">
            <h2 className="mb-2 border-b-2 border-ink pb-1 font-display text-2xl uppercase">{localized(category.name, loc)}</h2>
            <ul className="divide-y divide-ink/10">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 py-2">
                  {item.photo ? <img src={item.photo} alt="" className="size-12 rounded-lg object-cover" /> : <span className="size-12 rounded-lg bg-ink/5" />}
                  <span className="min-w-40 flex-1">
                    <span className={`font-semibold ${item.soldOut ? 'line-through opacity-60' : ''}`}>{localized(item.name, loc)}</span>
                    {item.hidden && <span className="ml-2 rounded bg-ink/10 px-1 text-xs">{dict['common.hidden']}</span>}
                    <span className="block text-sm text-ink/60">{formatPrice(fromPrice(item), loc)}{item.unit === 'lb' ? ' / lb' : ''}</span>
                    {item.variants && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {item.variants.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setVariant(item.id, v.id, !v.soldOut)}
                            aria-pressed={!v.soldOut}
                            className={`rounded-full px-2 text-xs font-semibold ${v.soldOut ? 'bg-hibiscus/15 text-hibiscus line-through' : 'bg-jungle/15'}`}
                          >
                            {localized(v.label, loc)}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                  <Toggle on={!item.soldOut} onChange={(on) => setItem(item.id, !on)} labels={toggleLabels} />
                  {canEdit && (
                    <button type="button" className={ghost} onClick={() => setEditing(item)}>
                      {dict['common.edit']}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="mb-8">
        <h2 className="border-b-2 border-ink pb-1 font-display text-2xl uppercase">{dict['menu.extras']}</h2>
        <p className="mt-1 text-sm text-ink/60">{dict['menu.extrasHint']}</p>
        {data.groups.map((group) => (
          <div key={group.id} className="mt-4">
            <h3 className="font-bold">{localized(group.label, loc)}</h3>
            <ul className="mt-1 flex flex-wrap gap-2">
              {group.options.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setOption(group.id, o.id, !o.soldOut)}
                    aria-pressed={!o.soldOut}
                    className={`rounded-full px-3 py-2 text-sm font-semibold ${o.soldOut ? 'bg-hibiscus text-cream line-through' : 'bg-jungle/15'}`}
                  >
                    {localized(o.label, loc)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {editing && (
        <ItemEditor
          item={editing === 'new' ? undefined : editing}
          categories={data.categories}
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

function ItemEditor({
  item,
  categories,
  dict,
  locale,
  onClose,
  onSaved,
}: {
  item?: MenuItem;
  categories: Category[];
  dict: AdminDictionary;
  locale: Locale;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? '');
  const [name, setName] = useState<Partial<Localized>>(item?.name ?? {});
  const [description, setDescription] = useState<Partial<Localized>>(item?.description ?? {});
  const [price, setPrice] = useState(toPesos(item?.price ?? 0));
  const [unit, setUnit] = useState(item?.unit ?? 'each');
  const [heat, setHeat] = useState(item?.heat ?? 0);
  const [fusion, setFusion] = useState(item?.fusion ?? 0);
  const [tags, setTags] = useState((item?.tags ?? []).join(', '));
  const [photo, setPhoto] = useState<string | null>(item?.photo ?? null);
  const [hidden, setHidden] = useState(item?.hidden ?? false);
  const [variantPrices, setVariantPrices] = useState<Record<string, string>>(Object.fromEntries((item?.variants ?? []).map((v) => [v.id, toPesos(v.price)])));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const body = {
      categoryId,
      name,
      description: description.en?.trim() ? description : null,
      price: toCentavos(price),
      unit,
      heat,
      fusion,
      tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      photo,
      hidden,
    };
    setSaving(true);
    const result = item ? await api(`/menu/items/${item.id}`, { method: 'PATCH', body }) : await api('/menu/items', { body });
    let ok = result.ok;
    if (result.ok && item?.variants) {
      for (const v of item.variants) {
        const cents = toCentavos(variantPrices[v.id] ?? '');
        if (cents !== undefined && cents !== v.price) ok = (await api(`/menu/variants/${item.id}/${v.id}`, { method: 'PATCH', body: { price: cents } })).ok && ok;
      }
    }
    setSaving(false);
    if (ok) onSaved();
    else setErrors(result.ok ? ['variants'] : result.fields.length ? result.fields : ['error']);
  };

  const bad = (f: string) => (errors.includes(f) ? 'ring-2 ring-hibiscus rounded-xl' : '');
  return (
    <Sheet title={item ? localized(item.name, locale) : dict['menu.newDish']} onClose={onClose} dict={dict}>
      <div className="grid gap-4">
        <Field label={dict['menu.category']}>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {localized(c.name, locale)}
              </option>
            ))}
          </select>
        </Field>
        <div className={bad('name')}>
          <LocalizedFields label={dict['menu.name']} value={name} onChange={setName} dict={dict} />
        </div>
        <div className={bad('description')}>
          <LocalizedFields label={dict['menu.description']} value={description} onChange={setDescription} dict={dict} multiline />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={dict['menu.price']}>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={`${input} ${bad('price')}`} />
          </Field>
          <Field label={dict['menu.unit']}>
            <select value={unit} onChange={(e) => setUnit(e.target.value as 'each' | 'lb')} className={input}>
              <option value="each">{dict['menu.unit.each']}</option>
              <option value="lb">{dict['menu.unit.lb']}</option>
            </select>
          </Field>
        </div>
        {item?.variants && (
          <fieldset className="rounded-xl border-2 border-ink/10 p-3">
            <legend className="px-1 text-sm font-bold">{dict['menu.variants']}</legend>
            {item.variants.map((v) => (
              <label key={v.id} className="flex items-center gap-2 py-1">
                <span className="flex-1">{localized(v.label, locale)}</span>
                <input
                  value={variantPrices[v.id] ?? ''}
                  onChange={(e) => setVariantPrices((p) => ({ ...p, [v.id]: e.target.value }))}
                  inputMode="decimal"
                  className={`${field} w-28`}
                />
              </label>
            ))}
          </fieldset>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${dict['menu.heat']}: ${'🌶'.repeat(heat) || '0'}`}>
            <input type="range" min={0} max={5} value={heat} onChange={(e) => setHeat(Number(e.target.value))} className="w-full accent-hibiscus" />
          </Field>
          <Field label={`${dict['menu.fusion']}: ${fusion}`}>
            <input type="range" min={-2} max={2} value={fusion} onChange={(e) => setFusion(Number(e.target.value))} className="w-full accent-jungle" />
          </Field>
        </div>
        <Field label={dict['menu.tags']}>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className={`${input} ${bad('tags')}`} />
        </Field>
        <Field label={dict['menu.photo']} group>
          <PhotoField value={photo} onChange={setPhoto} dict={dict} />
        </Field>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="size-5" />
          {dict['menu.hideFromGuests']}
        </label>
        {errors.length > 0 && (
          <p role="alert" className="font-semibold text-hibiscus">
            {dict['common.error']}
          </p>
        )}
        <button type="button" onClick={save} disabled={saving} className={`${button} py-3 text-base`}>
          {saving ? dict['common.saving'] : dict['common.save']}
        </button>
      </div>
    </Sheet>
  );
}
