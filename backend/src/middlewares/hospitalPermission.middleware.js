import Hospital from '../models/Hospital.model.js';
import {
  ensureHospitalStaffMembership,
  isHospitalAdminId,
  resolveEffectivePermissions
} from '../utils/hospitalStaff.util.js';
import { hasPermission } from '../constants/hospitalPermissions.js';

/**
 * Verifies hospital access and attaches membership + permissions to req.
 */
export const checkHospitalOwnership = async (req, res, next) => {
  try {
    const { hospitalId } = req.params;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Hospital ID is required'
      });
    }

    const hospital = await Hospital.findById(hospitalId);

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    if (req.user.role === 'super_admin') {
      req.hospital = hospital;
      req.hospitalMembership = null;
      req.hospitalPermissions = ['*'];
      return next();
    }

    if (req.user.role !== 'hospital_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Hospital admin role required.'
      });
    }

    const membership = await ensureHospitalStaffMembership(hospital, req.user._id);

    if (!membership || !membership.isActive) {
      if (!isHospitalAdminId(hospital, req.user._id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a member of this hospital.'
        });
      }
    }

    const activeMembership = membership?.isActive ? membership : null;

    if (hospital.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Hospital must be approved to perform this action'
      });
    }

    req.hospital = hospital;
    req.hospitalMembership = activeMembership;
    req.hospitalPermissions = resolveEffectivePermissions(activeMembership);
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking hospital access',
      error: error.message
    });
  }
};

/** Require one or more permissions (after checkHospitalOwnership) */
export const requireHospitalPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') return next();

    if (!hasPermission(req.hospitalPermissions, requiredPermissions)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
        required: requiredPermissions
      });
    }
    next();
  };
};

/** Shorthand: ownership + permission check */
export const hospitalGuard = (...requiredPermissions) => {
  const chain = [checkHospitalOwnership];
  if (requiredPermissions.length) {
    chain.push(requireHospitalPermission(...requiredPermissions));
  }
  return chain;
};
