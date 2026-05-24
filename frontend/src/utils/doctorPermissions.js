export const DOCTOR_PERMISSIONS = [
  { key: 'dashboard:view', label: 'View dashboard', group: 'General' },
  { key: 'profile:view', label: 'View profile', group: 'General' },
  { key: 'profile:manage', label: 'Edit profile', group: 'General' },
  { key: 'appointments:view', label: 'View appointments', group: 'Appointments' },
  { key: 'appointments:manage', label: 'Manage appointments', group: 'Appointments' },
  { key: 'schedules:view', label: 'View schedule', group: 'Schedule' },
  { key: 'schedules:manage', label: 'Manage schedule', group: 'Schedule' },
  { key: 'prescriptions:manage', label: 'Manage prescriptions', group: 'Clinical' },
  { key: 'serials:view', label: 'View serial settings', group: 'Serials' },
  { key: 'serials:manage', label: 'Manage serial settings', group: 'Serials' },
  { key: 'date_serials:view', label: 'View date serial overrides', group: 'Serials' },
  { key: 'date_serials:manage', label: 'Manage date serial overrides', group: 'Serials' },
  { key: 'earnings:view', label: 'View earnings', group: 'Finance' },
  { key: 'staff:view', label: 'View team members', group: 'Team' },
  { key: 'staff:manage', label: 'Manage team & permissions', group: 'Team' }
];

export const TAB_PERMISSIONS = {
  overview: 'dashboard:view',
  appointments: 'appointments:view',
  'serial-settings': 'serials:view',
  'date-management': 'date_serials:view',
  schedule: 'schedules:view',
  profile: 'profile:view',
  staff: 'staff:view'
};

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrator (full access)' },
  { value: 'assistant', label: 'Clinical Assistant' },
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

export const ALL_PERMISSION_KEYS = DOCTOR_PERMISSIONS.map((p) => p.key);

export const canAccessTab = (permissions, tabKey) => {
  const required = TAB_PERMISSIONS[tabKey];
  return required ? canAccess(permissions, required) : true;
};
