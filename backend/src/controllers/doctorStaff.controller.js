import { validationResult } from 'express-validator';
import User from '../models/User.model.js';
import Doctor from '../models/Doctor.model.js';
import DoctorStaff from '../models/DoctorStaff.model.js';
import {
  DOCTOR_PERMISSIONS,
  DOCTOR_ROLE_KEYS,
  DOCTOR_ROLE_LABELS,
  DOCTOR_ROLE_TEMPLATES,
  getPermissionsForRole
} from '../constants/doctorPermissions.js';
import { resolveEffectivePermissions } from '../utils/doctorStaff.util.js';

const formatStaffMember = (record) => {
  const user = record.userId;
  return {
    _id: record._id,
    userId: user?._id || record.userId,
    name: user?.name,
    email: user?.email,
    phone: user?.phone,
    role: record.role,
    roleLabel: DOCTOR_ROLE_LABELS[record.role] || record.role,
    permissions: resolveEffectivePermissions(record),
    jobTitle: record.jobTitle,
    isActive: record.isActive,
    isOwner: false,
    createdAt: record.createdAt
  };
};

const formatOwnerMember = (doctor) => ({
  _id: `owner-${doctor._id}`,
  userId: doctor._id,
  name: doctor.name,
  email: doctor.email,
  phone: doctor.phone,
  role: 'owner',
  roleLabel: DOCTOR_ROLE_LABELS.owner,
  permissions: [...DOCTOR_PERMISSIONS],
  jobTitle: 'Practicing Doctor',
  isActive: true,
  isOwner: true,
  createdAt: doctor.createdAt
});

export const getPermissionCatalog = async (req, res) => {
  res.json({
    success: true,
    data: {
      permissions: DOCTOR_PERMISSIONS,
      roles: DOCTOR_ROLE_KEYS.filter((r) => r !== 'owner').map((key) => ({
        key,
        label: DOCTOR_ROLE_LABELS[key],
        permissions: DOCTOR_ROLE_TEMPLATES[key]
      }))
    }
  });
};

export const getMyDoctorAccess = async (req, res) => {
  try {
    const { doctorId } = req.params;
    res.json({
      success: true,
      data: {
        doctorId,
        membership: req.doctorMembership
          ? {
              _id: req.doctorMembership._id,
              role: req.doctorMembership.role,
              roleLabel: DOCTOR_ROLE_LABELS[req.doctorMembership.role],
              jobTitle: req.doctorMembership.jobTitle,
              isOwner: false
            }
          : req.user.role === 'doctor'
            ? {
                role: 'owner',
                roleLabel: DOCTOR_ROLE_LABELS.owner,
                jobTitle: 'Practicing Doctor',
                isOwner: true
              }
            : null,
        permissions: req.doctorPermissions || []
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

export const listDoctorStaff = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await Doctor.findById(doctorId);
    const staff = await DoctorStaff.find({ doctorId })
      .populate('userId', 'name email phone isActive')
      .sort({ role: 1, createdAt: 1 });

    res.json({
      success: true,
      data: {
        staff: [formatOwnerMember(doctor), ...staff.map(formatStaffMember)]
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

export const createDoctorStaff = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { doctorId } = req.params;
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
      const existingStaff = await DoctorStaff.findOne({
        doctorId,
        userId: existingUser._id
      });
      if (existingStaff) {
        return res.status(400).json({
          success: false,
          message: 'This user is already a team member of this practice'
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
      role: 'doctor_staff',
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

    const invitedBy =
      req.user.role === 'doctor_staff' ? req.user._id : undefined;

    const staff = await DoctorStaff.create({
      doctorId,
      userId: user._id,
      role,
      permissions: effectivePermissions,
      jobTitle,
      invitedBy,
      isActive: true
    });

    await staff.populate('userId', 'name email phone isActive');

    res.status(201).json({
      success: true,
      message: 'Team member added successfully',
      data: { staff: formatStaffMember(staff) }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add team member',
      error: error.message
    });
  }
};

export const updateDoctorStaff = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { doctorId, staffId } = req.params;
    const { role, permissions: customPermissions, jobTitle, isActive } = req.body;

    const staff = await DoctorStaff.findOne({ _id: staffId, doctorId });
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
      staff.permissions = getPermissionsForRole('custom', customPermissions || staff.permissions);
    } else if (role) {
      staff.permissions = getPermissionsForRole(staff.role);
    }

    await staff.save();
    await staff.populate('userId', 'name email phone isActive');

    res.json({
      success: true,
      message: 'Team member updated',
      data: { staff: formatStaffMember(staff) }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update team member',
      error: error.message
    });
  }
};

export const removeDoctorStaff = async (req, res) => {
  try {
    const { doctorId, staffId } = req.params;

    const staff = await DoctorStaff.findOne({ _id: staffId, doctorId });
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

    await DoctorStaff.findByIdAndDelete(staffId);
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
