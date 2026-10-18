import { describe, expect, it } from 'vitest';
import { items, specials } from '../../seed/data';
import { draftFromPreset, PRESETS } from './seasonPresets';

describe('draftFromPreset', () => {
  it('dates a preset for this year while it is still ahead or running', () => {
    expect(draftFromPreset('dia-de-muertos', '2026-10-18')).toMatchObject({ startsOn: '2026-10-24', endsOn: '2026-11-03' });
    expect(draftFromPreset('dia-de-muertos', '2026-11-01')).toMatchObject({ startsOn: '2026-10-24', endsOn: '2026-11-03' });
  });
  it('moves a preset that already ended to next year', () => {
    expect(draftFromPreset('cinco-de-mayo', '2026-10-18')).toMatchObject({ startsOn: '2027-04-28', endsOn: '2027-05-05' });
  });
  it('lets Christmas run into January', () => {
    expect(draftFromPreset('navidad-caribena', '2026-10-18')).toMatchObject({ startsOn: '2026-12-01', endsOn: '2027-01-06' });
    expect(draftFromPreset('navidad-caribena', '2027-01-03')).toMatchObject({ startsOn: '2027-12-01', endsOn: '2028-01-06' });
  });
  it('runs undated presets for two weeks from today', () => {
    expect(draftFromPreset('big-game', '2026-12-25')).toMatchObject({ startsOn: '2026-12-25', endsOn: '2027-01-08' });
  });
  it('returns undefined for an unknown preset', () => {
    expect(draftFromPreset('nope', '2026-10-18')).toBeUndefined();
  });
});

describe('PRESETS', () => {
  const itemIds = new Set(items.map((i) => i.id));
  const specialIds = new Set(specials.map((s) => s.id));
  it('only point at dishes and nights that exist', () => {
    for (const preset of PRESETS) {
      for (const block of preset.blocks) {
        if (block.type === 'dishes') for (const id of block.itemIds) expect(itemIds.has(id), `${preset.slug}: ${id}`).toBe(true);
        if (block.type === 'nights') for (const id of block.specialIds) expect(specialIds.has(id), `${preset.slug}: ${id}`).toBe(true);
      }
    }
  });
  it('are written in all four languages', () => {
    for (const p of PRESETS) for (const text of [p.name, p.hero.headline, p.hero.body, p.hero.kicker]) expect(Object.keys(text).sort()).toEqual(['de', 'en', 'es', 'fr']);
  });
});
