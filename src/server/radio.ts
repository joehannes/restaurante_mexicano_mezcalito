/**
 * Mezcalito Radio on the server: the script from D1, the recorded voice for
 * each question, and the plate at the end of a path.
 *
 * Voices are rendered once per question and language with Workers AI and
 * kept in R2 under a fingerprint of the words they say. When staff change a
 * question, its old clip no longer matches and the guest's device reads the
 * new words aloud instead, until someone renders the voice again. German has
 * no Workers AI voice, so it is always read by the device (or a clip
 * recorded elsewhere could be uploaded under the same key).
 */
import type { Answer, RadioNode, RadioOption } from '../domain/radioTree';
import { walk } from '../domain/radioTree';
import { selectPlate, type Reason } from '../domain/selector';
import type { Locale } from '../domain/types';
import { localized } from '../domain/types';
import { t } from '../i18n/ui';
import { putMedia } from './media';
import { selectorContext } from './selector';

export interface StoredNode extends RadioNode {
  /** Locale → fingerprint of the words its clip says. */
  voice: Partial<Record<Locale, string>>;
}

export async function loadRadio(db: D1Database): Promise<{ nodes: StoredNode[]; counts: Map<string, Map<string, number>> }> {
  const [nodes, choices] = await db.batch([
    db.prepare('SELECT id, prompt, options, voice FROM radio_nodes ORDER BY position'),
    db.prepare('SELECT node_id, option_id, count FROM radio_choices'),
  ]);
  const counts = new Map<string, Map<string, number>>();
  for (const c of choices!.results as { node_id: string; option_id: string; count: number }[]) {
    if (!counts.has(c.node_id)) counts.set(c.node_id, new Map());
    counts.get(c.node_id)!.set(c.option_id, c.count);
  }
  return {
    nodes: (nodes!.results as Record<string, string>[]).map((r) => ({
      id: r.id!,
      prompt: JSON.parse(r.prompt!),
      options: JSON.parse(r.options!) as RadioOption[],
      voice: JSON.parse(r.voice ?? '{}'),
    })),
    counts,
  };
}

/** A short, stable fingerprint of the words a clip says. */
export async function fingerprint(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest).slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const clipKey = (node: string, locale: Locale, hash: string) => `radio/${node}-${locale}-${hash}.mp3`;

/** The clip for this question in this language, if one matches its current words. */
export async function voiceUrl(node: StoredNode, locale: Locale): Promise<string | null> {
  const hash = node.voice[locale];
  if (!hash || hash !== (await fingerprint(localized(node.prompt, locale)))) return null;
  return `/media/${clipKey(node.id, locale, hash)}`;
}

/** Workers AI text-to-speech per language. German has none. */
const VOICES: Partial<Record<Locale, { model: string; input: (text: string) => Record<string, unknown> }>> = {
  en: { model: '@cf/deepgram/aura-2-en', input: (text) => ({ text, encoding: 'mp3' }) },
  es: { model: '@cf/deepgram/aura-2-es', input: (text) => ({ text, encoding: 'mp3' }) },
  fr: { model: '@cf/myshell-ai/melotts', input: (text) => ({ prompt: text, lang: 'fr' }) },
};

/** Models answer with a stream, raw bytes, or base64 in `audio`; this takes any of them. */
async function audioBytes(result: unknown): Promise<Uint8Array | undefined> {
  if (result instanceof ReadableStream) return new Uint8Array(await new Response(result).arrayBuffer());
  if (result instanceof ArrayBuffer) return new Uint8Array(result);
  if (result instanceof Uint8Array) return result;
  const audio = (result as { audio?: unknown } | null)?.audio;
  if (typeof audio === 'string') return Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
  if (audio instanceof ReadableStream) return new Uint8Array(await new Response(audio).arrayBuffer());
  return undefined;
}

export type RenderResult = Partial<Record<Locale, 'ok' | 'no_voice' | 'failed'>>;

export async function renderVoice(env: Env, node: StoredNode): Promise<RenderResult> {
  const result: RenderResult = {};
  const voice = { ...node.voice };
  for (const locale of ['en', 'es', 'fr', 'de'] as const) {
    const engine = VOICES[locale];
    if (!engine) {
      result[locale] = 'no_voice';
      continue;
    }
    const text = localized(node.prompt, locale);
    try {
      const bytes = await audioBytes(await env.AI.run(engine.model as never, engine.input(text) as never));
      if (!bytes?.length) throw new Error('no audio');
      const hash = await fingerprint(text);
      if (!(await putMedia(env, clipKey(node.id, locale, hash), bytes, bytes.byteLength, 'audio/mpeg'))) throw new Error('media storage at its free limit');
      voice[locale] = hash;
      result[locale] = 'ok';
    } catch (error) {
      console.error('voice render failed', node.id, locale, String(error));
      result[locale] = 'failed';
    }
  }
  await env.DB.prepare('UPDATE radio_nodes SET voice = ? WHERE id = ?').bind(JSON.stringify(voice), node.id).run();
  return result;
}

/** The end of a path: count each answer, then plate up from the preferences it adds up to. */
export async function radioPlate(env: Env, answers: Answer[], locale: Locale) {
  const { nodes } = await loadRadio(env.DB);
  const { prefs, path } = walk(nodes, answers);
  if (path.length) {
    await env.DB.batch(
      path.map((a) =>
        env.DB.prepare('INSERT INTO radio_choices (node_id, option_id, count) VALUES (?, ?, 1) ON CONFLICT (node_id, option_id) DO UPDATE SET count = count + 1').bind(
          a.node,
          a.option,
        ),
      ),
    );
  }
  try {
    env.EVENTS.writeDataPoint({ indexes: ['radio'], blobs: ['radio', path.map((a) => `${a.node}:${a.option}`).join('>'), locale], doubles: [path.length] });
  } catch {}
  const { menu, ctx } = await selectorContext(env);
  const plate = selectPlate(menu, prefs, ctx);
  const why = (reasons: Reason[]) => reasons.map((r) => t(locale, `selector.why.${r}`)).join(' · ');
  return {
    picks: plate.picks.map((p) => ({ id: p.id, why: why(p.reasons) })),
    drink: plate.drink && { id: plate.drink.id, why: why(plate.drink.reasons) },
  };
}
