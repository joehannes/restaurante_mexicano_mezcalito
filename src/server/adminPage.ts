/** What each /admin page needs: the staff member, their language, and a permission check. */
import type { AstroGlobal } from 'astro';
import { can, type Permission } from '../domain/roles';
import { adminDictionary, adminLocale } from '../i18n/admin';

export function adminPage(Astro: AstroGlobal, permission: Permission) {
  const staff = Astro.locals.staff!;
  if (!can(staff.role, permission)) return undefined;
  const locale = adminLocale(Astro.request);
  return { staff, locale, dict: adminDictionary(locale) };
}

export const forbidden = () => new Response('Your role cannot open this page.', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
