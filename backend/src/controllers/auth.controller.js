import User from '../models/User.model.js';
import Doctor from '../models/Doctor.model.js';
import { generateToken } from '../utils/jwt.util.js';
import {
  DOCTOR_PERMISSIONS,
  DOCTOR_ROLE_LABELS
} from '../constants/doctorPermissions.js';
import {
  findDoctorForStaffUser,
  getStaffMembershipForUser,
  isIndividualDoctor,
  resolveEffectivePermissions
} from '../utils/doctorStaff.util.js';
import {
  SUPER_ADMIN_PERMISSIONS,
  SUPER_ADMIN_ROLE_LABELS
} from '../constants/superAdminPermissions.js';
import {
  getStaffMembershipForUser as getAdminStaffMembership,
  resolveEffectivePermissions as resolveAdminPermissions
} from '../utils/superAdminStaff.util.js';
import { generateOTP, verifyOTP } from '../utils/otp.util.js';
import { validationResult } from 'express-validator';

export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, phone, password, dateOfBirth, gender } = req.body;

    // Check if user or doctor already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    const existingDoctor = await Doctor.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser || existingDoctor) {
      return res.status(400).json({
        success: false,
        message: 'Account already exists with this email or phone'
      });
    }

    // Create user with default role: patient
    // POST /api/auth/register is ONLY for patient registration
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: 'patient', // Default role - always patient
      dateOfBirth,
      gender
    });

    // Generate OTP for phone verification (simulation)
    const otp = generateOTP(phone);

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify OTP.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role
        },
        token,
        otp: process.env.NODE_ENV === 'development' ? otp : undefined
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

export const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const cleanEmail = email ? email.toLowerCase().trim() : '';

    // First check if it's a doctor (doctors are stored ONLY in doctors table)
    const doctor = await Doctor.findOne({ email: cleanEmail }).select('+password');

    if (doctor) {
      // Doctor login - authenticate from doctors table
      const isPasswordValid = await doctor.comparePassword(password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if doctor is approved (canLogin logic)
      if (doctor.status !== 'approved') {
        return res.status(403).json({
          success: false,
          message: `Doctor not approved. Current status: ${doctor.status}. Please wait for approval.`
        });
      }

      // Generate token using doctor._id
      const token = generateToken(doctor._id);

      const doctorAccess = isIndividualDoctor(doctor)
        ? {
            doctorId: doctor._id,
            role: 'owner',
            roleLabel: DOCTOR_ROLE_LABELS.owner,
            permissions: [...DOCTOR_PERMISSIONS],
            isOwner: true
          }
        : null;

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: doctor._id,
            name: doctor.name,
            email: doctor.email,
            phone: doctor.phone,
            role: 'doctor',
            profileImage: doctor.profilePhotoUrl
          },
          roleData: {
            id: doctor._id,
            medicalLicenseNumber: doctor.medicalLicenseNumber,
            specialization: doctor.specialization,
            status: doctor.status
          },
          doctorAccess,
          token
        }
      });
      return;
    }

    // Not a doctor - check User table (for patients, hospital admins, super admins)
    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account is inactive. Please contact support.'
      });
    }

    const token = generateToken(user._id);

    // Get role-specific data
    let roleData = null;
    let doctorAccess = null;
    let adminAccess = null;

    if (user.role === 'doctor') {
      roleData = await Doctor.findOne({ userId: user._id });
    } else if (user.role === 'doctor_staff') {
      roleData = await findDoctorForStaffUser(user._id);
      const membership = await getStaffMembershipForUser(user._id);
      if (roleData && membership) {
        doctorAccess = {
          doctorId: roleData._id,
          role: membership.role,
          roleLabel: DOCTOR_ROLE_LABELS[membership.role],
          permissions: resolveEffectivePermissions(membership),
          isOwner: false
        };
      }
    } else if (user.role === 'super_admin') {
      adminAccess = {
        role: 'owner',
        roleLabel: SUPER_ADMIN_ROLE_LABELS.owner,
        permissions: [...SUPER_ADMIN_PERMISSIONS],
        isOwner: true
      };
    } else if (user.role === 'super_admin_staff') {
      const membership = await getAdminStaffMembership(user._id);
      if (!membership?.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your admin team membership is inactive or revoked.'
        });
      }
      adminAccess = {
        role: membership.role,
        roleLabel: SUPER_ADMIN_ROLE_LABELS[membership.role],
        permissions: resolveAdminPermissions(membership),
        isOwner: false
      };
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profileImage: user.profileImage
        },
        roleData,
        doctorAccess,
        adminAccess,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

export const verifyPhoneOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone and OTP are required'
      });
    }

    const result = verifyOTP(phone, otp);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    // Update user verification status
    const user = await User.findOneAndUpdate(
      { phone },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Phone verified successfully',
      data: {
        user: {
          id: user._id,
          isVerified: user.isVerified
        }
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'OTP verification failed',
      error: error.message
    });
  }
};

export const resendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const otp = generateOTP(phone);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP',
      error: error.message
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    let roleData = null;
    if (user.role === 'doctor') {
      roleData = await Doctor.findOne({ userId: user._id })
        .populate('specialization');
    }

    res.json({
      success: true,
      data: {
        user,
        roleData
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user data',
      error: error.message
    });
  }
};
