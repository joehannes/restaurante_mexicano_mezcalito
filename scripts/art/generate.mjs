/**
 * Generates the site's illustrations with Workers AI (FLUX.2), from
 * scripts/art/prompts.json, into art-out/. Run by the "Generate art" workflow
 * (manual only); the results are curated by hand into public/img/art.
 *
 *   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… node scripts/art/generate.mjs [name …]
 *
 * Every image shares the house style, so the set reads as one hand.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
if (!token || !account) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required');

const { style, sticker, items } = JSON.parse(await readFile(new URL('./prompts.json', import.meta.url), 'utf8'));
const only = process.argv.slice(2).join(' ').split(/[\s,]+/).filter(Boolean);
const todo = items.filter((i) => !only.length || only.includes(i.name));
await mkdir('art-out', { recursive: true });

let failed = 0;
for (const item of todo) {
  const prompt = `${item.prompt} ${item.kind === 'sticker' ? sticker : style}`;
  const model = item.model ?? '@cf/black-forest-labs/flux-2-klein-4b';
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', String(item.width ?? 1024));
  form.append('height', String(item.height ?? 1024));
  if (item.seed !== undefined) form.append('seed', String(item.seed));
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => null);
  const image = json?.result?.image;
  if (!res.ok || !image) {
    failed++;
    console.log(`✘ ${item.name}: ${res.status} ${JSON.stringify(json?.errors ?? json).slice(0, 400)}`);
    continue;
  }
  await writeFile(`art-out/${item.name}.jpg`, Buffer.from(image, 'base64'));
  console.log(`✔ ${item.name} (${model.split('/').pop()}, ${item.width ?? 1024}×${item.height ?? 1024})`);
}
if (failed) process.exitCode = 1;
