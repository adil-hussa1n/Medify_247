/** Granular permissions for diagnostic center RBAC */
export const DC_PERMISSIONS = [
  'dashboard:view',
  'profile:view',
  'profile:manage',
  'tests:view',
  'tests:manage',
  'orders:view',
  'orders:manage',
  'home_services:view',
  'home_services:manage',
  'home_requests:view',
  'home_requests:manage',
  'home_serials:view',
  'home_serials:manage',
  'test_serials:view',
  'test_serials:manage',
  'doctors:view',
  'doctors:manage',
  'staff:view',
  'staff:manage'
];

export const DC_ROLE_KEYS = [
  'owner',
  'admin',
  'manager',
  'lab_staff',
  'receptionist',
  'viewer',
  'custom'
];

const ALL = [...DC_PERMISSIONS];

export const DC_ROLE_TEMPLATES = {
  owner: ALL,
  admin: [...ALL],
  manager: [
    'dashboard:view',
    'profile:view',
    'tests:view',
    'tests:manage',
    'orders:view',
    'orders:manage',
    'home_services:view',
    'home_services:manage',
    'home_requests:view',
    'home_requests:manage',
    'home_serials:view',
    'home_serials:manage',
    'test_serials:view',
    'test_serials:manage',
    'doctors:view',
    'doctors:manage'
  ],
  lab_staff: [
    'dashboard:view',
    'tests:view',
    'tests:manage',
    'orders:view',
    'orders:manage',
    'test_serials:view',
    'test_serials:manage',
    'home_services:view'
  ],
  receptionist: [
    'dashboard:view',
    'home_services:view',
    'home_requests:view',
    'home_requests:manage',
    'home_serials:view',
    'home_serials:manage',
    'orders:view'
  ],
  viewer: ALL.filter((p) => p.endsWith(':view') || p === 'dashboard:view'),
  custom: []
};

export const DC_ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Administrator',
  manager: 'Manager',
  lab_staff: 'Lab Staff',
  receptionist: 'Receptionist',
  viewer: 'Viewer (read-only)',
  custom: 'Custom'
};

export const getPermissionsForRole = (roleKey, customPermissions = []) => {
  if (roleKey === 'custom') {
    return customPermissions.filter((p) => DC_PERMISSIONS.includes(p));
  }
  return [...(DC_ROLE_TEMPLATES[roleKey] || [])];
};

export const hasPermission = (userPermissions, required) => {
  if (!required) return true;
  if (!userPermissions?.length) return false;
  if (userPermissions.includes('*')) return true;
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((perm) => userPermissions.includes(perm));
};
