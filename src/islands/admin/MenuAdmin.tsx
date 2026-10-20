/**
 * The menu, for staff. The kitchen gets one big "86 it" switch per dish and
 * per side; managers can also open a dish to change its words, price, sizes,
 * extras, photo, heat, fusion and tags, add or delete dishes, run the menu's
 * sections and edit the shared extras (sides, sauces, add-ons).
 */
import { useEffect, useMemo, useState } from 'react';
import type { Locale, Localized, MenuItem } from '../../domain/types';
import { localized } from '../../domain/types';
import { fillAdmin, type AdminDictionary, type AdminLocale } from '../../i18n/admin';
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
  min: number;
  max: number;
  options: { id: string; label: Localized; price: number; soldOut: boolean }[];
}
/** A size or option being edited: English and Spanish typed here, French and German kept. */
interface Choice {
  id?: string;
  label: Partial<Localized>;
  price: string;
}
const toChoice = (c: { id: string; label: Localized; price: number }): Choice => ({ id: c.id, label: c.label, price: toPesos(c.price) });
const fromChoices = (list: Choice[]) =>
  list
    .filter((c) => c.label.en?.trim())
    .map((c) => ({ ...(c.id ? { id: c.id } : {}), label: c.label, price: toCentavos(c.price) ?? -1 }));
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
  const [editingGroup, setEditingGroup] = useState<Group | 'new'>();
  const [sections, setSections] = useState(false);
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

  /** Swap a dish with its neighbour in the same section, and save the whole order. */
  const moveItem = async (item: MenuItem, by: number) => {
    if (!data) return;
    const siblings = data.items.filter((i) => i.categoryId === item.categoryId);
    const other = siblings[siblings.indexOf(item) + by];
    if (!other) return;
    const items = [...data.items];
    const a = items.indexOf(item);
    const b = items.indexOf(other);
    [items[a], items[b]] = [items[b]!, items[a]!];
    setData({ ...data, items });
    const result = await api('/menu/items', { method: 'PUT', body: { ids: items.map((i) => i.id) } });
    setProblem(result.ok ? undefined : dict['common.error']);
  };

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
          <>
            <button type="button" className={button} onClick={() => setEditing('new')}>
              + {dict['menu.newDish']}
            </button>
            <button type="button" className={ghost} onClick={() => setSections(true)}>
              {dict['menu.sections']}
            </button>
          </>
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
            <h2 className="mb-2 border-b-2 border-ink pb-1 font-display text-2xl uppercase">
              {localized(category.name, loc)}
              {category.hidden && <span className="ml-2 rounded bg-ink/10 px-1 align-middle font-sans text-xs normal-case">{dict['common.hidden']}</span>}
            </h2>
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
                  {canEdit && !query && (
                    <span className="flex gap-1">
                      <button type="button" className={ghost} disabled={item === items[0]} onClick={() => moveItem(item, -1)} aria-label={dict['common.up']}>
                        ↑
                      </button>
                      <button type="button" className={ghost} disabled={item === items[items.length - 1]} onClick={() => moveItem(item, 1)} aria-label={dict['common.down']}>
                        ↓
                      </button>
                    </span>
                  )}
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
        {canEdit && (
          <button type="button" className={`${ghost} mt-3`} onClick={() => setEditingGroup('new')}>
            + {dict['menu.newGroup']}
          </button>
        )}
        {data.groups.map((group) => (
          <div key={group.id} className="mt-4">
            <h3 className="flex flex-wrap items-center gap-2 font-bold">
              {localized(group.label, loc)}
              <span className="text-xs font-normal text-ink/60">
                {fillAdmin(dict, 'menu.groupRule', { min: group.min, max: group.max })} · {data.items.filter((i) => i.modifierGroups?.some((g) => g.id === group.id)).length}{' '}
                {dict['menu.groupDishes']}
              </span>
              {canEdit && (
                <button type="button" className={`${ghost} py-0.5 text-xs`} onClick={() => setEditingGroup(group)}>
                  {dict['common.edit']}
                </button>
              )}
            </h3>
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
                    {o.price > 0 && <span className="ml-1 font-normal opacity-70">+{formatPrice(o.price, loc)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {sections && <SectionsEditor categories={data.categories} items={data.items} dict={dict} locale={loc} onClose={() => setSections(false)} onChanged={load} />}
      {editingGroup && (
        <GroupEditor
          group={editingGroup === 'new' ? undefined : editingGroup}
          dict={dict}
          locale={loc}
          onClose={() => setEditingGroup(undefined)}
          onSaved={async () => {
            setEditingGroup(undefined);
            await load();
          }}
        />
      )}
      {editing && (
        <ItemEditor
          item={editing === 'new' ? undefined : editing}
          categories={data.categories}
          groups={data.groups}
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
  groups,
  dict,
  locale,
  onClose,
  onSaved,
}: {
  item?: MenuItem;
  categories: Category[];
  groups: Group[];
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
  const [variants, setVariants] = useState<Choice[]>((item?.variants ?? []).map(toChoice));
  const [extras, setExtras] = useState<string[]>((item?.modifierGroups ?? []).map((g) => g.id));
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
      groups: extras,
    };
    setSaving(true);
    const result = item ? await api(`/menu/items/${item.id}`, { method: 'PATCH', body }) : await api<{ id: string }>('/menu/items', { body });
    let ok = result.ok;
    const id = item?.id ?? (result.ok ? (result.data as { id: string }).id : undefined);
    const sizesChanged = JSON.stringify(variants) !== JSON.stringify((item?.variants ?? []).map(toChoice));
    if (ok && id && sizesChanged) ok = (await api(`/menu/items/${id}/variants`, { method: 'PUT', body: { variants: fromChoices(variants) } })).ok;
    setSaving(false);
    if (ok) onSaved();
    else setErrors(result.ok ? ['variants'] : result.fields.length ? result.fields : ['error']);
  };
  const remove = async () => {
    if (!item || !confirm(dict['common.confirmDelete'])) return;
    if ((await api(`/menu/items/${item.id}`, { method: 'DELETE' })).ok) onSaved();
    else setErrors(['error']);
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
        <div className={bad('variants')}>
          <ChoicesField label={dict['menu.variants']} hint={dict['menu.variantsHint']} value={variants} onChange={setVariants} dict={dict} />
        </div>
        {groups.length > 0 && (
          <fieldset className="rounded-xl border-2 border-ink/10 p-3">
            <legend className="px-1 text-sm font-bold">{dict['menu.extrasFor']}</legend>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => {
                const on = extras.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setExtras((list) => (on ? list.filter((x) => x !== g.id) : [...list, g.id]))}
                    className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${on ? 'border-ink bg-ink text-cream' : 'border-ink/20'}`}
                  >
                    {localized(g.label, locale)}
                  </button>
                );
              })}
            </div>
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
        <div className="flex gap-3">
          <button type="button" onClick={save} disabled={saving} className={`${button} flex-1 py-3 text-base`}>
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

/** A list of sizes or options: name in English and Spanish, and a price. */
function ChoicesField({ label, hint, value, onChange, dict }: { label: string; hint?: string; value: Choice[]; onChange: (v: Choice[]) => void; dict: AdminDictionary }) {
  const set = (i: number, patch: Partial<Choice>) => onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <fieldset className="rounded-xl border-2 border-ink/10 p-3">
      <legend className="px-1 text-sm font-bold">{label}</legend>
      {hint && <p className="mb-2 text-xs text-ink/60">{hint}</p>}
      {value.length > 0 && (
        <div className="mb-1 grid grid-cols-[1fr_1fr_6rem_auto] gap-2 text-xs font-bold text-ink/60 uppercase">
          <span>EN</span>
          <span>ES</span>
          <span>RD$</span>
          <span />
        </div>
      )}
      {value.map((c, i) => (
        <div key={c.id ?? `new-${i}`} className="grid grid-cols-[1fr_1fr_6rem_auto] items-center gap-2 py-1">
          <input value={c.label.en ?? ''} onChange={(e) => set(i, { label: { ...c.label, en: e.target.value } })} className={`${field} min-w-0`} lang="en" />
          <input value={c.label.es ?? ''} onChange={(e) => set(i, { label: { ...c.label, es: e.target.value } })} className={`${field} min-w-0`} lang="es" />
          <input value={c.price} onChange={(e) => set(i, { price: e.target.value })} inputMode="decimal" className={`${field} min-w-0`} />
          <button type="button" className={`${ghost} text-hibiscus`} onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={dict['common.remove']}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className={`${ghost} mt-2`} onClick={() => onChange([...value, { label: {}, price: '' }])}>
        + {dict['common.add']}
      </button>
    </fieldset>
  );
}

/** An extras group shared by many dishes: its name, how many to pick, and its options. */
function GroupEditor({ group, dict, locale, onClose, onSaved }: { group?: Group; dict: AdminDictionary; locale: Locale; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState<Partial<Localized>>(group?.label ?? {});
  const [min, setMin] = useState(group?.min ?? 0);
  const [max, setMax] = useState(group?.max ?? 1);
  const [options, setOptions] = useState<Choice[]>((group?.options ?? []).map(toChoice));
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const body = { label, min, max, options: fromChoices(options) };
    const result = group ? await api(`/menu/groups/${group.id}`, { method: 'PUT', body }) : await api('/menu/groups', { body });
    setSaving(false);
    if (result.ok) onSaved();
    else setError(true);
  };
  const remove = async () => {
    if (!group || !confirm(dict['common.confirmDelete'])) return;
    if ((await api(`/menu/groups/${group.id}`, { method: 'DELETE' })).ok) onSaved();
    else setError(true);
  };
  return (
    <Sheet title={group ? localized(group.label, locale) : dict['menu.newGroup']} onClose={onClose} dict={dict}>
      <div className="grid gap-4">
        <LocalizedFields label={dict['menu.groupName']} value={label} onChange={setLabel} dict={dict} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={dict['menu.groupMin']} hint={dict['menu.groupMinHint']}>
            <input type="number" min={0} max={10} value={min} onChange={(e) => setMin(Number(e.target.value))} className={input} />
          </Field>
          <Field label={dict['menu.groupMax']}>
            <input type="number" min={1} max={20} value={max} onChange={(e) => setMax(Number(e.target.value))} className={input} />
          </Field>
        </div>
        <ChoicesField label={dict['menu.groupOptions']} hint={dict['menu.groupOptionsHint']} value={options} onChange={setOptions} dict={dict} />
        {error && (
          <p role="alert" className="font-semibold text-hibiscus">
            {dict['common.error']}
          </p>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={save} disabled={saving} className={`${button} flex-1 py-3 text-base`}>
            {saving ? dict['common.saving'] : dict['common.save']}
          </button>
          {group && (
            <button type="button" onClick={remove} className={`${ghost} text-hibiscus`}>
              {dict['common.delete']}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** The menu's sections: rename, hide, reorder, add, and delete the empty ones. */
function SectionsEditor({
  categories,
  items,
  dict,
  locale,
  onClose,
  onChanged,
}: {
  categories: Category[];
  items: MenuItem[];
  dict: AdminDictionary;
  locale: Locale;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [list, setList] = useState(categories);
  const [editing, setEditing] = useState<Category | 'new'>();
  const [name, setName] = useState<Partial<Localized>>({});
  const [hidden, setHidden] = useState(false);
  const [problem, setProblem] = useState<string>();
  useEffect(() => setList(categories), [categories]);

  const open = (c: Category | 'new') => {
    setEditing(c);
    setName(c === 'new' ? {} : c.name);
    setHidden(c === 'new' ? false : c.hidden);
    setProblem(undefined);
  };
  const save = async () => {
    if (!editing) return;
    const result = editing === 'new' ? await api('/menu/categories', { body: { name, hidden } }) : await api(`/menu/categories/${editing.id}`, { method: 'PUT', body: { name, hidden } });
    if (!result.ok) return setProblem(dict['common.error']);
    setEditing(undefined);
    await onChanged();
  };
  const remove = async (c: Category) => {
    if (!confirm(dict['common.confirmDelete'])) return;
    const result = await api(`/menu/categories/${c.id}`, { method: 'DELETE' });
    if (!result.ok) return setProblem(result.error === 'not_empty' ? dict['menu.sectionNotEmpty'] : dict['common.error']);
    await onChanged();
  };
  const move = async (index: number, by: number) => {
    const next = [...list];
    const [it] = next.splice(index, 1);
    next.splice(index + by, 0, it!);
    setList(next);
    if ((await api('/menu/categories', { method: 'PUT', body: { ids: next.map((c) => c.id) } })).ok) await onChanged();
  };

  return (
    <Sheet title={dict['menu.sections']} onClose={onClose} dict={dict}>
      <ul className="divide-y divide-ink/10 rounded-xl bg-white">
        {list.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 p-2">
            <span className="min-w-32 flex-1 font-semibold">
              {localized(c.name, locale)}
              {c.hidden && <span className="ml-2 rounded bg-ink/10 px-1 text-xs">{dict['common.hidden']}</span>}
              <span className="block text-xs font-normal text-ink/60">
                {items.filter((it) => it.categoryId === c.id).length} {dict['menu.groupDishes']}
              </span>
            </span>
            <button type="button" className={ghost} disabled={i === 0} onClick={() => move(i, -1)} aria-label={dict['common.up']}>
              ↑
            </button>
            <button type="button" className={ghost} disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={dict['common.down']}>
              ↓
            </button>
            <button type="button" className={ghost} onClick={() => open(c)}>
              {dict['common.edit']}
            </button>
            <button type="button" className={`${ghost} text-hibiscus`} onClick={() => remove(c)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={`${ghost} mt-3`} onClick={() => open('new')}>
        + {dict['menu.newSection']}
      </button>
      {editing && (
        <div className="mt-4 grid gap-3 rounded-xl border-2 border-ink/10 p-3">
          <LocalizedFields label={dict['menu.sectionName']} value={name} onChange={setName} dict={dict} />
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="size-5" />
            {dict['menu.hideFromGuests']}
          </label>
          <p className="flex gap-2">
            <button type="button" className={button} onClick={save}>
              {dict['common.save']}
            </button>
            <button type="button" className={ghost} onClick={() => setEditing(undefined)}>
              {dict['common.cancel']}
            </button>
          </p>
        </div>
      )}
      {problem && (
        <p role="alert" className="mt-3 font-semibold text-hibiscus">
          {problem}
        </p>
      )}
    </Sheet>
  );
}
