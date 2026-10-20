/** Who may sign in to the admin, and as what. Owners only. */
import { useEffect, useState } from 'react';
import { ROLES, type Role } from '../../domain/roles';
import type { AdminDictionary } from '../../i18n/admin';
import { api } from './api';
import { button, Field, ghost, field, input } from './ui';

interface Member {
  email: string;
  name: string | null;
  role: Role;
}

/** The shared admin password: anyone who knows it signs in as an owner. */
function PasswordCard({ dict, needsCurrent }: { dict: AdminDictionary; needsCurrent: boolean }) {
  const [isDefault, setIsDefault] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'mismatch' | 'short' | 'wrong' | 'error'>('idle');
  useEffect(() => {
    api<{ isDefault: boolean }>('/password').then((r) => r.ok && setIsDefault(r.data.isDefault));
  }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (next.length < 8) return setStatus('short');
    if (next !== again) return setStatus('mismatch');
    setStatus('saving');
    const result = await api('/password', { method: 'PUT', body: { current, next } });
    if (result.ok) {
      setStatus('saved');
      setIsDefault(false);
      setCurrent('');
      setNext('');
      setAgain('');
    } else setStatus(result.fields.includes('current') ? 'wrong' : 'error');
  };
  const message = { mismatch: 'password.mismatch', short: 'password.short', wrong: 'password.wrong', error: 'common.error' } as const;
  return (
    <form id="password" onSubmit={save} className="mt-8 grid gap-3 rounded-xl bg-white p-4">
      <h2 className="font-display text-2xl uppercase">{dict['password.title']}</h2>
      <p className="text-sm text-ink/70">{dict['password.intro']}</p>
      {isDefault && <p className="rounded-lg bg-sunset/15 p-3 text-sm font-semibold">{dict['password.isDefault']}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {needsCurrent && (
          <Field label={dict['password.current']}>
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} required />
          </Field>
        )}
        <Field label={dict['password.new']}>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={input} required minLength={8} />
        </Field>
        <Field label={dict['password.again']}>
          <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={input} required />
        </Field>
      </div>
      <p className="flex flex-wrap items-center gap-3">
        <button type="submit" className={button} disabled={status === 'saving'}>
          {status === 'saving' ? dict['common.saving'] : dict['password.change']}
        </button>
        {status === 'saved' && <span className="font-semibold text-jungle">✓ {dict['common.saved']}</span>}
        {status in message && <span className="font-semibold text-hibiscus">{dict[message[status as keyof typeof message]]}</span>}
      </p>
    </form>
  );
}

export default function StaffAdmin({ dict, me, viaPassword }: { dict: AdminDictionary; me: string; viaPassword: boolean }) {
  const [staff, setStaff] = useState<Member[]>();
  const [owners, setOwners] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('kitchen');
  const [problem, setProblem] = useState(false);

  const load = async () => {
    const result = await api<{ staff: Member[]; owners: string[] }>('/staff');
    if (result.ok) {
      setStaff(result.data.staff);
      setOwners(result.data.owners);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await api('/staff', { body: { email, name, role } });
    setProblem(!result.ok);
    if (result.ok) {
      setEmail('');
      setName('');
      load();
    }
  };
  const remove = async (m: Member) => {
    if (!confirm(dict['common.confirmDelete'])) return;
    await api(`/staff/${encodeURIComponent(m.email)}`, { method: 'DELETE' });
    load();
  };
  const change = async (m: Member, next: Role) => {
    await api('/staff', { body: { email: m.email, name: m.name, role: next } });
    load();
  };

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl uppercase">{dict['staff.title']}</h1>
      <p className="mt-2 text-sm text-ink/70">{dict['staff.intro']}</p>

      <ul className="mt-6 divide-y divide-ink/10 rounded-xl bg-white">
        {owners.map((o) => (
          <li key={o} className="flex flex-wrap items-center gap-3 p-3">
            <span className="flex-1 font-semibold">{o}</span>
            <span className="text-sm text-ink/60">{dict['staff.ownerVar']}</span>
          </li>
        ))}
        {staff?.map((m) => (
          <li key={m.email} className="flex flex-wrap items-center gap-3 p-3">
            <span className="min-w-48 flex-1">
              <span className="font-semibold">{m.email}</span>
              {m.name && <span className="block text-sm text-ink/60">{m.name}</span>}
            </span>
            <select value={m.role} onChange={(e) => change(m, e.target.value as Role)} className={`${field} w-auto`} disabled={m.email === me}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {dict[`staff.role.${r}`]}
                </option>
              ))}
            </select>
            {m.email !== me && (
              <button type="button" className={`${ghost} text-hibiscus`} onClick={() => remove(m)}>
                {dict['common.remove']}
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="mt-6 grid gap-3 rounded-xl bg-white p-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
        <Field label={dict['staff.email']}>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </Field>
        <Field label={dict['staff.name']}>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </Field>
        <Field label={dict['staff.role']}>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={input}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {dict[`staff.role.${r}`]}
              </option>
            ))}
          </select>
        </Field>
        <button type="submit" className={button}>
          + {dict['common.add']}
        </button>
        {problem && <p className="font-semibold text-hibiscus md:col-span-4">{dict['common.error']}</p>}
      </form>

      <PasswordCard dict={dict} needsCurrent={viaPassword} />
    </div>
  );
}
