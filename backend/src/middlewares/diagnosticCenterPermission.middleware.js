import DiagnosticCenter from '../models/DiagnosticCenter.model.js';
import {
  ensureDiagnosticCenterStaffMembership,
  isDiagnosticCenterAdminId,
  resolveEffectivePermissions
} from '../utils/diagnosticCenterStaff.util.js';
import { hasPermission } from '../constants/diagnosticCenterPermissions.js';

export const checkDiagnosticCenterOwnership = async (req, res, next) => {
  try {
    const { centerId } = req.params;

    if (!centerId) {
      return res.status(400).json({
        success: false,
        message: 'Diagnostic center ID is required'
      });
    }

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    if (req.user.role === 'super_admin') {
      req.diagnosticCenter = diagnosticCenter;
      req.diagnosticCenterMembership = null;
      req.diagnosticCenterPermissions = ['*'];
      return next();
    }

    if (req.user.role !== 'diagnostic_center_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Diagnostic center admin role required.'
      });
    }

    const membership = await ensureDiagnosticCenterStaffMembership(diagnosticCenter, req.user._id);

    if (!membership || !membership.isActive) {
      if (!isDiagnosticCenterAdminId(diagnosticCenter, req.user._id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a member of this diagnostic center.'
        });
      }
    }

    const activeMembership = membership?.isActive ? membership : null;

    if (diagnosticCenter.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Diagnostic center must be approved to perform this action'
      });
    }

    req.diagnosticCenter = diagnosticCenter;
    req.diagnosticCenterMembership = activeMembership;
    req.diagnosticCenterPermissions = resolveEffectivePermissions(activeMembership);
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify diagnostic center access',
      error: error.message
    });
  }
};

export const requireDiagnosticCenterPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') return next();

    if (!hasPermission(req.diagnosticCenterPermissions, requiredPermissions)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
        required: requiredPermissions
      });
    }
    next();
  };
};

export const diagnosticCenterGuard = (...requiredPermissions) => {
  const chain = [checkDiagnosticCenterOwnership];
  if (requiredPermissions.length) {
    chain.push(requireDiagnosticCenterPermission(...requiredPermissions));
  }
  return chain;
};
