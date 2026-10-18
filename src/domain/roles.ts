/**
 * Who on the staff may do what. The kitchen sees the orders board and can
 * mark dishes sold out; managers run the menu, nights, bookings, seasons and
 * settings; only the owner manages who has access.
 */
export const ROLES = ['owner', 'manager', 'kitchen'] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | 'orders'
  | 'soldout'
  | 'menu'
  | 'nights'
  | 'reservations'
  | 'seasons'
  | 'radio'
  | 'insights'
  | 'settings'
  | 'staff';

const GRANTS: Record<Role, readonly Permission[]> = {
  kitchen: ['orders', 'soldout'],
  manager: ['orders', 'soldout', 'menu', 'nights', 'reservations', 'seasons', 'radio', 'insights', 'settings'],
  owner: ['orders', 'soldout', 'menu', 'nights', 'reservations', 'seasons', 'radio', 'insights', 'settings', 'staff'],
};

export const can = (role: Role, permission: Permission) => GRANTS[role].includes(permission);

export const isRole = (value: unknown): value is Role => ROLES.includes(value as Role);
