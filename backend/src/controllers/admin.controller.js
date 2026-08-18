import User from '../models/User.model.js';
import Doctor from '../models/Doctor.model.js';
import Hospital from '../models/Hospital.model.js';
import DiagnosticCenter from '../models/DiagnosticCenter.model.js';
import Appointment from '../models/Appointment.model.js';
import Order from '../models/Order.model.js';
import Banner from '../models/Banner.model.js';
import Notification from '../models/Notification.model.js';
import { createAndSendNotification } from '../services/notification.service.js';
import { validationResult } from 'express-validator';
import moment from 'moment';
import createCsvWriter from 'csv-writer';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Approval from '../models/Approval.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dashboard analytics
export const getDashboardStats = async (req, res) => {
  try {
    const today = moment().startOf('day').toDate();
    const thisMonth = moment().startOf('month').toDate();
    const thisYear = moment().startOf('year').toDate();

    // User stats
    const totalUsers = await User.countDocuments();
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const totalDoctors = await Doctor.countDocuments({ status: 'approved' });
    const totalHospitals = await Hospital.countDocuments({ status: 'approved' });
    const totalDiagnosticCenters = await DiagnosticCenter.countDocuments({ status: 'approved' });
    const pendingDoctors = await Doctor.countDocuments({ 
      status: { $in: ['pending_super_admin', 'pending_hospital_and_super_admin'] } 
    });
    const pendingHospitals = await Hospital.countDocuments({ status: 'pending_super_admin' });
    const pendingDiagnosticCenters = await DiagnosticCenter.countDocuments({ status: 'pending_super_admin' });

    // Appointment stats
    const totalAppointments = await Appointment.countDocuments();
    const todayAppointments = await Appointment.countDocuments({
      appointmentDate: { $gte: today }
    });
    const monthlyAppointments = await Appointment.countDocuments({
      createdAt: { $gte: thisMonth }
    });

    // Order stats
    const totalOrders = await Order.countDocuments();
    const monthlyOrders = await Order.countDocuments({
      createdAt: { $gte: thisMonth }
    });

    // Revenue (if applicable)
    const monthlyRevenue = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: thisMonth },
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$fee' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          patients: totalPatients,
          doctors: totalDoctors,
          hospitals: totalHospitals,
          diagnosticCenters: totalDiagnosticCenters,
          pendingDoctors,
          pendingHospitals,
          pendingDiagnosticCenters
        },
        appointments: {
          total: totalAppointments,
          today: todayAppointments,
          thisMonth: monthlyAppointments
        },
        orders: {
          total: totalOrders,
          thisMonth: monthlyOrders
        },
        revenue: {
          thisMonth: monthlyRevenue[0]?.total || 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
};

// Doctor verification
export const getPendingDoctors = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const doctors = await Doctor.find({ status: 'pending_verification' })
      .populate('userId', 'name email phone')
      .populate('specialization')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Doctor.countDocuments({ status: 'pending_verification' });

    res.json({
      success: true,
      data: {
        doctors,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending doctors',
      error: error.message
    });
  }
};

export const verifyDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { action, rejectionReason } = req.body;

    const doctor = await Doctor.findById(doctorId).populate('userId');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    if (action === 'approve') {
      doctor.status = 'active';
      doctor.verifiedAt = new Date();
      doctor.verifiedBy = req.user._id;
      doctor.rejectionReason = undefined;
      
      const io = req.app.get('io');
      
      if (doctor.userId) {
        await createAndSendNotification(
          io,
          doctor.userId._id,
          'verification_approved',
          'Account Verified',
          'Your doctor account has been verified and activated',
          doctor._id,
          'user'
        );
      }
    } else if (action === 'reject') {
      doctor.status = 'rejected';
      doctor.rejectionReason = rejectionReason || 'Verification failed';
      doctor.verifiedBy = req.user._id;
      
      const io = req.app.get('io');
      
      if (doctor.userId) {
        await createAndSendNotification(
          io,
          doctor.userId._id,
          'verification_rejected',
          'Verification Rejected',
          `Your verification was rejected: ${doctor.rejectionReason}`,
          doctor._id,
          'user'
        );
      }
    }

    await doctor.save();

    res.json({
      success: true,
      message: `Doctor ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: { doctor }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify doctor',
      error: error.message
    });
  }
};

// Hospital verification
export const getPendingHospitals = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const hospitals = await Hospital.find({ status: 'pending_verification' })
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Hospital.countDocuments({ status: 'pending_verification' });

    res.json({
      success: true,
      data: {
        hospitals,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending hospitals',
      error: error.message
    });
  }
};

export const verifyHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { action, rejectionReason } = req.body;

    const hospital = await Hospital.findById(hospitalId).populate('userId');
    
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    if (action === 'approve') {
      hospital.status = 'active';
      hospital.verifiedAt = new Date();
      hospital.verifiedBy = req.user._id;
      hospital.rejectionReason = undefined;
      
      const io = req.app.get('io');
      
      if (hospital.userId) {
        await createAndSendNotification(
          io,
          hospital.userId._id,
          'verification_approved',
          'Account Verified',
          'Your hospital account has been verified and activated',
          hospital._id,
          'user'
        );
      }
    } else if (action === 'reject') {
      hospital.status = 'rejected';
      hospital.rejectionReason = rejectionReason || 'Verification failed';
      hospital.verifiedBy = req.user._id;
      
      const io = req.app.get('io');
      
      if (hospital.userId) {
        await createAndSendNotification(
          io,
          hospital.userId._id,
          'verification_rejected',
          'Verification Rejected',
          `Your verification was rejected: ${hospital.rejectionReason}`,
          hospital._id,
          'user'
        );
      }
    }

    await hospital.save();

    res.json({
      success: true,
      message: `Hospital ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: { hospital }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify hospital',
      error: error.message
    });
  }
};

