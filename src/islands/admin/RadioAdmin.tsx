/**
 * The Radio script, for staff: questions, answers and where each leads, what
 * each answer does to the plate, the recorded voices, and the music bed.
 * The server refuses a script that would strand a guest.
 */
import { useEffect, useState } from 'react';
import type { RadioNode, RadioOption } from '../../domain/radioTree';
import { DIETS, HEATS, HUNGERS, LEANINGS } from '../../domain/selector';
import type { Locale, Localized } from '../../domain/types';
import { localized } from '../../domain/types';
import { fillAdmin, type AdminDictionary, type AdminKey, type AdminLocale } from '../../i18n/admin';
import { api, toCentavos, toPesos } from './api';
import { button, field, ghost, input, LocalizedFields, Sheet } from './ui';

type Voices = Record<'en' | 'es' | 'fr' | 'de', 'current' | 'stale' | 'none'>;
interface Data {
  nodes: (RadioNode & { voices: Voices })[];
  counts: Record<string, Record<string, number>>;
  problems: string[];
  bed: string | null;
}

const VOICE_STYLE = { current: 'bg-jungle text-cream', stale: 'bg-sunset text-cream', none: 'bg-ink/10' };

export default function RadioAdmin({ dict, locale }: { dict: AdminDictionary; locale: AdminLocale }) {
  const [data, setData] = useState<Data>();
  const [nodes, setNodes] = useState<RadioNode[]>([]);
  const [editing, setEditing] = useState<string>();
  const [problems, setProblems] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [rendering, setRendering] = useState<string>();
  const loc = locale as Locale;
  const a = (key: AdminKey, vars?: Record<string, string | number>) => fillAdmin(dict, key, vars);

  const load = async () => {
    const result = await api<Data>('/radio');
    if (result.ok) {
      setData(result.data);
      setNodes(result.data.nodes.map(({ voices: _v, ...n }) => n));
      setProblems(result.data.problems);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (next = nodes) => {
    setStatus('saving');
    const result = await api('/radio', { method: 'PUT', body: { nodes: next } });
    if (result.ok) {
      setStatus('saved');
      await load();
    } else {
      setStatus('error');
      setProblems((result.body.problems as string[] | undefined) ?? []);
    }
  };
  const render = async (id: string) => {
    setRendering(id);
    await api(`/radio/${id}/voice`, { body: {} });
    setRendering(undefined);
    load();
  };
  const setBed = async (bed: string | null) => {
    await api('/settings/radio', { method: 'PUT', body: { value: { bed } } });
    load();
  };
  const uploadBed = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    form.set('folder', 'radio');
    const result = await api<{ path: string }>('/upload', { form });
    if (result.ok) setBed(result.data.path);
  };

  if (!data) return <p>{dict['common.loading']}</p>;
  const current = nodes.find((n) => n.id === editing);
  return (
    <div>
      <h1 className="font-display text-3xl uppercase">{dict['radio.title']}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">{dict['radio.intro']}</p>
      {problems.length > 0 && (
        <div role="alert" className="mt-4 rounded-xl bg-hibiscus/10 p-3 text-hibiscus">
          <p className="font-bold">{dict['radio.problems']}</p>
          <ul className="list-disc pl-5 text-sm">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <ol className="mt-6 space-y-3">
        {nodes.map((n) => {
          const voices = data.nodes.find((x) => x.id === n.id)?.voices;
          return (
            <li key={n.id} className="rounded-xl bg-white p-3">
              <div className="flex flex-wrap items-start gap-3">
                <span className="min-w-56 flex-1">
                  <code className="text-xs text-ink/60">{n.id}</code>
                  <span className="block font-bold">{localized(n.prompt, loc)}</span>
                  <span className="mt-1 flex flex-wrap gap-1 text-xs">
                    {n.options.map((o) => (
                      <span key={o.id} className="rounded-full bg-ink/5 px-2 py-0.5">
                        {localized(o.label, loc)} → {o.next ?? '🍽'} {data.counts[n.id]?.[o.id] ? `· ${a('radio.chosen', { n: data.counts[n.id]![o.id]! })}` : ''}
                      </span>
                    ))}
                  </span>
                </span>
                <button type="button" className={ghost} onClick={() => setEditing(n.id)}>
                  {dict['common.edit']}
                </button>
              </div>
              {voices && (
                <p className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                  <span className="font-semibold">{dict['radio.voices']}:</span>
                  {(Object.keys(voices) as (keyof Voices)[]).map((l) => (
                    <span key={l} className={`rounded-full px-2 py-0.5 font-bold ${VOICE_STYLE[voices[l]]}`}>
                      {l.toUpperCase()} {dict[`radio.voice.${voices[l]}`]}
                    </span>
                  ))}
                  <button type="button" className={`${ghost} ml-2 text-xs`} onClick={() => render(n.id)} disabled={rendering === n.id}>
                    {rendering === n.id ? dict['radio.rendering'] : dict['radio.render']}
                  </button>
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-ink/60">{dict['radio.renderHint']}</p>

      <p className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={ghost}
          onClick={() => {
            const id = `q${nodes.length + 1}`;
            setNodes([...nodes, { id, prompt: { en: '' }, options: [{ id: 'a', label: { en: '' }, traits: {} }] }]);
            setEditing(id);
          }}
        >
          + {dict['radio.addQuestion']}
        </button>
        <button type="button" className={button} onClick={() => save()} disabled={status === 'saving'}>
          {status === 'saving' ? dict['common.saving'] : dict['radio.saveScript']}
        </button>
        {status === 'saved' && <span className="font-semibold text-jungle">✓ {dict['common.saved']}</span>}
        {status === 'error' && <span className="font-semibold text-hibiscus">{dict['common.error']}</span>}
      </p>

      <section className="mt-10 rounded-xl bg-white p-4">
        <h2 className="font-display text-2xl uppercase">{dict['radio.bed']}</h2>
        <p className="mt-1 text-sm text-ink/70">{dict['radio.bedHint']}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {data.bed ? <audio controls src={data.bed} className="h-10" /> : <span className="font-semibold">🎛 {dict['radio.bedBuiltIn']}</span>}
          <label className={`${ghost} cursor-pointer`}>
            {dict['radio.bedUpload']}
            <input type="file" accept="audio/mpeg" className="sr-only" onChange={(e) => uploadBed(e.target.files?.[0])} />
          </label>
          {data.bed && (
            <button type="button" className={ghost} onClick={() => setBed(null)}>
              {dict['common.remove']}
            </button>
          )}
        </div>
      </section>

      {current && (
        <QuestionEditor
          key={current.id}
          node={current}
          all={nodes}
          dict={dict}
          locale={loc}
          onClose={() => setEditing(undefined)}
          onDelete={() => {
            const next = nodes.filter((n) => n.id !== current.id);
            setNodes(next);
            setEditing(undefined);
          }}
          onDone={(node) => {
            const next = nodes.map((n) => (n.id === current.id ? node : n));
            setNodes(next);
            setEditing(undefined);
            save(next);
          }}
        />
      )}
    </div>
  );
}

function QuestionEditor({
  node,
  all,
  dict,
  locale,
  onClose,
  onDelete,
  onDone,
}: {
  node: RadioNode;
  all: RadioNode[];
  dict: AdminDictionary;
  locale: Locale;
  onClose: () => void;
  onDelete: () => void;
  onDone: (node: RadioNode) => void;
}) {
  const [n, setN] = useState(node);
  const setOption = (i: number, o: RadioOption) => setN({ ...n, options: n.options.map((x, j) => (j === i ? o : x)) });
  const select = <T extends string>(label: string, list: readonly T[], value: T | undefined, onPick: (v: T | undefined) => void) => (
    <label className="text-xs">
      <span className="block font-semibold">{label}</span>
      <select value={value ?? ''} onChange={(e) => onPick((e.target.value || undefined) as T | undefined)} className={`${field} w-full py-1`}>
        <option value="">{dict['radio.trait.any']}</option>
        {list.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Sheet title={`${dict['radio.question']} · ${n.id}`} onClose={onClose} dict={dict}>
      <div className="grid gap-4">
        <LocalizedFields label={dict['radio.question']} value={n.prompt} onChange={(prompt) => setN({ ...n, prompt: prompt as Localized })} dict={dict} multiline />
        <h3 className="font-display text-xl uppercase">{dict['radio.answers']}</h3>
        {n.options.map((o, i) => (
          <div key={i} className="grid gap-2 rounded-xl border-2 border-ink/10 bg-white p-3">
            <div className="flex items-center gap-2">
              <input value={o.id} onChange={(e) => setOption(i, { ...o, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} className={`${field} w-28 font-mono text-sm`} aria-label="id" />
              <span className="flex-1" />
              <button type="button" className={`${ghost} text-hibiscus`} onClick={() => setN({ ...n, options: n.options.filter((_, j) => j !== i) })} disabled={n.options.length <= 1}>
                {dict['common.remove']}
              </button>
            </div>
            <LocalizedFields label={dict['radio.answer']} value={o.label} onChange={(label) => setOption(i, { ...o, label: label as Localized })} dict={dict} />
            <label className="text-sm font-semibold">
              {dict['radio.next']}
              <select value={o.next ?? ''} onChange={(e) => setOption(i, { ...o, next: e.target.value || undefined })} className={`${input} mt-1`}>
                <option value="">{dict['radio.end']}</option>
                {all
                  .filter((x) => x.id !== n.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.id} — {localized(x.prompt, locale).slice(0, 50)}
                    </option>
                  ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {select('hunger', HUNGERS, o.traits.hunger, (hunger) => setOption(i, { ...o, traits: { ...o.traits, hunger } }))}
              {select('heat', HEATS, o.traits.heat, (heat) => setOption(i, { ...o, traits: { ...o.traits, heat } }))}
              {select('leaning', LEANINGS, o.traits.leaning, (leaning) => setOption(i, { ...o, traits: { ...o.traits, leaning } }))}
              {select('diet', DIETS, o.traits.diet?.[0], (d) => setOption(i, { ...o, traits: { ...o.traits, diet: d ? [d] : undefined } }))}
              <label className="text-xs">
                <span className="block font-semibold">{dict['radio.trait.party']}</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={o.traits.party ?? ''}
                  onChange={(e) => setOption(i, { ...o, traits: { ...o.traits, party: e.target.value ? Number(e.target.value) : undefined } })}
                  className={`${field} w-full py-1`}
                />
              </label>
              <label className="text-xs">
                <span className="block font-semibold">{dict['radio.trait.budget']}</span>
                <input
                  inputMode="decimal"
                  value={toPesos(o.traits.budget)}
                  onChange={(e) => setOption(i, { ...o, traits: { ...o.traits, budget: toCentavos(e.target.value) || undefined } })}
                  className={`${field} w-full py-1`}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!o.traits.firstTime} onChange={(e) => setOption(i, { ...o, traits: { ...o.traits, firstTime: e.target.checked || undefined } })} />
              {dict['radio.trait.firstTime']}
            </label>
          </div>
        ))}
        <button
          type="button"
          className={`${ghost} justify-self-start`}
          onClick={() => setN({ ...n, options: [...n.options, { id: `a${n.options.length + 1}`, label: { en: '' }, traits: {} }] })}
          disabled={n.options.length >= 6}
        >
          + {dict['radio.addAnswer']}
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={() => onDone(n)} className={`${button} flex-1 py-3 text-base`}>
            {dict['common.save']}
          </button>
          {n.id !== 'start' && (
            <button type="button" onClick={() => confirm(dict['common.confirmDelete']) && onDelete()} className={`${ghost} text-hibiscus`}>
              {dict['common.delete']}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
