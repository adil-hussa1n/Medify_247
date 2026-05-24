import Doctor from '../models/Doctor.model.js';
import {
  getStaffMembershipForUser,
  isIndividualDoctor,
  resolveEffectivePermissions
} from '../utils/doctorStaff.util.js';
import { DOCTOR_PERMISSIONS, hasPermission } from '../constants/doctorPermissions.js';

/** Resolve practice doctor id and permissions for portal routes (no :doctorId param) */
export const resolveDoctorPracticeContext = async (req, res, next) => {
  try {
    if (req.user.role === 'doctor') {
      const doctor = req.doctor || await Doctor.findById(req.user._id);
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }
      if (!isIndividualDoctor(doctor)) {
        return res.status(403).json({
          success: false,
          message: 'Practice team access is only available for individual doctors.'
        });
      }
      req.practiceDoctor = doctor;
      req.practiceDoctorId = doctor._id;
      req.doctorMembership = null;
      req.doctorPermissions = [...DOCTOR_PERMISSIONS];
      return next();
    }

    if (req.user.role === 'doctor_staff') {
      const membership = await getStaffMembershipForUser(req.user._id);
      if (!membership?.isActive) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to an active doctor practice.'
        });
      }
      const doctor = await Doctor.findById(membership.doctorId);
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor practice not found' });
      }
      if (doctor.status !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Doctor practice is not approved.'
        });
      }
      if (!isIndividualDoctor(doctor)) {
        return res.status(403).json({
          success: false,
          message: 'Practice team access is only available for individual doctors.'
        });
      }
      req.practiceDoctor = doctor;
      req.practiceDoctorId = doctor._id;
      req.doctorMembership = membership;
      req.doctorPermissions = resolveEffectivePermissions(membership);
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. Doctor or practice staff role required.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resolving practice context',
      error: error.message
    });
  }
};

/**
 * Verifies access to a specific doctor practice (staff management routes).
 * Doctor owner must match :doctorId; staff must have membership.
 */
export const checkDoctorPracticeAccess = async (req, res, next) => {
  try {
    const { doctorId } = req.params;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }

    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    if (!isIndividualDoctor(doctor)) {
      return res.status(403).json({
        success: false,
        message: 'Team management is only available for individual doctors.'
      });
    }

    if (doctor.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Doctor must be approved to perform this action'
      });
    }

    if (req.user.role === 'super_admin') {
      req.practiceDoctor = doctor;
      req.practiceDoctorId = doctor._id;
      req.doctorMembership = null;
      req.doctorPermissions = ['*'];
      return next();
    }

    if (req.user.role === 'doctor') {
      if (req.user._id.toString() !== doctorId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage your own practice.'
        });
      }
      req.practiceDoctor = doctor;
      req.practiceDoctorId = doctor._id;
      req.doctorMembership = null;
      req.doctorPermissions = [...DOCTOR_PERMISSIONS];
      return next();
    }

    if (req.user.role === 'doctor_staff') {
      const membership = await getStaffMembershipForUser(req.user._id);
      if (!membership?.isActive || membership.doctorId.toString() !== doctorId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a member of this practice.'
        });
      }
      req.practiceDoctor = doctor;
      req.practiceDoctorId = doctor._id;
      req.doctorMembership = membership;
      req.doctorPermissions = resolveEffectivePermissions(membership);
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking practice access',
      error: error.message
    });
  }
};

export const requireDoctorPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') return next();

    if (!hasPermission(req.doctorPermissions, requiredPermissions)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
        required: requiredPermissions
      });
    }
    next();
  };
};

export const doctorGuard = (...requiredPermissions) => {
  const chain = [checkDoctorPracticeAccess];
  if (requiredPermissions.length) {
    chain.push(requireDoctorPermission(...requiredPermissions));
  }
  return chain;
};

export const doctorPortalGuard = (...requiredPermissions) => {
  const chain = [resolveDoctorPracticeContext];
  if (requiredPermissions.length) {
    chain.push(requireDoctorPermission(...requiredPermissions));
  }
  return chain;
};
