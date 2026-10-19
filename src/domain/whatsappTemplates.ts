/**
 * The WhatsApp message templates Mezcalito sends. WhatsApp only lets a
 * business write to a guest first with a template Meta has approved, so each
 * one is submitted once per language in WhatsApp Manager, exactly as written
 * here. Staff tick each one off in the admin as Meta approves it; until then
 * nothing is sent in that language (guests still see everything on the
 * website and by email, and can always chat with the restaurant's number).
 *
 * Meta's rules these follow: lowercase names with underscores; numbered
 * {{1}}, {{2}}… parameters in order; a body may not start or end with a
 * parameter; category "Utility" (order and booking updates, no promotion).
 */
import type { Locale } from './types';

export const TEMPLATE_LANGUAGES = ['en', 'es', 'fr', 'de'] as const satisfies readonly Locale[];

/** The names Meta shows for each language code when creating a template. */
export const META_LANGUAGE: Record<Locale, string> = { en: 'English', es: 'Spanish', fr: 'French', de: 'German' };

export interface WhatsAppTemplate {
  name: string;
  /** What each {{n}} is, for staff (EN and ES admin). */
  params: { en: string; es: string }[];
  /** Example values Meta asks for when the template is submitted. */
  sample: string[];
  body: Record<Locale, string>;
}

export const WHATSAPP_TEMPLATES = [
  {
    name: 'mezcalito_order_received',
    params: [
      { en: 'first name', es: 'nombre' },
      { en: 'order code', es: 'código del pedido' },
      { en: 'link to the live order page', es: 'enlace al pedido en vivo' },
    ],
    sample: ['Ana', 'MZ-4821', 'https://mezcalito.example/en/o/MZ-4821'],
    body: {
      en: 'Hi {{1}}, Mezcalito has your order {{2}}. Follow it live here: {{3}} — thank you!',
      es: 'Hola {{1}}, Mezcalito recibió tu pedido {{2}}. Síguelo en vivo aquí: {{3}} — ¡gracias!',
      fr: 'Bonjour {{1}}, Mezcalito a bien reçu ta commande {{2}}. Suis-la en direct ici : {{3}} — merci !',
      de: 'Hallo {{1}}, Mezcalito hat deine Bestellung {{2}} erhalten. Verfolge sie live hier: {{3}} — danke!',
    },
  },
  {
    name: 'mezcalito_order_ready',
    params: [{ en: 'order code', es: 'código del pedido' }],
    sample: ['MZ-4821'],
    body: {
      en: 'Good news: your Mezcalito order {{1}} is ready for pickup at Calle Pedro Mir, Bávaro. See you soon!',
      es: '¡Buenas noticias! Tu pedido de Mezcalito {{1}} está listo para recoger en la calle Pedro Mir, Bávaro. ¡Te esperamos!',
      fr: 'Bonne nouvelle : ta commande Mezcalito {{1}} est prête à emporter, rue Pedro Mir, Bávaro. À tout de suite !',
      de: 'Gute Nachricht: Deine Mezcalito-Bestellung {{1}} ist abholbereit in der Calle Pedro Mir, Bávaro. Bis gleich!',
    },
  },
  {
    name: 'mezcalito_order_on_the_way',
    params: [{ en: 'order code', es: 'código del pedido' }],
    sample: ['MZ-4821'],
    body: {
      en: 'Your Mezcalito order {{1}} is on its way to you. Enjoy!',
      es: 'Tu pedido de Mezcalito {{1}} va en camino. ¡Buen provecho!',
      fr: 'Ta commande Mezcalito {{1}} est en route. Bon appétit !',
      de: 'Deine Mezcalito-Bestellung {{1}} ist unterwegs. Guten Appetit!',
    },
  },
  {
    name: 'mezcalito_reservation_confirmed',
    params: [
      { en: 'first name', es: 'nombre' },
      { en: 'date and time', es: 'fecha y hora' },
      { en: 'party size', es: 'número de personas' },
      { en: 'booking code', es: 'código de la reserva' },
    ],
    sample: ['Ana', 'Saturday 24 October, 8:00 PM', '4', 'R-7Q2K'],
    body: {
      en: 'Hi {{1}}, your table at Mezcalito is booked for {{2}}, party of {{3}}. Booking code: {{4}}. Reply here if plans change.',
      es: 'Hola {{1}}, tu mesa en Mezcalito está reservada para el {{2}}, {{3}} personas. Código: {{4}}. Responde aquí si cambian tus planes.',
      fr: 'Bonjour {{1}}, ta table chez Mezcalito est réservée pour le {{2}}, {{3}} personnes. Code : {{4}}. Réponds ici si tes plans changent.',
      de: 'Hallo {{1}}, dein Tisch im Mezcalito ist für {{2}} reserviert, {{3}} Personen. Code: {{4}}. Antworte hier, falls sich etwas ändert.',
    },
  },
  {
    name: 'mezcalito_reservation_reminder',
    params: [
      { en: 'first name', es: 'nombre' },
      { en: 'time', es: 'hora' },
      { en: 'booking code', es: 'código de la reserva' },
    ],
    sample: ['Ana', '8:00 PM', 'R-7Q2K'],
    body: {
      en: 'Hi {{1}}, see you today at {{2}} at Mezcalito, Calle Pedro Mir. Booking code: {{3}}. Running late? Just reply here.',
      es: 'Hola {{1}}, te esperamos hoy a las {{2}} en Mezcalito, calle Pedro Mir. Código: {{3}}. ¿Llegas tarde? Responde aquí.',
      fr: 'Bonjour {{1}}, on t’attend aujourd’hui à {{2}} chez Mezcalito, rue Pedro Mir. Code : {{3}}. En retard ? Réponds ici.',
      de: 'Hallo {{1}}, wir sehen uns heute um {{2}} im Mezcalito, Calle Pedro Mir. Code: {{3}}. Verspätest du dich? Antworte einfach hier.',
    },
  },
] as const satisfies readonly WhatsAppTemplate[];

export type TemplateName = (typeof WHATSAPP_TEMPLATES)[number]['name'];

/** Which languages of which templates Meta has approved, as ticked in the admin. */
export interface WhatsAppSettings {
  approved: Partial<Record<TemplateName, Locale[]>>;
}

const NAMES = new Set<string>(WHATSAPP_TEMPLATES.map((t) => t.name));

export function parseWhatsAppSettings(v: unknown): WhatsAppSettings | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const approved = (v as { approved?: unknown }).approved;
  if (!approved || typeof approved !== 'object' || Array.isArray(approved)) return undefined;
  const out: WhatsAppSettings['approved'] = {};
  for (const [name, langs] of Object.entries(approved)) {
    if (!NAMES.has(name) || !Array.isArray(langs)) return undefined;
    if (!langs.every((l) => (TEMPLATE_LANGUAGES as readonly string[]).includes(l))) return undefined;
    out[name as TemplateName] = TEMPLATE_LANGUAGES.filter((l) => langs.includes(l));
  }
  return { approved: out };
}

/**
 * The language to send a template in: the guest's own if Meta approved it,
 * otherwise English or Spanish if one of those is, otherwise none.
 */
export function templateLanguage(settings: WhatsAppSettings | undefined, name: TemplateName, locale: Locale): Locale | undefined {
  const approved = settings?.approved[name] ?? [];
  return [locale, 'en' as const, 'es' as const].find((l) => approved.includes(l));
}
