export const DC_PERMISSIONS = [
  { key: 'dashboard:view', label: 'View dashboard', group: 'General' },
  { key: 'profile:view', label: 'View center profile', group: 'General' },
  { key: 'profile:manage', label: 'Edit center profile', group: 'General' },
  { key: 'tests:view', label: 'View tests', group: 'Tests' },
  { key: 'tests:manage', label: 'Manage tests', group: 'Tests' },
  { key: 'orders:view', label: 'View orders', group: 'Orders' },
  { key: 'orders:manage', label: 'Manage orders', group: 'Orders' },
  { key: 'home_services:view', label: 'View home services', group: 'Home Services' },
  { key: 'home_services:manage', label: 'Manage home services', group: 'Home Services' },
  { key: 'home_requests:view', label: 'View service requests', group: 'Home Services' },
  { key: 'home_requests:manage', label: 'Manage service requests', group: 'Home Services' },
  { key: 'home_serials:view', label: 'View home serial bookings', group: 'Home Services' },
  { key: 'home_serials:manage', label: 'Manage home serials', group: 'Home Services' },
  { key: 'test_serials:view', label: 'View test serial bookings', group: 'Tests' },
  { key: 'test_serials:manage', label: 'Manage test serials', group: 'Tests' },
  { key: 'doctors:view', label: 'View doctors', group: 'Doctors' },
  { key: 'doctors:manage', label: 'Manage doctors', group: 'Doctors' },
  { key: 'staff:view', label: 'View team members', group: 'Team' },
  { key: 'staff:manage', label: 'Manage team & permissions', group: 'Team' }
];

export const TAB_PERMISSIONS = {
  overview: 'dashboard:view',
  tests: 'tests:view',
  orders: 'orders:view',
  'home-services': 'home_services:view',
  requests: 'home_requests:view',
  'home-serial-bookings': 'home_serials:view',
  doctors: 'doctors:view',
  staff: 'staff:view'
};

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrator (full access)' },
  { value: 'manager', label: 'Manager' },
  { value: 'lab_staff', label: 'Lab Staff' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'viewer', label: 'Viewer (read-only)' },
  { value: 'custom', label: 'Custom permissions' }
];

export const canAccess = (permissions, required) => {
  if (!permissions?.length) return false;
  if (permissions.includes('*')) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.every((perm) => permissions.includes(perm));
};

export const canAccessTab = (permissions, tabKey) => {
  const required = TAB_PERMISSIONS[tabKey];
  return required ? canAccess(permissions, required) : true;
};