// Banner management
export const createBanner = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Banner image is required'
      });
    }

    const { title, link, order, startDate, endDate } = req.body;

    const banner = await Banner.create({
      title,
      image: req.file.cloudinaryUrl || req.file.path,
      link,
      order: order || 0,
      startDate: startDate || new Date(),
      endDate,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: { banner }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create banner',
      error: error.message
    });
  }
};

export const getBanners = async (req, res) => {
  try {
    const { isActive } = req.query;

    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const banners = await Banner.find(query)
      .populate('createdBy', 'name')
      .sort({ order: 1, createdAt: -1 });

    res.json({
      success: true,
      data: { banners }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners',
      error: error.message
    });
  }
};

export const updateBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const updateData = req.body;

    if (req.file) {
      updateData.image = req.file.cloudinaryUrl || req.file.path;
    }

    const banner = await Banner.findByIdAndUpdate(
      bannerId,
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      message: 'Banner updated successfully',
      data: { banner }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update banner',
      error: error.message
    });
  }
};

// Broadcast notification
export const broadcastNotification = async (req, res) => {
  try {
    const { title, message, targetRoles, targetUsers } = req.body;

    const query = {};
    if (targetRoles && targetRoles.length > 0) {
      query.role = { $in: targetRoles };
    }
    if (targetUsers && targetUsers.length > 0) {
      query._id = { $in: targetUsers };
    }

    const users = await User.find(query);
    const io = req.app.get('io');

    const notifications = await Promise.all(
      users.map(user => 
        createAndSendNotification(
          io,
          user._id,
          'broadcast',
          title,
          message,
          null,
          'none'
        )
      )
    );

    res.json({
      success: true,
      message: `Notification broadcasted to ${users.length} users`,
      data: { count: users.length }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to broadcast notification',
      error: error.message
    });
  }
};

