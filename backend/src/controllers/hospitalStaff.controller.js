import { validationResult } from 'express-validator';
import User from '../models/User.model.js';
import Hospital from '../models/Hospital.model.js';
import HospitalStaff from '../models/HospitalStaff.model.js';
import {
  HOSPITAL_PERMISSIONS,
  HOSPITAL_ROLE_KEYS,
  HOSPITAL_ROLE_LABELS,
  HOSPITAL_ROLE_TEMPLATES,
  getPermissionsForRole
} from '../constants/hospitalPermissions.js';
import {
  isHospitalAdminId,
  resolveEffectivePermissions
} from '../utils/hospitalStaff.util.js';

const formatStaffMember = (record) => {
  const user = record.userId;
  return {
    _id: record._id,
    userId: user?._id || record.userId,
    name: user?.name,
    email: user?.email,
    phone: user?.phone,
    role: record.role,
    roleLabel: HOSPITAL_ROLE_LABELS[record.role] || record.role,
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
      permissions: HOSPITAL_PERMISSIONS,
      roles: HOSPITAL_ROLE_KEYS.filter((r) => r !== 'owner').map((key) => ({
        key,
        label: HOSPITAL_ROLE_LABELS[key],
        permissions: HOSPITAL_ROLE_TEMPLATES[key]
      }))
    }
  });
};

export const getMyHospitalAccess = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    res.json({
      success: true,
      data: {
        hospitalId,
        membership: req.hospitalMembership
          ? {
              _id: req.hospitalMembership._id,
              role: req.hospitalMembership.role,
              roleLabel: HOSPITAL_ROLE_LABELS[req.hospitalMembership.role],
              jobTitle: req.hospitalMembership.jobTitle,
              isOwner: req.hospitalMembership.role === 'owner'
            }
          : null,
        permissions: req.hospitalPermissions || []
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

export const listHospitalStaff = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const staff = await HospitalStaff.find({ hospitalId })
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

export const createHospitalStaff = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { hospitalId } = req.params;
    const hospital = req.hospital;
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
      const existingStaff = await HospitalStaff.findOne({
        hospitalId,
        userId: existingUser._id
      });
      if (existingStaff) {
        return res.status(400).json({
          success: false,
          message: 'This user is already a staff member of this hospital'
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
      role: 'hospital_admin',
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

    const staff = await HospitalStaff.create({
      hospitalId,
      userId: user._id,
      role,
      permissions: effectivePermissions,
      jobTitle,
      invitedBy: req.user._id,
      isActive: true
    });

    if (!isHospitalAdminId(hospital, user._id)) {
      hospital.admins.push(user._id);
      await hospital.save();
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

export const updateHospitalStaff = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { hospitalId, staffId } = req.params;
    const { role, permissions: customPermissions, jobTitle, isActive } = req.body;

    const staff = await HospitalStaff.findOne({ _id: staffId, hospitalId });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    if (staff.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify the hospital owner account'
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

    if (isActive === false) {
      const hospital = await Hospital.findById(hospitalId);
      hospital.admins = (hospital.admins || []).filter(
        (id) => id.toString() !== staff.userId.toString()
      );
      await hospital.save();
    } else if (isActive === true) {
      const hospital = await Hospital.findById(hospitalId);
      if (!isHospitalAdminId(hospital, staff.userId)) {
        hospital.admins.push(staff.userId);
        await hospital.save();
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

export const removeHospitalStaff = async (req, res) => {
  try {
    const { hospitalId, staffId } = req.params;

    const staff = await HospitalStaff.findOne({ _id: staffId, hospitalId });
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    if (staff.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot remove the hospital owner'
      });
    }

    if (staff.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove your own account'
      });
    }

    const hospital = await Hospital.findById(hospitalId);
    hospital.admins = (hospital.admins || []).filter(
      (id) => id.toString() !== staff.userId.toString()
    );
    await hospital.save();

    await HospitalStaff.findByIdAndDelete(staffId);
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
