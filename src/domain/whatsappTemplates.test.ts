import { describe, expect, it } from 'vitest';
import { parseWhatsAppSettings, TEMPLATE_LANGUAGES, templateLanguage, WHATSAPP_TEMPLATES } from './whatsappTemplates';

describe('WHATSAPP_TEMPLATES', () => {
  it('follow Meta’s rules in every language', () => {
    for (const t of WHATSAPP_TEMPLATES) {
      expect(t.name, t.name).toMatch(/^[a-z0-9_]{1,512}$/);
      expect(t.sample).toHaveLength(t.params.length);
      for (const lang of TEMPLATE_LANGUAGES) {
        const body = t.body[lang];
        const label = `${t.name} ${lang}`;
        const used = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
        // Each parameter once, numbered 1…n in order.
        expect(used, label).toEqual(t.params.map((_, i) => i + 1));
        expect(body, label).not.toMatch(/^\s*\{\{/);
        expect(body, label).not.toMatch(/\}\}\s*$/);
        expect(body.length, label).toBeLessThanOrEqual(1024);
      }
    }
  });
});

describe('templateLanguage', () => {
  const settings = { approved: { mezcalito_order_ready: ['es' as const, 'fr' as const] } };
  it('uses the guest’s language when it is approved', () => {
    expect(templateLanguage(settings, 'mezcalito_order_ready', 'fr')).toBe('fr');
  });
  it('falls back to English, then Spanish', () => {
    expect(templateLanguage(settings, 'mezcalito_order_ready', 'de')).toBe('es');
    expect(templateLanguage({ approved: { mezcalito_order_ready: ['en', 'es'] } }, 'mezcalito_order_ready', 'de')).toBe('en');
  });
  it('sends nothing until a language is approved', () => {
    expect(templateLanguage(settings, 'mezcalito_order_received', 'en')).toBeUndefined();
    expect(templateLanguage(undefined, 'mezcalito_order_ready', 'es')).toBeUndefined();
  });
});

describe('parseWhatsAppSettings', () => {
  it('keeps known templates and languages in order', () => {
    expect(parseWhatsAppSettings({ approved: { mezcalito_order_ready: ['de', 'en'] } })).toEqual({ approved: { mezcalito_order_ready: ['en', 'de'] } });
  });
  it('rejects unknown templates and languages', () => {
    expect(parseWhatsAppSettings({ approved: { other: ['en'] } })).toBeUndefined();
    expect(parseWhatsAppSettings({ approved: { mezcalito_order_ready: ['pt'] } })).toBeUndefined();
    expect(parseWhatsAppSettings(null)).toBeUndefined();
  });
});
