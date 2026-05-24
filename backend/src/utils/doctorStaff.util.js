import Doctor from '../models/Doctor.model.js';
import DoctorStaff from '../models/DoctorStaff.model.js';
import { getPermissionsForRole, DOCTOR_PERMISSIONS } from '../constants/doctorPermissions.js';

export const isIndividualDoctor = (doctor) =>
  !doctor?.hospitalId && !doctor?.diagnosticCenterId;

export const resolveEffectivePermissions = (membership) => {
  if (!membership) return [];
  if (membership.role === 'owner') {
    return [...DOCTOR_PERMISSIONS];
  }
  if (membership.role === 'custom') {
    return (membership.permissions || []).filter((p) => DOCTOR_PERMISSIONS.includes(p));
  }
  const fromRole = getPermissionsForRole(membership.role);
  const extra = (membership.permissions || []).filter((p) => DOCTOR_PERMISSIONS.includes(p));
  return [...new Set([...fromRole, ...extra])];
};

/** Practice linked to a staff user account */
export const findDoctorForStaffUser = async (userId) => {
  const membership = await DoctorStaff.findOne({ userId, isActive: true });
  if (!membership) return null;
  return Doctor.findById(membership.doctorId);
};

export const getStaffMembershipForUser = async (userId) => {
  return DoctorStaff.findOne({ userId, isActive: true });
};
