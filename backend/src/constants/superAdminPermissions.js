/** Granular permissions for platform super-admin RBAC */
export const SUPER_ADMIN_PERMISSIONS = [
  'dashboard:view',
  'approvals:view',
  'approvals:manage',
  'users:view',
  'users:manage',
  'doctors:view',
  'doctors:manage',
  'hospitals:view',
  'hospitals:manage',
  'diagnostic_centers:view',
  'diagnostic_centers:manage',
  'banners:view',
  'banners:manage',
  'notifications:broadcast',
  'activity_logs:view',
  'export:data',
  'team:view',
  'team:manage'
];

export const SUPER_ADMIN_ROLE_KEYS = [
  'owner',
  'admin',
  'support',
  'moderator',
  'content_manager',
  'viewer',
  'custom'
];

const ALL = [...SUPER_ADMIN_PERMISSIONS];

export const SUPER_ADMIN_ROLE_TEMPLATES = {
  owner: ALL,
  admin: ALL.filter((p) => p !== 'team:manage'),
  support: [
    'dashboard:view',
    'approvals:view',
    'approvals:manage',
    'users:view',
    'users:manage',
    'doctors:view',
    'activity_logs:view'
  ],
  moderator: [
    'dashboard:view',
    'approvals:view',
    'approvals:manage',
    'users:view',
    'doctors:view',
    'doctors:manage',
    'hospitals:view',
    'diagnostic_centers:view',
    'activity_logs:view'
  ],
  content_manager: [
    'dashboard:view',
    'banners:view',
    'banners:manage',
    'notifications:broadcast'
  ],
  viewer: ALL.filter((p) => p.endsWith(':view') || p === 'dashboard:view'),
  custom: []
};

export const SUPER_ADMIN_ROLE_LABELS = {
  owner: 'Super Admin (Owner)',
  admin: 'Platform Administrator',
  support: 'Support Agent',
  moderator: 'Moderator',
  content_manager: 'Content Manager',
  viewer: 'Viewer (read-only)',
  custom: 'Custom'
};

export const getPermissionsForRole = (roleKey, customPermissions = []) => {
  if (roleKey === 'custom') {
    return customPermissions.filter((p) => SUPER_ADMIN_PERMISSIONS.includes(p));
  }
  return [...(SUPER_ADMIN_ROLE_TEMPLATES[roleKey] || [])];
};

export const hasPermission = (userPermissions, required) => {
  if (!required) return true;
  if (!userPermissions?.length) return false;
  if (userPermissions.includes('*')) return true;
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((perm) => userPermissions.includes(perm));
};
