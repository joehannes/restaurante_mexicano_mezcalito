/**
 * WhatsApp: the restaurant's number already works on the site (every
 * WhatsApp button opens a chat with it). Automatic updates to guests need
 * Meta to approve each message once, so this page walks staff through it:
 * the account and email to use, where to submit, and every template ready to
 * copy in four languages. Staff tick each language as Meta approves it; only
 * ticked ones are ever sent.
 */
import { useState } from 'react';
import type { Locale } from '../../domain/types';
import { META_LANGUAGE, TEMPLATE_LANGUAGES, WHATSAPP_TEMPLATES, type TemplateName, type WhatsAppSettings } from '../../domain/whatsappTemplates';
import { fillAdmin, type AdminDictionary, type AdminLocale } from '../../i18n/admin';
import { api } from './api';
import { ghost } from './ui';

const LINKS = {
  business: 'https://business.facebook.com/',
  apps: 'https://developers.facebook.com/apps/',
  templates: 'https://business.facebook.com/wa/manage/message-templates/',
  help: 'https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/',
};

/** A value with a one-tap copy button. */
function Copy({ text, dict, block = false }: { text: string; dict: AdminDictionary; block?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard access (an old browser, or not https): show it selected to copy by hand.
      window.prompt(dict['wa.copy'], text);
      return;
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <span className={block ? 'flex items-start gap-2' : 'inline-flex flex-wrap items-center gap-2'}>
      <code className={`rounded-lg bg-ink/5 px-2 py-1 text-sm ${block ? 'flex-1 whitespace-pre-wrap' : ''}`}>{text}</code>
      <button type="button" className={`${ghost} shrink-0`} onClick={copy}>
        {done ? `✓ ${dict['wa.copied']}` : dict['wa.copy']}
      </button>
    </span>
  );
}

export default function WhatsAppAdmin({
  dict,
  locale,
  number,
  email,
  siteUrl,
  configured,
  initial,
}: {
  dict: AdminDictionary;
  locale: AdminLocale;
  number: string;
  email: string;
  siteUrl: string;
  configured: boolean;
  initial: WhatsAppSettings;
}) {
  const [approved, setApproved] = useState(initial.approved);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const a = (key: Parameters<typeof fillAdmin>[1], vars?: Record<string, string | number>) => fillAdmin(dict, key, vars);

  const toggle = async (name: TemplateName, lang: Locale, on: boolean) => {
    const current = approved[name] ?? [];
    const next = { ...approved, [name]: on ? [...current, lang] : current.filter((l) => l !== lang) };
    setApproved(next);
    setStatus('saving');
    const result = await api('/settings/whatsapp', { method: 'PUT', body: { value: { approved: next } } });
    setStatus(result.ok ? 'saved' : 'error');
    if (!result.ok) setApproved(approved);
  };
  const sample = (value: string) => (value.startsWith('https://') ? `${siteUrl}/en/o/MZ-4821` : value);
  const link = (href: string, text: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
      {text} ↗
    </a>
  );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl uppercase">{dict['wa.title']}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/70">{a('wa.intro', { number })}</p>
      </div>

      <section className="grid gap-3 rounded-2xl bg-white p-4">
        <p className="flex flex-wrap items-center gap-2">
          <span className="w-40 font-semibold">{dict['wa.number']}</span>
          <Copy text={number} dict={dict} />
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span className="w-40 font-semibold">{dict['wa.email']}</span>
          <Copy text={email} dict={dict} />
        </p>
        <p className="text-sm text-ink/70">{dict['wa.emailHint']}</p>
        <p className={`rounded-xl p-3 text-sm font-semibold ${configured ? 'bg-jungle/10 text-jungle' : 'bg-sunset/10 text-ink'}`}>
          {configured ? `✓ ${dict['wa.on']}` : dict['wa.off']}
        </p>
      </section>

      <section className="rounded-2xl bg-white p-4">
        <h2 className="font-display text-2xl uppercase">{dict['wa.whyTitle']}</h2>
        <p className="mt-2 text-sm">{dict['wa.why']}</p>
        <h2 className="mt-5 font-display text-2xl uppercase">{dict['wa.stepsTitle']}</h2>
        <ol className="mt-2 grid list-decimal gap-3 pl-5 text-sm">
          <li>
            {a('wa.step1', { email })} {link(LINKS.business, 'business.facebook.com')}
          </li>
          <li>
            {a('wa.step2', { number })} {link(LINKS.apps, 'developers.facebook.com/apps')}
          </li>
          <li>
            {dict['wa.step3']} {link(LINKS.templates, dict['wa.templatesLink'])} · {link(LINKS.help, dict['wa.helpLink'])}
          </li>
          <li>{dict['wa.step4']}</li>
          <li>{dict['wa.step5']}</li>
        </ol>
      </section>

      <p className="text-sm font-semibold" aria-live="polite">
        {status === 'saving' && dict['common.saving']}
        {status === 'saved' && <span className="text-jungle">✓ {dict['common.saved']}</span>}
        {status === 'error' && <span className="text-hibiscus">{dict['common.error']}</span>}
      </p>

      {WHATSAPP_TEMPLATES.map((t) => (
        <section key={t.name} className="rounded-2xl bg-white p-4">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-xl">
            <Copy text={t.name} dict={dict} />
          </h2>
          <p className="mt-2 text-sm">
            <span className="font-semibold">{dict['wa.category']}:</span> Utility
          </p>
          <ul className="mt-1 text-sm">
            {t.params.map((p, i) => (
              <li key={i}>
                <code>{`{{${i + 1}}}`}</code> = {p[locale]} · {dict['wa.sample']}: <Copy text={sample(t.sample[i]!)} dict={dict} />
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-4">
            {TEMPLATE_LANGUAGES.map((lang) => {
              const on = (approved[t.name] ?? []).includes(lang);
              return (
                <div key={lang} className="grid gap-2 border-t border-ink/10 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {META_LANGUAGE[lang]} ({lang})
                    </span>
                    <label className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${on ? 'bg-jungle text-cream' : 'bg-ink/5'}`}>
                      <input type="checkbox" checked={on} onChange={(e) => toggle(t.name, lang, e.target.checked)} />
                      {dict['wa.approved']}
                    </label>
                  </div>
                  <Copy text={t.body[lang]} dict={dict} block />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
