/**
 * Mezcalito Radio: the Selector as a little broadcast. A voice asks each
 * question over a music bed that ducks while it speaks; the guest answers by
 * tapping or out loud, can skip to the plate at any time, and nothing ever
 * plays until they tap to tune in.
 */
import { useEffect, useRef, useState } from 'react';
import { matchAnswer, type Answer } from '../domain/radioTree';
import type { Locale, MenuItem, PricingSettings } from '../domain/types';
import { fill, type Dictionary } from '../i18n/fill';
import { startRiddim, type Riddim } from '../lib/riddim';
import PlateView, { type ServedPlate } from './PlateView';
import { Vinyl } from './Selector';

export interface RadioQuestion {
  id: string;
  prompt: string;
  /** Already in the order past guests chose them most. */
  options: { id: string; label: string; next?: string; popular: boolean }[];
  /** A rendered clip for these exact words, or null to read them with the device's voice. */
  voice: string | null;
}

interface Props {
  locale: Locale;
  dict: Dictionary;
  questions: RadioQuestion[];
  bed: string | null;
  menu: MenuItem[];
  pricing: PricingSettings;
  menuHref: string;
  checkoutHref: string;
}

const SPEECH_LANG: Record<Locale, string> = { en: 'en-US', es: 'es-DO', fr: 'fr-FR', de: 'de-DE' };
const BED = 0.45;
const DUCKED = 0.1;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

