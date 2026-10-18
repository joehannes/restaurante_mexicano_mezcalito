import { describe, expect, it } from 'vitest';
import { radio } from '../../seed/data';
import { byPopularity, cleanTraits, matchAnswer, preferencesFrom, treeProblems, walk, type RadioNode } from './radioTree';

describe('the launch radio script', () => {
  it('has no dead ends, loops or orphan questions', () => {
    expect(treeProblems(radio)).toEqual([]);
  });
  it('is written in all four languages', () => {
    for (const n of radio) {
      expect(Object.keys(n.prompt).sort(), n.id).toEqual(['de', 'en', 'es', 'fr']);
      for (const o of n.options) expect(Object.keys(o.label).sort(), `${n.id}/${o.id}`).toEqual(['de', 'en', 'es', 'fr']);
    }
  });
});

describe('walk', () => {
  it('adds up the traits along the path', () => {
    const r = walk(radio, [
      { node: 'start', option: 'celebrate' },
      { node: 'crew', option: 'big' },
      { node: 'side', option: 'ja' },
      { node: 'heat', option: 'hot' },
      { node: 'sea', option: 'sea' },
      { node: 'wallet', option: 'normal' },
    ]);
    expect(r.prefs).toEqual({ hunger: 'feast', heat: 'hot', leaning: 'ja', diet: ['seafood'], firstTime: false, party: 8, budget: 100_000 });
    expect(r.next).toBeUndefined();
    expect(r.path).toHaveLength(6);
  });
  it('says what comes next mid-way', () => {
    expect(walk(radio, [{ node: 'start', option: 'hungry' }]).next?.id).toBe('side');
    expect(walk(radio, []).next?.id).toBe('start');
  });
  it('stops at the first answer that does not fit the tree', () => {
    const r = walk(radio, [
      { node: 'start', option: 'snack' },
      { node: 'crew', option: 'big' }, // snack goes to "side", not "crew"
      { node: 'side', option: 'mx' },
    ]);
    expect(r.path).toEqual([{ node: 'start', option: 'snack' }]);
    expect(r.prefs.hunger).toBe('snack');
    expect(r.prefs.party).toBe(2);
  });
});

describe('preferencesFrom', () => {
  it('lets later answers win and adds diets up', () => {
    expect(preferencesFrom([{ heat: 'hot', diet: ['seafood'] }, { heat: 'mild', diet: ['no-seafood'] }])).toMatchObject({ heat: 'mild', diet: ['seafood', 'no-seafood'] });
  });
});

describe('byPopularity', () => {
  it('puts the most chosen answers first and keeps the written order for ties', () => {
    const options = radio.find((n) => n.id === 'side')!.options;
    expect(byPopularity(options, new Map([['both', 9], ['mx', 9]])).map((o) => o.id)).toEqual(['mx', 'both', 'ja']);
    expect(byPopularity(options).map((o) => o.id)).toEqual(['ja', 'mx', 'both']);
  });
});

describe('treeProblems', () => {
  const q = (id: string, next?: string): RadioNode => ({ id, prompt: { en: id }, options: [{ id: 'a', label: { en: 'a' }, next, traits: {} }] });
  it('finds a missing start, dead links, loops and orphans', () => {
    expect(treeProblems([q('intro')])).toContain('no "start" question');
    expect(treeProblems([q('start', 'nowhere')])).toContain('start/a: leads to missing "nowhere"');
    expect(treeProblems([q('start', 'b'), q('b', 'start')])).toContain('a path loops back on itself');
    expect(treeProblems([q('start'), q('island')])).toContain('island: no path reaches it');
  });
});

describe('cleanTraits', () => {
  it('keeps only known preference values', () => {
    expect(cleanTraits({ hunger: 'feast', heat: 'lava', diet: ['seafood', 'carnivore'], party: 100, budget: 50_000, admin: true })).toEqual({
      hunger: 'feast',
      diet: ['seafood'],
      budget: 50_000,
    });
  });
});

describe('matchAnswer', () => {
  const options = (id: string) => radio.find((n) => n.id === id)!.options.map((o) => ({ id: o.id, label: o.label.es ?? o.label.en }));
  const en = (id: string) => radio.find((n) => n.id === id)!.options.map((o) => ({ id: o.id, label: o.label.en }));
  it('understands the label said whole, without accents or case', () => {
    expect(matchAnswer('mexico', options('side'))).toBe('mx');
    expect(matchAnswer('Jamaica please', en('side'))).toBe('ja');
  });
  it('understands a long word from the label', () => {
    expect(matchAnswer('give me the scotch bonnet', en('heat'))).toBe('hot');
    expect(matchAnswer('sorpréndeme', options('sea'))).toBe('any');
  });
  it('gives up rather than guess', () => {
    expect(matchAnswer('hmm', en('heat'))).toBeUndefined();
  });
});
