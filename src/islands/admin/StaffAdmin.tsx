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

export default function StaffAdmin({ dict, me }: { dict: AdminDictionary; me: string }) {
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
    </div>
  );
}