export default function Radio(props: Props) {
  const { locale, dict, questions } = props;
  const byId = new Map(questions.map((q) => [q.id, q]));
  const [stage, setStage] = useState<'intro' | 'on' | 'plate'>('intro');
  const [sound, setSound] = useState(false);
  const [music, setMusic] = useState(true);
  const [current, setCurrent] = useState<RadioQuestion | undefined>(byId.get('start'));
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [plate, setPlate] = useState<ServedPlate>();
  const [listening, setListening] = useState(false);
  const [missed, setMissed] = useState(false);
  const audio = useRef<{ ctx: AudioContext; bed: GainNode; voice: GainNode; riddim?: Riddim; source?: AudioBufferSourceNode } | null>(null);
  const clip = useRef<AudioBufferSourceNode | null>(null);
  const Recognition =
    typeof window !== 'undefined'
      ? ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition)
      : undefined;

  const duck = (on: boolean) => {
    const a = audio.current;
    if (a) a.bed.gain.setTargetAtTime(music ? (on ? DUCKED : BED) : 0, a.ctx.currentTime, 0.12);
  };

  /** Read a question: its clip if one matches the words, else the device's own voice. */
  const speak = async (q: RadioQuestion) => {
    if (!sound) return;
    clip.current?.stop();
    speechSynthesis?.cancel();
    duck(true);
    const a = audio.current;
    if (q.voice && a) {
      try {
        const buffer = await a.ctx.decodeAudioData(await (await fetch(q.voice)).arrayBuffer());
        const src = a.ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(a.voice);
        src.onended = () => duck(false);
        src.start();
        clip.current = src;
        return;
      } catch {}
    }
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(q.prompt);
      u.lang = SPEECH_LANG[locale];
      const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith(locale));
      if (voice) u.voice = voice;
      u.onend = () => duck(false);
      speechSynthesis.speak(u);
    } else duck(false);
  };

  useEffect(() => {
    if (stage === 'on' && current) speak(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, current?.id]);

  useEffect(
    () => () => {
      audio.current?.riddim?.stop();
      audio.current?.source?.stop();
      audio.current?.ctx.close();
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    },
    [],
  );

  const tuneIn = async (withSound: boolean) => {
    setSound(withSound);
    setStage('on');
    if (!withSound) return;
    const ctx = new AudioContext();
    await ctx.resume();
    const bed = ctx.createGain();
    bed.gain.value = BED;
    bed.connect(ctx.destination);
    const voice = ctx.createGain();
    voice.connect(ctx.destination);
    audio.current = { ctx, bed, voice };
    if (props.bed) {
      try {
        const buffer = await ctx.decodeAudioData(await (await fetch(props.bed)).arrayBuffer());
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(bed);
        source.start();
        audio.current.source = source;
        return;
      } catch {}
    }
    audio.current.riddim = startRiddim(ctx, bed);
  };

  const toggleMusic = () => {
    const on = !music;
    setMusic(on);
    const a = audio.current;
    if (a) a.bed.gain.setTargetAtTime(on ? BED : 0, a.ctx.currentTime, 0.2);
  };

  const finish = async (path: Answer[]) => {
    clip.current?.stop();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    duck(false);
    setStage('plate');
    setPlate(undefined);
    try {
      const response = await fetch('/api/radio/plate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answers: path, locale }) });
      setPlate((await response.json()) as ServedPlate);
    } catch {
      setPlate({ picks: [] });
    }
  };

  const choose = (optionId: string) => {
    if (!current) return;
    const option = current.options.find((o) => o.id === optionId);
    if (!option) return;
    const path = [...answers, { node: current.id, option: optionId }];
    setAnswers(path);
    setMissed(false);
    const next = option.next ? byId.get(option.next) : undefined;
    if (next) setCurrent(next);
    else finish(path);
  };

  const listen = () => {
    if (!Recognition || !current) return;
    const rec = new Recognition();
    rec.lang = SPEECH_LANG[locale];
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    duck(true);
    setListening(true);
    setMissed(false);
    rec.onresult = (e) => {
      const heard = Array.from(e.results[0] ?? []).map((r) => r.transcript);
      const id = heard.map((h) => matchAnswer(h, current.options)).find(Boolean);
      if (id) choose(id);
      else setMissed(true);
    };
    rec.onerror = () => setMissed(true);
    rec.onend = () => {
      setListening(false);
      duck(false);
    };
    rec.start();
  };

  const restart = () => {
    setAnswers([]);
    setPlate(undefined);
    setCurrent(byId.get('start'));
    setStage('on');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32">
      {stage === 'intro' && (
        <div className="rounded-3xl bg-ink p-6 text-cream md:p-10">
          <div className="flex items-center gap-5">
            <Vinyl spinning={false} />
            <p className="text-lg">{dict['radio.intro']}</p>
          </div>
          <p className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => tuneIn(true)} className="cone rounded-full bg-hibiscus px-7 py-3 text-lg font-bold text-cream shadow-[4px_4px_0_var(--c-gold)]">
              ▶ {dict['radio.start']}
            </button>
            <button type="button" onClick={() => tuneIn(false)} className="rounded-full border-2 border-cream px-6 py-3 font-bold">
              {dict['radio.startQuiet']}
            </button>
          </p>
        </div>
      )}

      {stage === 'on' && current && (
        <section className="rounded-3xl bg-mezcal p-6 text-cream md:p-10" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display tracking-wide text-gold uppercase">{fill(dict, 'radio.question', { n: answers.length + 1 })}</p>
            <span className="flex items-center gap-3">
              {sound && (
                <button type="button" onClick={toggleMusic} className="rounded-full border border-cream/40 px-3 py-1 text-sm">
                  {music ? dict['radio.mute'] : dict['radio.unmute']}
                </button>
              )}
              <Vinyl spinning={sound && music} />
            </span>
          </div>
          <h2 className="mt-2 font-display text-4xl leading-tight uppercase md:text-5xl">{current.prompt}</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {current.options.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => choose(o.id)} className="w-full rounded-2xl bg-cream px-5 py-4 text-left text-lg font-bold text-ink shadow-[4px_4px_0_var(--c-gold)]">
                  {o.label}
                  {o.popular && <span className="ml-2 rounded-full bg-gold px-2 text-xs uppercase">{dict['radio.popular']}</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex flex-wrap items-center gap-4">
            {Recognition && (
              <button type="button" onClick={listen} disabled={listening} className="rounded-full bg-gold px-5 py-2 font-bold text-ink disabled:opacity-60">
                🎙 {listening ? dict['radio.listening'] : dict['radio.mic']}
              </button>
            )}
            <button type="button" onClick={() => finish(answers)} className="font-semibold underline">
              {dict['radio.skip']} →
            </button>
          </p>
          {missed && <p className="mt-3 font-semibold text-gold">{dict['radio.notCaught']}</p>}
          <ol className="mt-6 flex gap-1" aria-hidden="true">
            {answers.map((a) => (
              <li key={a.node} className="h-1.5 w-8 rounded-full bg-gold" />
            ))}
            <li className="h-1.5 w-8 rounded-full bg-cream/30" />
          </ol>
        </section>
      )}

      {stage === 'plate' && (
        <section aria-live="polite">
          <h2 className="mb-4 font-display text-4xl uppercase">{dict['radio.plate']}</h2>
          {plate ? (
            <PlateView plate={plate} menu={props.menu} pricing={props.pricing} locale={locale} dict={dict} menuHref={props.menuHref} checkoutHref={props.checkoutHref} />
          ) : (
            <div className="flex justify-center py-8">
              <Vinyl spinning />
            </div>
          )}
          <p className="mt-6">
            <button type="button" onClick={restart} className="font-semibold underline">
              ↺ {dict['radio.again']}
            </button>
          </p>
        </section>
      )}
    </div>
  );
}
