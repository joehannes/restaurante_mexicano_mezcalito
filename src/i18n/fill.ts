/**
 * Placeholder filling without the dictionaries, for islands: a page passes
 * its locale's dictionary as a prop, so the browser never downloads the
 * other three languages.
 */
import type { UiKey } from './en';

export type Dictionary = Record<UiKey, string>;

export const fill = (dict: Dictionary, key: UiKey, vars: Record<string, string | number> = {}) =>
  dict[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
