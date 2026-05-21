/** All granular permissions for hospital RBAC */
export const HOSPITAL_PERMISSIONS = [
  'dashboard:view',
  'profile:view',
  'profile:manage',
  'doctors:view',
  'doctors:manage',
  'appointments:view',
  'appointments:manage',
  'home_services:view',
  'home_services:manage',
  'home_requests:view',
  'home_requests:manage',
  'home_serials:view',
  'home_serials:manage',
  'tests:view',
  'tests:manage',
  'test_serials:view',
  'test_serials:manage',
  'staff:view',
  'staff:manage'
];

export const HOSPITAL_ROLE_KEYS = [
  'owner',
  'admin',
  'manager',
  'receptionist',
  'lab_staff',
  'viewer',
  'custom'
];

const ALL = [...HOSPITAL_PERMISSIONS];

export const HOSPITAL_ROLE_TEMPLATES = {
  owner: ALL,
  admin: [...ALL],
  manager: [
    'dashboard:view',
    'profile:view',
    'doctors:view',
    'doctors:manage',
    'appointments:view',
    'appointments:manage',
    'home_services:view',
    'home_services:manage',
    'home_requests:view',
    'home_requests:manage',
    'home_serials:view',
    'home_serials:manage',
    'tests:view',
    'tests:manage',
    'test_serials:view',
    'test_serials:manage'
  ],
  receptionist: [
    'dashboard:view',
    'appointments:view',
    'appointments:manage',
    'home_requests:view',
    'home_requests:manage',
    'home_serials:view',
    'home_services:view'
  ],
  lab_staff: [
    'dashboard:view',
    'tests:view',
    'tests:manage',
    'test_serials:view',
    'test_serials:manage',
    'home_services:view'
  ],
  viewer: ALL.filter((p) => p.endsWith(':view') || p === 'dashboard:view'),
  custom: []
};

export const HOSPITAL_ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Administrator',
  manager: 'Manager',
  receptionist: 'Receptionist',
  lab_staff: 'Lab Staff',
  viewer: 'Viewer (read-only)',
  custom: 'Custom'
};

export const getPermissionsForRole = (roleKey, customPermissions = []) => {
  if (roleKey === 'custom') {
    return customPermissions.filter((p) => HOSPITAL_PERMISSIONS.includes(p));
  }
  return [...(HOSPITAL_ROLE_TEMPLATES[roleKey] || [])];
};

export const hasPermission = (userPermissions, required) => {
  if (!required) return true;
  if (!userPermissions?.length) return false;
  if (userPermissions.includes('*')) return true;
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((perm) => userPermissions.includes(perm));
};
