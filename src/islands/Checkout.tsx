/**
 * Checkout: the cart, how and when, who, how to pay — on one screen, so a
 * returning guest is three taps from "Place order". Totals use the same
 * `priceCart` as the server, and the server prices the order again anyway.
 */
import { useEffect, useMemo, useState } from 'react';
import type { FieldError, PaymentMethod } from '../domain/orderInput';
import { priceCart } from '../domain/pricing';
import type { Locale, MenuItem, OrderMode, PricingSettings } from '../domain/types';
import { localized } from '../domain/types';
import { fill, type Dictionary } from '../i18n/fill';
import { clearCart, rememberOrder, removeLine, setQty, type StoredLine } from '../lib/cart';
import { formatClock, formatPrice, formatUsd, usdCharge } from '../lib/format';
import { useCart } from './useCart';

interface Props {
  locale: Locale;
  dict: Dictionary;
  menu: MenuItem[];
  pricing: PricingSettings;
  /** HH:MM pickup times still possible today. */
  slots: string[];
  open: boolean;
  /** "today at 8 am", when closed. */
  opensWhen?: string;
  deliveryAvailable: boolean;
  uberEatsUrl?: string;
  menuHref: string;
  orderHref: string;
  /** Online payment providers that are set up; none hides paying online. */
  onlineProviders: ('azul' | 'paypal')[];
}

type PayChoice = Exclude<PaymentMethod, 'online'> | 'azul' | 'paypal';

const PROFILE_KEY = 'mezcalito.guest.v1';

