import { validationResult } from 'express-validator';
import User from '../models/User.model.js';
import SuperAdminStaff from '../models/SuperAdminStaff.model.js';
import {
  SUPER_ADMIN_PERMISSIONS,
  SUPER_ADMIN_ROLE_KEYS,
  SUPER_ADMIN_ROLE_LABELS,
  SUPER_ADMIN_ROLE_TEMPLATES,
  getPermissionsForRole
} from '../constants/superAdminPermissions.js';
import { resolveEffectivePermissions } from '../utils/superAdminStaff.util.js';

const formatStaffMember = (record) => {
  const user = record.userId;
  return {
    _id: record._id,
    userId: user?._id || record.userId,
    name: user?.name,
    email: user?.email,
    phone: user?.phone,
    role: record.role,
    roleLabel: SUPER_ADMIN_ROLE_LABELS[record.role] || record.role,
    permissions: resolveEffectivePermissions(record),
    jobTitle: record.jobTitle,
    isActive: record.isActive,
    isOwner: false,
    createdAt: record.createdAt
  };
};

const formatOwnerMember = (user) => ({
  _id: `owner-${user._id}`,
  userId: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: 'owner',
  roleLabel: SUPER_ADMIN_ROLE_LABELS.owner,
  permissions: [...SUPER_ADMIN_PERMISSIONS],
  jobTitle: 'Super Admin',
  isActive: user.isActive,
  isOwner: true,
  createdAt: user.createdAt
});

export const getPermissionCatalog = async (req, res) => {
  res.json({
    success: true,
    data: {
      permissions: SUPER_ADMIN_PERMISSIONS,
      roles: SUPER_ADMIN_ROLE_KEYS.filter((r) => r !== 'owner').map((key) => ({
        key,
        label: SUPER_ADMIN_ROLE_LABELS[key],
        permissions: SUPER_ADMIN_ROLE_TEMPLATES[key]
      }))
    }
  });
};

export const getMyAdminAccess = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        membership: req.adminMembership
          ? {
              _id: req.adminMembership._id,
              role: req.adminMembership.role,
              roleLabel: SUPER_ADMIN_ROLE_LABELS[req.adminMembership.role],
              jobTitle: req.adminMembership.jobTitle,
              isOwner: false
            }
          : req.user.role === 'super_admin'
            ? {
                role: 'owner',
                roleLabel: SUPER_ADMIN_ROLE_LABELS.owner,
                jobTitle: 'Super Admin',
                isOwner: true
              }
            : null,
        permissions: req.adminPermissions || [],
        isOwner: !!req.isAdminOwner
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

export const listAdminTeam = async (req, res) => {
  try {
    const owners = await User.find({ role: 'super_admin' }).sort({ createdAt: 1 });
    const staff = await SuperAdminStaff.find()
      .populate('userId', 'name email phone isActive')
      .sort({ role: 1, createdAt: 1 });

    res.json({
      success: true,
      data: {
        team: [
          ...owners.map(formatOwnerMember),
          ...staff.map(formatStaffMember)
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to list admin team',
      error: error.message
    });
  }
};

export const createAdminTeamMember = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

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
      const existingStaff = await SuperAdminStaff.findOne({ userId: existingUser._id });
      if (existingStaff) {
        return res.status(400).json({
          success: false,
          message: 'This user is already on the admin team'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Email or phone already registered. Use a different account.'
      });
    }

    const effectivePermissions =
      role === 'custom'
        ? getPermissionsForRole('custom', customPermissions || [])
        : getPermissionsForRole(role);

    if (!effectivePermissions.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one permission is required for custom role'
      });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: 'super_admin_staff',
      isActive: true
    });

    const staff = await SuperAdminStaff.create({
      userId: user._id,
      role,
      permissions: effectivePermissions,
      jobTitle,
      invitedBy: req.user._id,
      isActive: true
    });

    await staff.populate('userId', 'name email phone isActive');

    res.status(201).json({
      success: true,
      message: 'Admin team member added successfully',
      data: { member: formatStaffMember(staff) }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add team member',
      error: error.message
    });
  }
};

export const updateAdminTeamMember = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { staffId } = req.params;
    const { role, permissions: customPermissions, jobTitle, isActive } = req.body;

    const staff = await SuperAdminStaff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
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
      staff.permissions = getPermissionsForRole(
        'custom',
        customPermissions || staff.permissions
      );
    } else if (role) {
      staff.permissions = getPermissionsForRole(staff.role);
    }

    if (!staff.permissions?.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one permission is required'
      });
    }

    await staff.save();
    if (isActive !== undefined) {
      await User.findByIdAndUpdate(staff.userId, { isActive });
    }
    await staff.populate('userId', 'name email phone isActive');

    res.json({
      success: true,
      message: 'Team member updated',
      data: { member: formatStaffMember(staff) }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update team member',
      error: error.message
    });
  }
};

export const removeAdminTeamMember = async (req, res) => {
  try {
    const { staffId } = req.params;

    const staff = await SuperAdminStaff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    if (staff.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove your own account'
      });
    }

    await SuperAdminStaff.findByIdAndDelete(staffId);
    await User.findByIdAndUpdate(staff.userId, { isActive: false });

    res.json({
      success: true,
      message: 'Team member removed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove team member',
      error: error.message
    });
  }
};
