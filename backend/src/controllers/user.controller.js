import User from '../models/User.model.js';
import Doctor from '../models/Doctor.model.js';
import Hospital from '../models/Hospital.model.js';
import DiagnosticCenter from '../models/DiagnosticCenter.model.js';
import HospitalStaff from '../models/HospitalStaff.model.js';
import {
  ensureHospitalStaffMembership,
  findHospitalForUser,
  resolveEffectivePermissions
} from '../utils/hospitalStaff.util.js';
import { HOSPITAL_ROLE_LABELS } from '../constants/hospitalPermissions.js';
import {
  ensureDiagnosticCenterStaffMembership,
  findDiagnosticCenterForUser,
  resolveEffectivePermissions as resolveDcPermissions
} from '../utils/diagnosticCenterStaff.util.js';
import { DC_ROLE_LABELS } from '../constants/diagnosticCenterPermissions.js';

/**
 * GET /api/users/:id
 * Retrieve user profile (role aware)
 */
export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // Users can only view their own profile unless they're super admin
    if (req.user.role !== 'super_admin' && req.user._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own profile.'
      });
    }

    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let roleData = null;
    let hospitalAccess = null;
    let diagnosticCenterAccess = null;

    // Get role-specific data
    if (user.role === 'doctor') {
      roleData = await Doctor.findOne({ userId: user._id })
        .populate('hospitalId', 'name status');
    } else if (user.role === 'hospital_admin') {
      roleData = await findHospitalForUser(user._id);
      if (roleData) {
        const membership = await ensureHospitalStaffMembership(roleData, user._id);
        if (membership) {
          hospitalAccess = {
            hospitalId: roleData._id,
            role: membership.role,
            roleLabel: HOSPITAL_ROLE_LABELS[membership.role],
            permissions: resolveEffectivePermissions(membership),
            isOwner: membership.role === 'owner'
          };
        }
      }
    } else if (user.role === 'diagnostic_center_admin') {
      roleData = await findDiagnosticCenterForUser(user._id);
      if (roleData) {
        const membership = await ensureDiagnosticCenterStaffMembership(roleData, user._id);
        if (membership) {
          diagnosticCenterAccess = {
            centerId: roleData._id,
            role: membership.role,
            roleLabel: DC_ROLE_LABELS[membership.role],
            permissions: resolveDcPermissions(membership),
            isOwner: membership.role === 'owner'
          };
        }
      }
    }

    res.json({
      success: true,
      data: {
        user,
        roleData,
        hospitalAccess,
        diagnosticCenterAccess
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: error.message
    });
  }
};