export default function Checkout(props: Props) {
  const { locale, dict, menu, pricing } = props;
  const cart = useCart();
  const byId = useMemo(() => new Map(menu.map((i) => [i.id, i])), [menu]);

  const [mode, setMode] = useState<OrderMode>('pickup');
  const [when, setWhen] = useState(props.open ? 'asap' : (props.slots[0] ?? 'asap'));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [reference, setReference] = useState('');
  const [table, setTable] = useState('');
  const [notes, setNotes] = useState('');
  const [choice, setChoice] = useState<PayChoice>('cash');
  const payment: PaymentMethod = choice === 'azul' || choice === 'paypal' ? 'online' : choice;
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [problem, setProblem] = useState<string>();
  const [sending, setSending] = useState(false);

  // A returning guest's name and number, and the table from a QR code.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}') as { name?: string; phone?: string };
      if (saved.name) setName(saved.name);
      if (saved.phone) setPhone(saved.phone);
    } catch {}
    let t = new URLSearchParams(location.search).get('t');
    try {
      t ??= sessionStorage.getItem('mezcalito.table');
    } catch {}
    if (t) {
      setMode('dine_in');
      setTable(t.slice(0, 12));
    }
  }, []);

  const priced = priceCart(menu, cart, pricing, mode === 'delivery' ? 'pickup' : mode);
  const badLines = new Set(priced.ok ? [] : priced.errors.filter((e) => e.line >= 0).map((e) => e.line));
  const canOrder = cart.length > 0 && priced.ok && (props.open || props.slots.length > 0) && (mode !== 'delivery' || props.deliveryAvailable);

  const describe = (line: StoredLine) => {
    const item = byId.get(line.itemId);
    if (!item) return '';
    const parts: string[] = [];
    const variant = item.variants?.find((v) => v.id === line.variantId);
    if (variant) parts.push(localized(variant.label, locale));
    for (const g of item.modifierGroups ?? []) {
      for (const id of line.options?.[g.id] ?? []) {
        const o = g.options.find((x) => x.id === id);
        if (o) parts.push(localized(o.label, locale));
      }
    }
    if (line.weightLb) parts.push(fill(dict, 'menu.lb', { n: line.weightLb }));
    if (line.note) parts.push(`“${line.note}”`);
    return parts.join(' · ');
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors([]);
    setProblem(undefined);
    setSending(true);
    const website = (new FormData(event.currentTarget).get('website') as string) ?? '';
    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locale,
          mode,
          lines: cart.map(({ key: _key, ...line }) => line),
          name,
          phone,
          email,
          address: mode === 'delivery' ? { street, reference } : undefined,
          table,
          notes,
          payment,
          when,
          website,
        }),
      });
      const body = (await response.json()) as { code?: string; key?: string; error?: string; fields?: FieldError[] };
      if (response.ok && body.code) {
        try {
          localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, phone }));
        } catch {}
        rememberOrder(cart);
        clearCart();
        location.href =
          payment === 'online' ? `/api/pay/${body.code}?k=${body.key}&p=${choice}` : `${props.orderHref}/${body.code}?k=${body.key}`;
        return;
      }
      if (body.fields) {
        setErrors(body.fields);
        setProblem(dict['checkout.fix']);
      } else if (body.error === 'closed') setProblem(fill(dict, 'checkout.closed', { when: props.opensWhen ?? '' }));
      else if (body.error === 'outside_delivery_zone') setProblem(dict['checkout.noDelivery']);
      else if (body.error === 'pricing') setProblem(dict['cart.unavailable']);
      else setProblem(dict['checkout.error']);
    } catch {
      setProblem(dict['checkout.error']);
    }
    setSending(false);
  };

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-lg">{dict['cart.empty']}</p>
        <a href={props.menuHref} className="mt-6 inline-block rounded-full bg-hibiscus px-6 py-3 font-bold text-cream">
          {dict['nav.menu']}
        </a>
      </div>
    );
  }

  const field = (key: FieldError) => (errors.includes(key) ? 'border-hibiscus bg-hibiscus/5' : 'border-ink/15 bg-white');

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-8 px-4 pb-40 md:grid-cols-[1fr_22rem]" noValidate>
      <div className="space-y-8">
        <section>
          <h2 className="font-display text-2xl uppercase">{dict['cart.title']}</h2>
          <ul className="mt-3 divide-y divide-ink/10 rounded-2xl bg-white">
            {cart.map((line, index) => {
              const item = byId.get(line.itemId);
              const one = priceCart(menu, [line], pricing, 'pickup');
              return (
                <li key={line.key} className={`flex items-start gap-3 p-4 ${badLines.has(index) ? 'bg-hibiscus/5' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item ? localized(item.name, locale) : line.itemId}</p>
                    <p className="text-sm text-ink/70">{describe(line)}</p>
                    {badLines.has(index) && <p className="text-sm font-semibold text-hibiscus">{dict['cart.unavailable']}</p>}
                    <div className="mt-2 flex items-center gap-3 text-sm">
                      <button type="button" className="size-8 rounded-full border-2 border-ink font-bold" onClick={() => setQty(line.key, line.qty - 1)} aria-label="−">
                        −
                      </button>
                      <span className="w-6 text-center font-bold">{line.qty}</span>
                      <button type="button" className="size-8 rounded-full border-2 border-ink font-bold" onClick={() => setQty(line.key, line.qty + 1)} aria-label="+">
                        +
                      </button>
                      <button type="button" className="ml-2 underline" onClick={() => removeLine(line.key)}>
                        {dict['cart.remove']}
                      </button>
                    </div>
                  </div>
                  <p className="font-bold">{one.ok ? formatPrice(one.subtotal, locale) : '—'}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl uppercase">{dict['checkout.how']}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup">
            {(['pickup', 'delivery', 'dine_in'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-xl border-2 px-3 py-3 font-bold ${mode === m ? 'border-ink bg-gold' : 'border-ink/15 bg-white'}`}
              >
                {dict[`checkout.mode.${m}`]}
              </button>
            ))}
          </div>
          {mode === 'delivery' && !props.deliveryAvailable && (
            <p className="mt-3 rounded-xl bg-sunset/10 p-3 text-sm">
              {dict['checkout.noDelivery']}{' '}
              {props.uberEatsUrl && (
                <a className="font-bold underline" href={props.uberEatsUrl}>
                  Uber Eats →
                </a>
              )}
            </p>
          )}
          {mode === 'delivery' && props.deliveryAvailable && (
            <div className="mt-3 grid gap-3">
              <Input label={dict['checkout.address']} value={street} onChange={setStreet} className={field('address')} autoComplete="street-address" />
              <Input label={dict['checkout.reference']} value={reference} onChange={setReference} className={field('address')} />
            </div>
          )}
          {mode === 'dine_in' && (
            <div className="mt-3">
              <Input label={dict['checkout.table']} value={table} onChange={setTable} className={field('table')} inputMode="numeric" />
            </div>
          )}
        </section>

        {mode !== 'dine_in' && (
          <section>
            <h2 className="font-display text-2xl uppercase">{dict['checkout.when']}</h2>
            {!props.open && <p className="mt-2 text-sm">{fill(dict, 'checkout.closed', { when: props.opensWhen ?? '' })}</p>}
            <select
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className={`mt-3 w-full rounded-xl border-2 px-3 py-3 ${field('when')}`}
              aria-label={dict['checkout.when']}
            >
              {props.open && <option value="asap">{dict['checkout.asap']}</option>}
              {props.slots.map((s) => (
                <option key={s} value={s}>
                  {formatClock(s, locale)}
                </option>
              ))}
            </select>
          </section>
        )}

        <section>
          <h2 className="font-display text-2xl uppercase">{dict['checkout.you']}</h2>
          <div className="mt-3 grid gap-3">
            <Input label={dict['checkout.name']} value={name} onChange={setName} className={field('name')} autoComplete="name" required />
            <Input
              label={dict['checkout.phone']}
              hint={dict['checkout.phoneHint']}
              value={phone}
              onChange={setPhone}
              className={field('phone')}
              autoComplete="tel"
              inputMode="tel"
              type="tel"
              required
            />
            <Input label={dict['checkout.email']} value={email} onChange={setEmail} className={field('email')} autoComplete="email" type="email" />
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{dict['checkout.notes']}</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className="w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2" />
            </label>
            {/* Honeypot: hidden from people, irresistible to bots. */}
            <input name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0" aria-hidden="true" />
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl uppercase">{dict['checkout.pay']}</h2>
          <div className="mt-3 grid gap-2">
            {(['cash', 'card_on_delivery', ...props.onlineProviders] as const).map((p) => (
              <label key={p} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 font-semibold ${choice === p ? 'border-ink bg-gold' : 'border-ink/15 bg-white'}`}>
                <input type="radio" name="payment" className="accent-ink" checked={choice === p} onChange={() => setChoice(p)} />
                {p === 'paypal'
                  ? fill(dict, 'checkout.pay.paypal', { usd: priced.ok ? `US$${usdCharge(priced.total, pricing.usdRate)}` : 'US$' })
                  : dict[`checkout.pay.${p}`]}
              </label>
            ))}
            {props.onlineProviders.length === 0 && <p className="px-1 text-sm text-ink/60">{dict['checkout.pay.onlineSoon']}</p>}
          </div>
        </section>
      </div>

      <aside className="md:sticky md:top-20 md:self-start">
        <div className="rounded-2xl bg-ink p-5 text-cream">
          {priced.ok && (
            <dl className="space-y-1 text-sm">
              <Row label={dict['cart.subtotal']} value={formatPrice(priced.subtotal, locale)} />
              <Row label={dict['cart.itbis']} value={formatPrice(priced.itbis, locale)} />
              {priced.service > 0 && <Row label={dict['cart.service']} value={formatPrice(priced.service, locale)} />}
              <div className="mt-2 flex justify-between border-t border-cream/20 pt-2 text-lg font-bold">
                <dt>{dict['cart.total']}</dt>
                <dd>{formatPrice(priced.total, locale)}</dd>
              </div>
              <p className="text-right text-xs text-cream/60">{formatUsd(priced.total, pricing.usdRate, locale)}</p>
            </dl>
          )}
          {problem && (
            <p role="alert" className="mt-4 rounded-xl bg-hibiscus/20 p-3 text-sm">
              {problem}
            </p>
          )}
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-6">
        <button
          type="submit"
          disabled={!canOrder || sending}
          className="mx-auto block w-full max-w-md rounded-full bg-hibiscus px-6 py-4 text-lg font-bold text-cream shadow-[4px_4px_0_var(--c-ink)] disabled:bg-ink/40 disabled:shadow-none"
        >
          {sending ? dict[payment === 'online' ? 'checkout.paying' : 'checkout.placing'] : fill(dict, 'checkout.place', { total: priced.ok ? formatPrice(priced.total, locale) : '' })}
        </button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-cream/80">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Input(props: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  className: string;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{props.label}</span>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        required={props.required}
        className={`w-full rounded-xl border-2 px-3 py-3 ${props.className}`}
      />
      {props.hint && <span className="mt-1 block text-xs text-ink/60">{props.hint}</span>}
    </label>
  );
}
