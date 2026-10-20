/** Small building blocks shared by the staff islands. */
import { useState, type ReactNode } from 'react';
import type { Localized } from '../../domain/types';
import type { AdminDictionary } from '../../i18n/admin';
import { api } from './api';

/** A text box at its natural width; `input` fills the row. */
export const field = 'rounded-lg border-2 border-ink/15 bg-white px-3 py-2';
export const input = `${field} w-full`;
export const button = 'rounded-full bg-ink px-4 py-2 text-sm font-bold text-cream disabled:opacity-40';
export const ghost = 'rounded-full border-2 border-ink/20 px-3 py-1.5 text-sm font-semibold disabled:opacity-40';

/** A labelled control. `group` is for several controls under one heading (no wrapping label). */
export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: string; group?: boolean }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink/60">{hint}</span>}
    </Tag>
  );
}

/** A big, thumb-sized on/off switch. `on` is the "good" state (available, active). */
export function Toggle({ on, onChange, labels, disabled }: { on: boolean; onChange: (on: boolean) => void; labels: [string, string]; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`min-w-28 shrink-0 rounded-full px-3 py-2 text-sm font-bold ${on ? 'bg-jungle text-cream' : 'bg-hibiscus text-cream'} disabled:opacity-50`}
    >
      {on ? labels[0] : labels[1]}
    </button>
  );
}

const LANGS = [
  ['en', 'English'],
  ['es', 'Español'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
] as const;

/** One text in the four guest languages, with machine drafts for the other three. */
export function LocalizedFields({
  label,
  value,
  onChange,
  dict,
  multiline,
}: {
  label: string;
  value: Partial<Localized>;
  onChange: (value: Partial<Localized>) => void;
  dict: AdminDictionary;
  multiline?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(false);
  const draft = async () => {
    if (!value.en?.trim()) return;
    setBusy(true);
    const result = await api<{ es: string; fr: string; de: string }>('/translate', { body: { text: value.en } });
    setBusy(false);
    if (result.ok) {
      onChange({ ...value, ...result.data });
      setHint(true);
    }
  };
  return (
    <fieldset className="rounded-xl border-2 border-ink/10 p-3">
      <legend className="px-1 text-sm font-bold">{label}</legend>
      <div className="grid gap-2">
        {LANGS.map(([code, name]) => (
          <label key={code} className="flex items-start gap-2">
            <span className="w-8 pt-2 text-xs font-bold uppercase text-ink/60" title={name}>
              {code}
            </span>
            {multiline ? (
              <textarea rows={2} value={value[code] ?? ''} onChange={(e) => onChange({ ...value, [code]: e.target.value })} className={input} lang={code} />
            ) : (
              <input value={value[code] ?? ''} onChange={(e) => onChange({ ...value, [code]: e.target.value })} className={input} lang={code} />
            )}
          </label>
        ))}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={ghost} onClick={draft} disabled={busy || !value.en?.trim()}>
          {busy ? dict['common.translating'] : dict['common.translate']}
        </button>
        {hint && <span className="text-xs text-ink/60">{dict['common.translateHint']}</span>}
      </p>
    </fieldset>
  );
}

/** A photo (or, with `video`, a short mp4) from R2: preview, replace, remove. */
export function PhotoField({
  value,
  onChange,
  dict,
  folder = 'menu',
  video = false,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
  dict: AdminDictionary;
  folder?: string;
  video?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    form.set('folder', folder);
    setBusy(true);
    const result = await api<{ path: string }>('/upload', { form });
    setBusy(false);
    setError(result.ok ? undefined : uploadError(result.error, dict));
    if (result.ok) onChange(result.data.path);
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      {value && video ? (
        <video src={value} muted loop autoPlay playsInline className="size-20 rounded-lg object-cover" />
      ) : value ? (
        <img src={value} alt="" className="size-20 rounded-lg object-cover" />
      ) : (
        <span className="size-20 rounded-lg bg-ink/10" />
      )}
      <label className={`${ghost} cursor-pointer`}>
        {busy ? dict['common.saving'] : dict[video ? 'common.uploadVideo' : 'common.upload']}
        <input
          type="file"
          accept={video ? 'video/mp4' : 'image/jpeg,image/png,image/webp,image/avif'}
          className="sr-only"
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </label>
      {value && (
        <button type="button" className={ghost} onClick={() => onChange(null)}>
          {dict['common.remove']}
        </button>
      )}
      {error && (
        <p role="alert" className="basis-full text-sm font-semibold text-hibiscus">
          {error}
        </p>
      )}
    </div>
  );
}

/** Why an upload to /api/admin/upload was refused, for staff. */
export const uploadError = (error: string, dict: AdminDictionary) => dict[error === 'storage_full' ? 'common.storageFull' : 'common.uploadFailed'];

/** A modal sheet for editing one thing. */
export function Sheet({ title, onClose, children, dict }: { title: string; onClose: () => void; children: ReactNode; dict: AdminDictionary }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-cream p-4 md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl uppercase">{title}</h2>
          <button type="button" className={ghost} onClick={onClose}>
            {dict['common.close']}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
