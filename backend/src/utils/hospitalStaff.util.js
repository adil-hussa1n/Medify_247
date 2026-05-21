import Hospital from '../models/Hospital.model.js';
import HospitalStaff from '../models/HospitalStaff.model.js';
import { getPermissionsForRole, HOSPITAL_PERMISSIONS } from '../constants/hospitalPermissions.js';

export const isHospitalAdminId = (hospital, userId) => {
  if (!hospital?.admins?.length || !userId) return false;
  const uid = userId.toString();
  return hospital.admins.some((id) => id.toString() === uid);
};

/** Ensure legacy hospital.admins have a staff record (owner for primary user) */
export const ensureHospitalStaffMembership = async (hospital, userId) => {
  let membership = await HospitalStaff.findOne({
    hospitalId: hospital._id,
    userId
  });

  if (membership) {
    return membership;
  }

  const uid = userId.toString();
  const isPrimaryOwner = hospital.userId?.toString() === uid;
  const isLegacyAdmin = isHospitalAdminId(hospital, userId);

  if (!isPrimaryOwner && !isLegacyAdmin) {
    return null;
  }

  const role = isPrimaryOwner ? 'owner' : 'admin';
  membership = await HospitalStaff.create({
    hospitalId: hospital._id,
    userId,
    role,
    permissions: getPermissionsForRole(role),
    isActive: true
  });

  if (!isHospitalAdminId(hospital, userId)) {
    hospital.admins = hospital.admins || [];
    hospital.admins.push(userId);
    await hospital.save();
  }

  return membership;
};

export const resolveEffectivePermissions = (membership) => {
  if (!membership) return [];
  if (membership.role === 'owner') {
    return [...HOSPITAL_PERMISSIONS];
  }
  if (membership.role === 'custom') {
    return (membership.permissions || []).filter((p) => HOSPITAL_PERMISSIONS.includes(p));
  }
  const fromRole = getPermissionsForRole(membership.role);
  const extra = (membership.permissions || []).filter((p) => HOSPITAL_PERMISSIONS.includes(p));
  return [...new Set([...fromRole, ...extra])];
};

export const findHospitalForUser = async (userId) => {
  const owned = await Hospital.findOne({ userId });
  if (owned) return owned;

  const membership = await HospitalStaff.findOne({ userId, isActive: true });
  if (!membership) return null;

  return Hospital.findById(membership.hospitalId);
};
