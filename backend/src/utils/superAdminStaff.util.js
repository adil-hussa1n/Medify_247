import SuperAdminStaff from '../models/SuperAdminStaff.model.js';
import {
  getPermissionsForRole,
  SUPER_ADMIN_PERMISSIONS
} from '../constants/superAdminPermissions.js';

export const resolveEffectivePermissions = (membership) => {
  if (!membership) return [];
  if (membership.role === 'owner') {
    return [...SUPER_ADMIN_PERMISSIONS];
  }
  if (membership.role === 'custom') {
    return (membership.permissions || []).filter((p) =>
      SUPER_ADMIN_PERMISSIONS.includes(p)
    );
  }
  const fromRole = getPermissionsForRole(membership.role);
  const extra = (membership.permissions || []).filter((p) =>
    SUPER_ADMIN_PERMISSIONS.includes(p)
  );
  return [...new Set([...fromRole, ...extra])];
};

export const getStaffMembershipForUser = async (userId) => {
  return SuperAdminStaff.findOne({ userId, isActive: true });
};
