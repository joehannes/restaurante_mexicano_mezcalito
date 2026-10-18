import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parseLocalized } from '../../../../domain/adminInput';
import { cleanTraits, treeProblems, type RadioNode } from '../../../../domain/radioTree';
import { body, contentChanged, guard, json } from '../../../../server/admin';
import { fingerprint, loadRadio } from '../../../../server/radio';

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** The script, how often each answer is chosen, whether each voice is current, and the music bed. */
export const GET: APIRoute = async ({ locals }) => {
  const staff = guard(locals, 'radio');
  if (staff instanceof Response) return staff;
  const [{ nodes, counts }, bed] = await Promise.all([loadRadio(env.DB), env.DB.prepare("SELECT value FROM settings WHERE key = 'radio'").first<{ value: string }>()]);
  const voices = await Promise.all(
    nodes.map(async (n) =>
      Object.fromEntries(
        await Promise.all((['en', 'es', 'fr', 'de'] as const).map(async (l) => [l, n.voice[l] ? (n.voice[l] === (await fingerprint(n.prompt[l] ?? n.prompt.en)) ? 'current' : 'stale') : 'none'])),
      ),
    ),
  );
  return json({
    nodes: nodes.map(({ voice: _v, ...n }, i) => ({ ...n, voices: voices[i] })),
    counts: Object.fromEntries([...counts].map(([node, m]) => [node, Object.fromEntries(m)])),
    problems: treeProblems(nodes),
    bed: bed ? (JSON.parse(bed.value) as { bed: string | null }).bed : null,
  });
};

/** Replaces the whole script; refused if any path would strand a guest. */
export const PUT: APIRoute = async ({ locals, request }) => {
  const staff = guard(locals, 'radio');
  if (staff instanceof Response) return staff;
  const input = await body<{ nodes?: unknown }>(request);
  if (!Array.isArray(input?.nodes) || !input.nodes.length || input.nodes.length > 20) return json({ error: 'invalid', fields: ['nodes'] }, 400);
  const nodes: RadioNode[] = [];
  for (const raw of input.nodes as Record<string, unknown>[]) {
    const prompt = parseLocalized(raw?.prompt, 300);
    const options = Array.isArray(raw?.options) ? (raw.options as Record<string, unknown>[]) : [];
    if (!SLUG.test(String(raw?.id)) || !prompt || !options.length || options.length > 6) return json({ error: 'invalid', fields: [String(raw?.id ?? 'node')] }, 400);
    const parsed = options.map((o) => ({ id: String(o?.id), label: parseLocalized(o?.label, 60), next: o?.next ? String(o.next) : undefined, traits: cleanTraits(o?.traits) }));
    if (parsed.some((o) => !SLUG.test(o.id) || !o.label)) return json({ error: 'invalid', fields: [String(raw.id)] }, 400);
    nodes.push({ id: String(raw.id), prompt, options: parsed as RadioNode['options'] });
  }
  const problems = treeProblems(nodes);
  if (problems.length) return json({ error: 'invalid', fields: ['tree'], problems }, 400);
  const { nodes: before } = await loadRadio(env.DB);
  const voice = new Map(before.map((n) => [n.id, JSON.stringify(n.voice)]));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM radio_nodes'),
    ...nodes.map((n, position) =>
      env.DB.prepare('INSERT INTO radio_nodes (id, prompt, options, position, voice) VALUES (?, ?, ?, ?, ?)').bind(
        n.id,
        JSON.stringify(n.prompt),
        JSON.stringify(n.options),
        position,
        voice.get(n.id) ?? '{}',
      ),
    ),
  ]);
  await contentChanged(env);
  return json({ ok: true });
};
