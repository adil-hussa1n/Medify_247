import DiagnosticCenter from '../models/DiagnosticCenter.model.js';
import DiagnosticCenterStaff from '../models/DiagnosticCenterStaff.model.js';
import { getPermissionsForRole, DC_PERMISSIONS } from '../constants/diagnosticCenterPermissions.js';

export const isDiagnosticCenterAdminId = (center, userId) => {
  if (!center?.admins?.length || !userId) return false;
  const uid = userId.toString();
  return center.admins.some((id) => id.toString() === uid);
};

/** Ensure legacy diagnosticCenter.admins have a staff record */
export const ensureDiagnosticCenterStaffMembership = async (center, userId) => {
  let membership = await DiagnosticCenterStaff.findOne({
    diagnosticCenterId: center._id,
    userId
  });

  if (membership) {
    return membership;
  }

  const uid = userId.toString();
  const isPrimaryOwner = center.userId?.toString() === uid;
  const isLegacyAdmin = isDiagnosticCenterAdminId(center, userId);

  if (!isPrimaryOwner && !isLegacyAdmin) {
    return null;
  }

  const role = isPrimaryOwner ? 'owner' : 'admin';
  membership = await DiagnosticCenterStaff.create({
    diagnosticCenterId: center._id,
    userId,
    role,
    permissions: getPermissionsForRole(role),
    isActive: true
  });

  if (!isDiagnosticCenterAdminId(center, userId)) {
    center.admins = center.admins || [];
    center.admins.push(userId);
    await center.save();
  }

  return membership;
};

export const resolveEffectivePermissions = (membership) => {
  if (!membership) return [];
  if (membership.role === 'owner') {
    return [...DC_PERMISSIONS];
  }
  if (membership.role === 'custom') {
    return (membership.permissions || []).filter((p) => DC_PERMISSIONS.includes(p));
  }
  const fromRole = getPermissionsForRole(membership.role);
  const extra = (membership.permissions || []).filter((p) => DC_PERMISSIONS.includes(p));
  return [...new Set([...fromRole, ...extra])];
};

export const findDiagnosticCenterForUser = async (userId) => {
  const owned = await DiagnosticCenter.findOne({ userId });
  if (owned) return owned;

  const membership = await DiagnosticCenterStaff.findOne({ userId, isActive: true });
  if (!membership) return null;

  return DiagnosticCenter.findById(membership.diagnosticCenterId);
};
