export const SUPER_ADMIN_PERMISSIONS = [
  { key: 'dashboard:view', label: 'View dashboard & analytics', group: 'General' },
  { key: 'approvals:view', label: 'View pending approvals', group: 'Approvals' },
  { key: 'approvals:manage', label: 'Approve or reject registrations', group: 'Approvals' },
  { key: 'users:view', label: 'View platform users', group: 'Users' },
  { key: 'users:manage', label: 'Edit or delete users', group: 'Users' },
  { key: 'doctors:view', label: 'View doctors', group: 'Doctors' },
  { key: 'doctors:manage', label: 'Manage doctors', group: 'Doctors' },
  { key: 'hospitals:view', label: 'View hospitals', group: 'Hospitals' },
  { key: 'hospitals:manage', label: 'Manage hospitals', group: 'Hospitals' },
  { key: 'diagnostic_centers:view', label: 'View diagnostic centers', group: 'Diagnostic Centers' },
  { key: 'diagnostic_centers:manage', label: 'Manage diagnostic centers', group: 'Diagnostic Centers' },
  { key: 'banners:view', label: 'View banners', group: 'Content' },
  { key: 'banners:manage', label: 'Manage banners', group: 'Content' },
  { key: 'notifications:broadcast', label: 'Broadcast notifications', group: 'Content' },
  { key: 'activity_logs:view', label: 'View activity logs', group: 'Audit' },
  { key: 'export:data', label: 'Export data', group: 'Data' },
  { key: 'team:view', label: 'View admin team', group: 'Team' },
  { key: 'team:manage', label: 'Manage admin team & permissions', group: 'Team' }
];

export const TAB_PERMISSIONS = {
  overview: 'dashboard:view',
  pending: 'approvals:view',
  banners: 'banners:view',
  notifications: 'notifications:broadcast',
  users: 'users:view',
  doctors: 'doctors:view',
  hospitals: 'hospitals:view',
  'diagnostic-centers': 'diagnostic_centers:view',
  'activity-logs': 'activity_logs:view',
  export: 'export:data',
  team: 'team:view'
};

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Platform Administrator' },
  { value: 'support', label: 'Support Agent' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'content_manager', label: 'Content Manager' },
  { value: 'viewer', label: 'Viewer (read-only)' },
  { value: 'custom', label: 'Custom permissions' }
];

export const canAccess = (permissions, required) => {
  if (!permissions?.length) return false;
  if (permissions.includes('*')) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.every((perm) => permissions.includes(perm));
};

export const ALL_PERMISSION_KEYS = SUPER_ADMIN_PERMISSIONS.map((p) => p.key);

export const canAccessTab = (permissions, tabKey) => {
  const required = TAB_PERMISSIONS[tabKey];
  return required ? canAccess(permissions, required) : true;
};

export const isPlatformAdmin = (role) =>
  role === 'super_admin' || role === 'super_admin_staff';
