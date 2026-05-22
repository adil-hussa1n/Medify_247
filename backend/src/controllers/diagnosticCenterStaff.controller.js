import { validationResult } from 'express-validator';
import User from '../models/User.model.js';
import DiagnosticCenter from '../models/DiagnosticCenter.model.js';
import DiagnosticCenterStaff from '../models/DiagnosticCenterStaff.model.js';
import {
  DC_PERMISSIONS,
  DC_ROLE_KEYS,
  DC_ROLE_LABELS,
  DC_ROLE_TEMPLATES,
  getPermissionsForRole
} from '../constants/diagnosticCenterPermissions.js';
import {
  isDiagnosticCenterAdminId,
  resolveEffectivePermissions
} from '../utils/diagnosticCenterStaff.util.js';

const formatStaffMember = (record) => {
  const user = record.userId;
  return {
    _id: record._id,
    userId: user?._id || record.userId,
    name: user?.name,
    email: user?.email,
    phone: user?.phone,
    role: record.role,
    roleLabel: DC_ROLE_LABELS[record.role] || record.role,
    permissions: resolveEffectivePermissions(record),
    jobTitle: record.jobTitle,
    isActive: record.isActive,
    isOwner: record.role === 'owner',
    createdAt: record.createdAt
  };
};

export const getPermissionCatalog = async (req, res) => {
  res.json({
    success: true,
    data: {
      permissions: DC_PERMISSIONS,
      roles: DC_ROLE_KEYS.filter((r) => r !== 'owner').map((key) => ({
        key,
        label: DC_ROLE_LABELS[key],
        permissions: DC_ROLE_TEMPLATES[key]
      }))
    }
  });
};

export const getMyDiagnosticCenterAccess = async (req, res) => {
  try {
    const { centerId } = req.params;
    res.json({
      success: true,
      data: {
        centerId,
        membership: req.diagnosticCenterMembership
          ? {
              _id: req.diagnosticCenterMembership._id,
              role: req.diagnosticCenterMembership.role,
              roleLabel: DC_ROLE_LABELS[req.diagnosticCenterMembership.role],
              jobTitle: req.diagnosticCenterMembership.jobTitle,
              isOwner: req.diagnosticCenterMembership.role === 'owner'
            }
          : null,
        permissions: req.diagnosticCenterPermissions || []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to load access info',
      error: error.message
    });
  }
};

export const listDiagnosticCenterStaff = async (req, res) => {
  try {
    const { centerId } = req.params;
    const staff = await DiagnosticCenterStaff.find({ diagnosticCenterId: centerId })
      .populate('userId', 'name email phone isActive')
      .sort({ role: 1, createdAt: 1 });

    res.json({
      success: true,
      data: {
        staff: staff.map(formatStaffMember)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to list staff',
      error: error.message
    });
  }
};

export const createDiagnosticCenterStaff = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { centerId } = req.params;
    const center = req.diagnosticCenter;
    const {
      name,
      email,
      phone,
      password,
      role,
      permissions: customPermissions,
      jobTitle
    } = req.body;

    if (role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign owner role to new users'
      });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      const existingStaff = await DiagnosticCenterStaff.findOne({
        diagnosticCenterId: centerId,
        userId: existingUser._id
      });
      if (existingStaff) {
        return res.status(400).json({
          success: false,
          message: 'This user is already a staff member of this diagnostic center'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Email or phone already registered. Use a different account.'
      });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: 'diagnostic_center_admin',
      isActive: true
    });

    const effectivePermissions =
      role === 'custom'
        ? getPermissionsForRole('custom', customPermissions || [])
        : getPermissionsForRole(role);

    if (!effectivePermissions.length) {
      await User.findByIdAndDelete(user._id);
      return res.status(400).json({
        success: false,
        message: 'At least one permission is required for custom role'
      });
    }

    const staff = await DiagnosticCenterStaff.create({
      diagnosticCenterId: centerId,
      userId: user._id,
      role,
      permissions: effectivePermissions,
      jobTitle,
      invitedBy: req.user._id,
      isActive: true
    });

    if (!isDiagnosticCenterAdminId(center, user._id)) {
      center.admins = center.admins || [];
      center.admins.push(user._id);
      await center.save();
    }

    await staff.populate('userId', 'name email phone isActive');

    res.status(201).json({
      success: true,
      message: 'Staff member added successfully',
      data: { staff: formatStaffMember(staff) }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add staff member',
      error: error.message
    });
  }
};

export const updateDiagnosticCenterStaff = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { centerId, staffId } = req.params;
    const { role, permissions: customPermissions, jobTitle, isActive } = req.body;

    const staff = await DiagnosticCenterStaff.findOne({ _id: staffId, diagnosticCenterId: centerId });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    if (staff.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify the diagnostic center owner account'
      });
    }

    if (role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Cannot promote staff to owner'
      });
    }

    if (role) staff.role = role;
    if (jobTitle !== undefined) staff.jobTitle = jobTitle;
    if (isActive !== undefined) staff.isActive = isActive;

    if (role === 'custom' || staff.role === 'custom') {
      staff.permissions = getPermissionsForRole('custom', customPermissions || staff.permissions);
    } else if (role) {
      staff.permissions = getPermissionsForRole(staff.role);
    }

    await staff.save();
    await staff.populate('userId', 'name email phone isActive');

    const center = await DiagnosticCenter.findById(centerId);
    if (isActive === false) {
      center.admins = (center.admins || []).filter(
        (id) => id.toString() !== staff.userId.toString()
      );
      await center.save();
    } else if (isActive === true) {
      if (!isDiagnosticCenterAdminId(center, staff.userId)) {
        center.admins.push(staff.userId);
        await center.save();
      }
    }

    res.json({
      success: true,
      message: 'Staff member updated',
      data: { staff: formatStaffMember(staff) }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update staff member',
      error: error.message
    });
  }
};

export const removeDiagnosticCenterStaff = async (req, res) => {
  try {
    const { centerId, staffId } = req.params;

    const staff = await DiagnosticCenterStaff.findOne({ _id: staffId, diagnosticCenterId: centerId });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    if (staff.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot remove the diagnostic center owner'
      });
    }

    if (staff.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove your own account'
      });
    }

    const center = await DiagnosticCenter.findById(centerId);
    center.admins = (center.admins || []).filter(
      (id) => id.toString() !== staff.userId.toString()
    );
    await center.save();

    await DiagnosticCenterStaff.findByIdAndDelete(staffId);
    await User.findByIdAndUpdate(staff.userId, { isActive: false });

    res.json({
      success: true,
      message: 'Staff member removed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove staff member',
      error: error.message
    });
  }
};
