/**
 * The dish sheet: choose the variant, sides and extras, weight for dishes
 * sold by the pound, quantity and a note — then add. It slides up from the
 * bottom on phones and sits centred on wider screens.
 *
 * Validity comes from the same `priceCart` the server uses, so the sheet can
 * never let through a choice the order endpoint would reject.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { priceCart } from '../domain/pricing';
import type { CartLine, Locale, MenuItem, PricingSettings } from '../domain/types';
import { localized } from '../domain/types';
import { fill, type Dictionary } from '../i18n/fill';
import { addToCart } from '../lib/cart';
import { formatPrice } from '../lib/format';
import { fusionLabel } from '../lib/menuView';

interface Props {
  item: MenuItem;
  locale: Locale;
  dict: Dictionary;
  pricing: PricingSettings;
  onClose: (added: boolean) => void;
}

export default function ItemSheet({ item, locale, dict, pricing, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const firstVariant = item.variants?.find((v) => !v.soldOut)?.id;
  const [variantId, setVariantId] = useState<string | undefined>(firstVariant);
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [weight, setWeight] = useState(pricing.minWeightLb);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const line: CartLine = {
    itemId: item.id,
    variantId,
    qty,
    weightLb: item.unit === 'lb' ? weight : undefined,
    options,
    note: note.trim() || undefined,
  };
  const check = priceCart([item], [line], pricing, 'pickup');
  const missing = check.ok ? undefined : check.errors[0]?.code;

  // Show a running price even before every required choice is made.
  const unit = useMemo(() => {
    const base = item.variants?.find((v) => v.id === variantId)?.price ?? item.price;
    const extras = (item.modifierGroups ?? []).reduce(
      (sum, g) => sum + (options[g.id] ?? []).reduce((s, id) => s + (g.options.find((o) => o.id === id)?.price ?? 0), 0),
      0,
    );
    return Math.round(base * (item.unit === 'lb' ? weight : 1)) + extras;
  }, [item, variantId, options, weight]);

  const toggle = (groupId: string, optionId: string, max: number) =>
    setOptions((current) => {
      const chosen = current[groupId] ?? [];
      if (max === 1) return { ...current, [groupId]: chosen[0] === optionId ? [] : [optionId] };
      if (chosen.includes(optionId)) return { ...current, [groupId]: chosen.filter((id) => id !== optionId) };
      if (chosen.length >= max) return current;
      return { ...current, [groupId]: [...chosen, optionId] };
    });

  const close = (added: boolean) => {
    dialog.current?.close();
    onClose(added);
  };

  const add = () => {
    if (!check.ok) return;
    addToCart(line);
    navigator.vibrate?.(12);
    close(true);
  };

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        close(false);
      }}
      onClick={(e) => e.target === dialog.current && close(false)}
      className="sheet m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-ink/60 md:m-auto md:max-w-lg"
      aria-labelledby="sheet-title"
    >
      <div className="max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-cream text-ink md:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-cream px-5 pt-5 pb-3">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-hibiscus uppercase">
              {fusionLabel(item.fusion, locale)}
              {item.heat > 0 && ` · ${fill(dict, 'menu.heatLevel', { n: item.heat })}`}
            </p>
            <h2 id="sheet-title" className="font-display text-3xl leading-none uppercase">
              {localized(item.name, locale)}
            </h2>
          </div>
          <button type="button" onClick={() => close(false)} className="rounded-full bg-ink/10 px-3 py-1 text-sm font-bold">
            {dict['menu.close']}
          </button>
        </div>

        <div className="space-y-6 px-5 pb-32">
          {item.description && <p>{localized(item.description, locale)}</p>}

          {item.variants && (
            <fieldset>
              <legend className="mb-2 font-bold">
                {dict['menu.chooseOne']} <span className="text-sm font-normal text-hibiscus">· {dict['menu.required']}</span>
              </legend>
              <div className="grid gap-2">
                {item.variants.map((v) => (
                  <label
                    key={v.id}
                    className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 ${
                      variantId === v.id ? 'border-ink bg-gold' : 'border-ink/15'
                    } ${v.soldOut ? 'opacity-40' : ''}`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="variant"
                        className="accent-ink"
                        checked={variantId === v.id}
                        disabled={v.soldOut}
                        onChange={() => setVariantId(v.id)}
                      />
                      {localized(v.label, locale)}
                    </span>
                    <span className="font-semibold">{v.soldOut ? dict['menu.soldOut'] : formatPrice(v.price, locale)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {item.modifierGroups?.map((g) => (
            <fieldset key={g.id}>
              <legend className="mb-2 font-bold">
                {localized(g.label, locale)}{' '}
                <span className="text-sm font-normal text-hibiscus">
                  · {g.min > 0 ? dict['menu.required'] : g.max === 1 ? dict['menu.chooseOne'] : fill(dict, 'menu.chooseUpTo', { n: g.max })}
                </span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const on = (options[g.id] ?? []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={on}
                      disabled={o.soldOut}
                      onClick={() => toggle(g.id, o.id, g.max)}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold ${
                        on ? 'border-ink bg-ink text-cream' : 'border-ink/20'
                      } ${o.soldOut ? 'line-through opacity-40' : ''}`}
                    >
                      {localized(o.label, locale)}
                      {o.price > 0 && ` +${formatPrice(o.price, locale)}`}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {item.unit === 'lb' && (
            <Stepper
              label={dict['menu.weight']}
              value={fill(dict, 'menu.lb', { n: weight })}
              onMinus={() => setWeight((w) => Math.max(pricing.minWeightLb, w - pricing.weightStepLb))}
              onPlus={() => setWeight((w) => Math.min(6, w + pricing.weightStepLb))}
            />
          )}

          <Stepper
            label={dict['menu.quantity']}
            value={String(qty)}
            onMinus={() => setQty((q) => Math.max(1, q - 1))}
            onPlus={() => setQty((q) => Math.min(pricing.maxQtyPerLine, q + 1))}
          />

          <label className="block">
            <span className="mb-2 block font-bold">{dict['menu.note']}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={2}
              className="w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2"
            />
          </label>
        </div>

        <div className="fixed inset-x-0 bottom-0 bg-cream px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:sticky md:rounded-b-3xl">
          <button
            type="button"
            onClick={add}
            disabled={!check.ok}
            className="w-full rounded-full bg-hibiscus px-6 py-4 text-lg font-bold text-cream shadow-[4px_4px_0_var(--c-ink)] disabled:bg-ink/30 disabled:shadow-none"
          >
            {fill(dict, 'menu.addToOrder', { price: formatPrice(unit * qty, locale) })}
          </button>
          {missing === 'option_required' && <p className="mt-2 text-center text-sm text-hibiscus">{dict['menu.required']}</p>}
        </div>
      </div>
    </dialog>
  );
}

function Stepper(props: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-bold">{props.label}</span>
      <span className="flex items-center gap-4">
        <button type="button" onClick={props.onMinus} className="size-10 rounded-full border-2 border-ink text-xl font-bold" aria-label="−">
          −
        </button>
        <span className="min-w-12 text-center text-lg font-bold" aria-live="polite">
          {props.value}
        </span>
        <button type="button" onClick={props.onPlus} className="size-10 rounded-full border-2 border-ink text-xl font-bold" aria-label="+">
          +
        </button>
      </span>
    </div>
  );
}
