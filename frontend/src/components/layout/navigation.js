import { CalendarClock, CalendarPlus, ClipboardList, LayoutDashboard, Settings2, Users } from 'lucide-react';
import { ROLES } from '../../lib/constants.js';

const { SUPER_ADMIN, RECEPTIONIST, DOCTOR } = ROLES;

/** Single source for the sidebar; each entry lists the roles that see it. */
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: [SUPER_ADMIN, RECEPTIONIST, DOCTOR], end: true },
  { to: '/scheduler', label: 'Scheduler', icon: CalendarClock, roles: [SUPER_ADMIN, RECEPTIONIST, DOCTOR] },
  { to: '/appointments/new', label: 'Book appointment', icon: CalendarPlus, roles: [SUPER_ADMIN, RECEPTIONIST] },
  { to: '/appointments', label: 'Appointments', icon: ClipboardList, roles: [SUPER_ADMIN, RECEPTIONIST, DOCTOR], end: true },
  { to: '/admin/staff', label: 'Staff', icon: Users, roles: [SUPER_ADMIN] },
  { to: '/admin/schedules', label: 'Doctor schedules', icon: Settings2, roles: [SUPER_ADMIN] },
];
