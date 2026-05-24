/** Granular permissions for individual doctor practice RBAC */
export const DOCTOR_PERMISSIONS = [
  'dashboard:view',
  'profile:view',
  'profile:manage',
  'appointments:view',
  'appointments:manage',
  'schedules:view',
  'schedules:manage',
  'prescriptions:manage',
  'serials:view',
  'serials:manage',
  'date_serials:view',
  'date_serials:manage',
  'earnings:view',
  'staff:view',
  'staff:manage'
];

export const DOCTOR_ROLE_KEYS = [
  'owner',
  'admin',
  'assistant',
  'receptionist',
  'viewer',
  'custom'
];

const ALL = [...DOCTOR_PERMISSIONS];

export const DOCTOR_ROLE_TEMPLATES = {
  owner: ALL,
  admin: [...ALL],
  assistant: [
    'dashboard:view',
    'profile:view',
    'appointments:view',
    'appointments:manage',
    'schedules:view',
    'serials:view',
    'serials:manage',
    'date_serials:view',
    'date_serials:manage',
    'prescriptions:manage'
  ],
  receptionist: [
    'dashboard:view',
    'profile:view',
    'appointments:view',
    'appointments:manage',
    'serials:view',
    'schedules:view'
  ],
  viewer: ALL.filter((p) => p.endsWith(':view') || p === 'dashboard:view'),
  custom: []
};

export const DOCTOR_ROLE_LABELS = {
  owner: 'Owner (Doctor)',
  admin: 'Administrator',
  assistant: 'Clinical Assistant',
  receptionist: 'Receptionist',
  viewer: 'Viewer (read-only)',
  custom: 'Custom'
};

export const getPermissionsForRole = (roleKey, customPermissions = []) => {
  if (roleKey === 'custom') {
    return customPermissions.filter((p) => DOCTOR_PERMISSIONS.includes(p));
  }
  return [...(DOCTOR_ROLE_TEMPLATES[roleKey] || [])];
};

export const hasPermission = (userPermissions, required) => {
  if (!required) return true;
  if (!userPermissions?.length) return false;
  if (userPermissions.includes('*')) return true;
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((perm) => userPermissions.includes(perm));
};
