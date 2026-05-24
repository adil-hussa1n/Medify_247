import User from '../models/User.model.js';
import {
  SUPER_ADMIN_PERMISSIONS,
  hasPermission
} from '../constants/superAdminPermissions.js';
import {
  getStaffMembershipForUser,
  resolveEffectivePermissions
} from '../utils/superAdminStaff.util.js';

export const resolveSuperAdminContext = async (req, res, next) => {
  try {
    if (req.user.role === 'super_admin') {
      req.adminMembership = null;
      req.adminPermissions = [...SUPER_ADMIN_PERMISSIONS];
      req.isAdminOwner = true;
      return next();
    }

    if (req.user.role === 'super_admin_staff') {
      const membership = await getStaffMembershipForUser(req.user._id);
      if (!membership?.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your admin team membership is inactive or revoked.'
        });
      }
      req.adminMembership = membership;
      req.adminPermissions = resolveEffectivePermissions(membership);
      req.isAdminOwner = false;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resolving admin context',
      error: error.message
    });
  }
};

export const requireSuperAdminPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!hasPermission(req.adminPermissions, requiredPermissions)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
        required: requiredPermissions
      });
    }
    next();
  };
};

export const adminGuard = (...requiredPermissions) => {
  if (!requiredPermissions.length) return [];
  return [requireSuperAdminPermission(...requiredPermissions)];
};