// Data export
export const exportData = async (req, res) => {
  try {
    const { type, format, startDate, endDate } = req.query;

    let data = [];
    let filename = '';

    const start = startDate ? moment(startDate).startOf('day').toDate() : moment().subtract(30, 'days').toDate();
    const end = endDate ? moment(endDate).endOf('day').toDate() : new Date();

    if (type === 'appointments') {
      const appointments = await Appointment.find({
        createdAt: { $gte: start, $lte: end }
      })
        .populate('patientId', 'name email phone')
        .populate('doctorId')
        .populate({
          path: 'doctorId',
          populate: { path: 'userId', select: 'name' }
        })
        .sort({ createdAt: -1 });

      data = appointments.map(apt => ({
        'Appointment Number': apt.appointmentNumber,
        'Patient Name': apt.patientId?.name || 'N/A',
        'Patient Email': apt.patientId?.email || 'N/A',
        'Doctor Name': apt.doctorId?.userId?.name || 'N/A',
        'Date': moment(apt.appointmentDate).format('YYYY-MM-DD'),
        'Time': `${apt.timeSlot.startTime} - ${apt.timeSlot.endTime}`,
        'Status': apt.status,
        'Fee': apt.fee,
        'Payment Status': apt.paymentStatus,
        'Created At': moment(apt.createdAt).format('YYYY-MM-DD HH:mm:ss')
      }));

      filename = `appointments_${moment().format('YYYY-MM-DD')}`;
    } else if (type === 'orders') {
      const orders = await Order.find({
        createdAt: { $gte: start, $lte: end }
      })
        .populate('patientId', 'name email phone')
        .populate('hospitalId', 'facilityName')
        .sort({ createdAt: -1 });

      data = orders.map(order => ({
        'Order Number': order.orderNumber,
        'Patient Name': order.patientId?.name || 'N/A',
        'Hospital': order.hospitalId?.facilityName || 'N/A',
        'Collection Type': order.collectionType,
        'Total Amount': order.totalAmount,
        'Final Amount': order.finalAmount,
        'Status': order.status,
        'Created At': moment(order.createdAt).format('YYYY-MM-DD HH:mm:ss')
      }));

      filename = `orders_${moment().format('YYYY-MM-DD')}`;
    } else if (type === 'users') {
      const users = await User.find({
        createdAt: { $gte: start, $lte: end }
      }).sort({ createdAt: -1 });

      data = users.map(user => ({
        'Name': user.name,
        'Email': user.email,
        'Phone': user.phone,
        'Role': user.role,
        'Status': user.isActive ? 'Active' : 'Inactive',
        'Verified': user.isVerified ? 'Yes' : 'No',
        'Created At': moment(user.createdAt).format('YYYY-MM-DD HH:mm:ss')
      }));

      filename = `users_${moment().format('YYYY-MM-DD')}`;
    }

    if (format === 'csv') {
      const outputDir = path.join(__dirname, '../../exports');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filepath = path.join(outputDir, `${filename}.csv`);
      
      const csvWriter = createCsvWriter.createObjectCsvWriter({
        path: filepath,
        header: Object.keys(data[0] || {}).map(key => ({ id: key, title: key }))
      });

      await csvWriter.writeRecords(data);

      res.download(filepath);
    } else if (format === 'xlsx') {
      const outputDir = path.join(__dirname, '../../exports');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

      const filepath = path.join(outputDir, `${filename}.xlsx`);
      XLSX.writeFile(workbook, filepath);

      res.download(filepath);
    } else {
      res.json({
        success: true,
        data
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to export data',
      error: error.message
    });
  }
};

// Helper function to log approval action
const logApproval = async (actorId, actorRole, targetType, targetId, action, reason, previousStatus, newStatus) => {
  try {
    await Approval.create({
      actorId,
      actorRole,
      targetType,
      targetId,
      action,
      reason,
      previousStatus,
      newStatus,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error logging approval:', error);
  }
};

// Helper function to notify (stub for email integration)
const notifyEmail = async (userEmail, subject, body) => {
  console.log(`[NOTIFICATION] To: ${userEmail}, Subject: ${subject}, Body: ${body}`);
};

/**
 * POST /api/admin/hospitals
 * Super admin creates a new hospital (auto-approved)
 */
export const createHospital = async (req, res) => {
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
      address,
      registrationNumber,
      documents,
      contactInfo,
      departments,
      facilities,
      services
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or phone'
      });
    }

    // Check if registration number already exists
    const existingHospital = await Hospital.findOne({ registrationNumber });
    if (existingHospital) {
      return res.status(400).json({
        success: false,
        message: 'Registration number already exists'
      });
    }

    // Create user with hospital_admin role
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: 'hospital_admin',
      isActive: true // Active immediately since super admin is creating it
    });

    // Create hospital record with status: approved (since super admin is creating it)
    const hospital = await Hospital.create({
      userId: user._id,
      name,
      address,
      registrationNumber,
      documents: Array.isArray(documents) ? documents : (documents ? [documents] : []),
      status: 'approved',
      admins: [user._id],
      contactInfo: contactInfo || {},
      departments: departments || [],
      facilities: facilities || [],
      services: services || [],
      verifiedAt: new Date(),
      verifiedBy: req.user._id
    });

    // Log creation action
    await logApproval(
      req.user._id,
      'super_admin',
      'hospital',
      hospital._id,
      'create',
      'Hospital created by super admin',
      null,
      'approved'
    );

    // Send notification (stub)
    await notifyEmail(
      email,
      'Hospital Account Created',
      'Your hospital account has been created and approved by super admin. You can now login and manage your hospital.'
    );

    res.status(201).json({
      success: true,
      message: 'Hospital created successfully',
      data: {
        hospital: {
          id: hospital._id,
          userId: user._id,
          name: hospital.name,
          status: hospital.status,
          registrationNumber: hospital.registrationNumber
        }
      }
    });
  } catch (error) {
    console.error('Create hospital error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create hospital',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/hospitals
 * Super admin gets all hospitals
 */
export const getAllHospitals = async (req, res) => {
  try {
    console.log('GET /api/admin/hospitals - Request received');
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }

    console.log('Query:', query);
    const hospitals = await Hospital.find(query)
      .populate({
        path: 'userId',
        select: 'name email phone',
        strictPopulate: false
      })
      .populate({
        path: 'verifiedBy',
        select: 'name',
        strictPopulate: false
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Hospital.countDocuments(query);
    console.log(`Found ${hospitals.length} hospitals out of ${total} total`);

    res.json({
      success: true,
      data: {
        hospitals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllHospitals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hospitals',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/hospitals/:hospitalId
 * Super admin updates a hospital
 */
export const updateHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const updateData = req.body;

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Update hospital
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'email' && key !== 'phone' && key !== 'password') {
        hospital[key] = updateData[key];
      }
    });

    await hospital.save();

    res.json({
      success: true,
      message: 'Hospital updated successfully',
      data: { hospital }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update hospital',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/hospitals/:hospitalId
 * Super admin deletes a hospital
 */
export const deleteHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Delete associated user
    if (hospital.userId) {
      await User.findByIdAndDelete(hospital.userId);
    }

    // Delete hospital
    await Hospital.findByIdAndDelete(hospitalId);

    res.json({
      success: true,
      message: 'Hospital deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete hospital',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/users
 * Super admin gets all users with pagination and filters
 */
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (role) {
      query.role = role;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    console.log('getAllUsers - Query params:', { role, search, isActive, page, limit });
    console.log('getAllUsers - MongoDB query:', JSON.stringify(query, null, 2));

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const users = await User.find(query)
      .select('-password')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);
    const activeUsers = await User.countDocuments({ ...query, isActive: true });
    const inactiveUsers = await User.countDocuments({ ...query, isActive: false });

    console.log('getAllUsers - Found users:', users.length, 'Total:', total);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
          activeUsers,
          inactiveUsers
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/users/:userId
 * Super admin updates a user (including block/activate)
 */
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't allow changing password directly
    delete updateData.password;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        user[key] = updateData[key];
      }
    });

    await user.save();

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/users/:userId
 * Super admin deletes a user
 */
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If user is hospital_admin, delete associated hospital
    if (user.role === 'hospital_admin') {
      await Hospital.findOneAndDelete({ userId: user._id });
    }

    // If user is diagnostic_center_admin, delete associated diagnostic center
    if (user.role === 'diagnostic_center_admin') {
      await DiagnosticCenter.findOneAndDelete({ userId: user._id });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/doctors
 * Super admin gets only individual doctors (not associated with any hospital or diagnostic center)
 */
export const getAllDoctors = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, specialization, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Only show individual doctors (not associated with hospital or diagnostic center)
    const query = {
      hospitalId: null,
      diagnosticCenterId: null
    };
    if (status) {
      query.status = status;
    }
    if (specialization) {
      query.specialization = specialization;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { medicalLicenseNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const doctors = await Doctor.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Doctor.countDocuments(query);

    // Get unique specializations for filter
    const specializations = await Doctor.distinct('specialization', query);

    res.json({
      success: true,
      data: {
        doctors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        specializations: specializations.filter(s => s)
      }
    });
  } catch (error) {
    console.error('Error in getAllDoctors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctors',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/doctors/:doctorId
 * Super admin updates a doctor
 */
export const updateDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const updateData = req.body;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'specialization' && typeof updateData[key] === 'string') {
          doctor.specialization = updateData[key].split(',').map(s => s.trim()).filter(Boolean);
        } else {
          doctor[key] = updateData[key];
        }
      }
    });

    await doctor.save();

    res.json({
      success: true,
      message: 'Doctor updated successfully',
      data: { doctor }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update doctor',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/doctors/:doctorId
 * Super admin deletes a doctor
 */
export const deleteDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    await Doctor.findByIdAndDelete(doctorId);

    res.json({
      success: true,
      message: 'Doctor deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete doctor',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/diagnostic-centers
 * Super admin gets all diagnostic centers
 */
export const getAllDiagnosticCenters = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { tradeLicenseNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const diagnosticCenters = await DiagnosticCenter.find(query)
      .populate({
        path: 'userId',
        select: 'name email phone',
        strictPopulate: false
      })
      .populate({
        path: 'verifiedBy',
        select: 'name',
        strictPopulate: false
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await DiagnosticCenter.countDocuments(query);

    res.json({
      success: true,
      data: {
        diagnosticCenters,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllDiagnosticCenters:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch diagnostic centers',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/diagnostic-centers
 * Super admin creates a new diagnostic center (auto-approved)
 */
export const createDiagnosticCenter = async (req, res) => {
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
      address,
      ownerName,
      ownerPhone,
      tradeLicenseNumber
    } = req.body;

    // Check if user already exists
    let existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      // If orphaned diagnostic user with no attached active center, clean up or re-use
      if (existingUser.role === 'diagnostic_center_admin') {
        const hasCenter = await DiagnosticCenter.findOne({ userId: existingUser._id });
        if (!hasCenter) {
          await User.findByIdAndDelete(existingUser._id);
          existingUser = null;
        }
      }
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email or phone'
        });
      }
    }

    // Check if trade license number already exists
    const existingCenter = await DiagnosticCenter.findOne({ tradeLicenseNumber });
    if (existingCenter) {
      return res.status(400).json({
        success: false,
        message: 'Trade license number already exists'
      });
    }

    // Create user with diagnostic_center_admin role
    const user = await User.create({
      name: ownerName,
      email,
      phone,
      password,
      role: 'diagnostic_center_admin',
      isActive: true
    });

    // Create diagnostic center record with status: approved
    const diagnosticCenter = await DiagnosticCenter.create({
      userId: user._id,
      name,
      email,
      phone,
      address,
      ownerName,
      ownerPhone,
      tradeLicenseNumber,
      status: 'approved',
      admins: [user._id],
      verifiedAt: new Date(),
      verifiedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Diagnostic center created successfully',
      data: {
        diagnosticCenter: {
          id: diagnosticCenter._id,
          userId: user._id,
          name: diagnosticCenter.name,
          status: diagnosticCenter.status,
          tradeLicenseNumber: diagnosticCenter.tradeLicenseNumber
        }
      }
    });
  } catch (error) {
    console.error('Create diagnostic center error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create diagnostic center',
      error: error.message
    });
  }
};

/**
 * PUT /api/admin/diagnostic-centers/:centerId
 * Super admin updates a diagnostic center
 */
export const updateDiagnosticCenter = async (req, res) => {
  try {
    const { centerId } = req.params;
    const updateData = req.body;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'email' && key !== 'phone' && key !== 'password') {
        diagnosticCenter[key] = updateData[key];
      }
    });

    await diagnosticCenter.save();

    res.json({
      success: true,
      message: 'Diagnostic center updated successfully',
      data: { diagnosticCenter }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update diagnostic center',
      error: error.message
    });
  }
};

/**
 * DELETE /api/admin/diagnostic-centers/:centerId
 * Super admin deletes a diagnostic center
 */
export const deleteDiagnosticCenter = async (req, res) => {
  try {
    const { centerId } = req.params;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    // Delete associated user
    if (diagnosticCenter.userId) {
      await User.findByIdAndDelete(diagnosticCenter.userId);
    }

    await DiagnosticCenter.findByIdAndDelete(centerId);

    res.json({
      success: true,
      message: 'Diagnostic center deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete diagnostic center',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/user-growth
 * Get user growth data for charts (monthly)
 */
export const getUserGrowth = async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const growthData = [];

    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const startDate = moment().subtract(i, 'months').startOf('month').toDate();
      const endDate = moment().subtract(i, 'months').endOf('month').toDate();

      const monthUsers = await User.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const monthDoctors = await Doctor.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const monthHospitals = await Hospital.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const monthDiagnosticCenters = await DiagnosticCenter.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });

      growthData.push({
        month: moment(startDate).format('MMM YYYY'),
        users: monthUsers,
        doctors: monthDoctors,
        hospitals: monthHospitals,
        diagnosticCenters: monthDiagnosticCenters
      });
    }

    res.json({
      success: true,
      data: { growthData }
    });
  } catch (error) {
    console.error('Error in getUserGrowth:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user growth data',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/recent-registrations
 * Get recent user registrations
 */
export const getRecentRegistrations = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const recentUsers = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const recentDoctors = await Doctor.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const recentHospitals = await Hospital.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const recentDiagnosticCenters = await DiagnosticCenter.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        users: recentUsers,
        doctors: recentDoctors,
        hospitals: recentHospitals,
        diagnosticCenters: recentDiagnosticCenters
      }
    });
  } catch (error) {
    console.error('Error in getRecentRegistrations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent registrations',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/activity-logs
 * Super admin gets activity logs and history
 */
export const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, targetType, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (action) {
      query.action = action;
    }
    if (targetType) {
      query.targetType = targetType;
    }
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    const logs = await Approval.find(query)
      .populate('actorId', 'name email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Approval.countDocuments(query);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error in getActivityLogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs',
      error: error.message
    });
  }
};
