import User from '../models/User.model.js';
import DiagnosticCenter from '../models/DiagnosticCenter.model.js';
import Doctor from '../models/Doctor.model.js';
import Test from '../models/Test.model.js';
import Order from '../models/Order.model.js';
import HomeService from '../models/HomeService.model.js';
import HomeServiceRequest from '../models/HomeServiceRequest.model.js';
import DiagnosticCenterStaff from '../models/DiagnosticCenterStaff.model.js';
import { getPermissionsForRole } from '../constants/diagnosticCenterPermissions.js';
import TestSerialSettings from '../models/TestSerialSettings.model.js';
import TestSerialBooking from '../models/TestSerialBooking.model.js';
import HomeServiceSerialSettings from '../models/HomeServiceSerialSettings.model.js';
import HomeServiceSerialBooking from '../models/HomeServiceSerialBooking.model.js';
import SerialSettings from '../models/SerialSettings.model.js';
import { offDaysToAvailableDays, buildSerialBookingSummary } from '../utils/homeServiceSerial.util.js';
import {
  findProviderHomeServiceSerialBooking,
  applyHomeServiceSerialBookingFields
} from '../services/homeServiceSerialBooking.service.js';
import Appointment from '../models/Appointment.model.js';
import { logApproval, notifyEmail } from './doctor.controller.js';
import { validationResult } from 'express-validator';
import moment from 'moment';
import { createAndSendNotification } from '../services/notification.service.js';

/**
 * POST /api/diagnostic-centers/register
 * Register a new diagnostic center
 * On creation: status = pending_super_admin
 * Super admin must approve via POST /api/admin/approve/diagnostic-center/:centerId
 */
export const registerDiagnosticCenter = async (req, res) => {
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
      phone,
      email,
      address,
      ownerName,
      ownerPhone,
      tradeLicenseNumber,
      tradeLicenseDocument,
      password
    } = req.body;

    // Check if user or doctor already exists with this email or phone
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
      phone: ownerPhone,
      password,
      role: 'diagnostic_center_admin',
      isActive: false // Inactive until center is approved
    });

    // Create diagnostic center record with status: pending_super_admin
    const diagnosticCenter = await DiagnosticCenter.create({
      userId: user._id,
      name,
      phone,
      email,
      address,
      ownerName,
      ownerPhone,
      tradeLicenseNumber,
      tradeLicenseDocument: tradeLicenseDocument || '',
      status: 'pending_super_admin',
      admins: [user._id] // Add creator as admin
    });

    await DiagnosticCenterStaff.create({
      diagnosticCenterId: diagnosticCenter._id,
      userId: user._id,
      role: 'owner',
      permissions: getPermissionsForRole('owner'),
      isActive: true
    });

    // Log registration event & send notification safely
    try {
      await logApproval(
        user._id,
        'diagnostic_center_admin',
        'diagnostic_center',
        diagnosticCenter._id,
        'register',
        null,
        null,
        'pending_super_admin'
      );
      await notifyEmail(
        email,
        'Diagnostic Center Registration Submitted',
        'Your diagnostic center registration has been submitted and is pending super admin approval.'
      );
    } catch (logErr) {
      console.warn('Non-blocking logApproval/notifyEmail error in registerDiagnosticCenter:', logErr);
    }

    res.status(201).json({
      success: true,
      message: 'Diagnostic center registration successful. Status: pending_super_admin. Awaiting super admin approval.',
      data: {
        diagnosticCenter: {
          id: diagnosticCenter._id,
          userId: user._id,
          status: diagnosticCenter.status,
          tradeLicenseNumber: diagnosticCenter.tradeLicenseNumber
        }
      }
    });
  } catch (error) {
    console.error('Diagnostic center registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Diagnostic center registration failed',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/profile
 * Get diagnostic center profile
 */
export const getDiagnosticCenterProfile = async (req, res) => {
  try {
    const { centerId } = req.params;
    
    const diagnosticCenter = await DiagnosticCenter.findById(centerId)
      .populate('userId', 'name email phone')
      .populate('admins', 'name email phone')
      .populate('verifiedBy', 'name email');

    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    res.json({
      success: true,
      data: { diagnosticCenter }
    });
  } catch (error) {
    console.error('Get diagnostic center profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch diagnostic center profile',
      error: error.message
    });
  }
};

/**
 * PUT /api/diagnostic-centers/:centerId/profile
 * Update diagnostic center profile (post-approval profile completion)
 */
export const updateDiagnosticCenterProfile = async (req, res) => {
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
    const {
      governmentRegistrationCertificate,
      departments,
      operatingHours,
      homeSampleCollection,
      emergencyService,
      ambulanceService,
      numberOfLabTechnicians,
      numberOfStaff,
      reportingTime,
      reportDeliveryOptions,
      logo,
      contactInfo
    } = req.body;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);

    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    // Only approved centers can update profile
    if (diagnosticCenter.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Diagnostic center must be approved before updating profile'
      });
    }

    // Validate operating hours if provided
    if (operatingHours) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (operatingHours.openingTime && !timeRegex.test(operatingHours.openingTime)) {
        return res.status(400).json({
          success: false,
          message: 'Opening time must be in HH:mm format'
        });
      }
      if (operatingHours.closingTime && !timeRegex.test(operatingHours.closingTime)) {
        return res.status(400).json({
          success: false,
          message: 'Closing time must be in HH:mm format'
        });
      }

      if (operatingHours.openingTime && operatingHours.closingTime) {
        const [openHour, openMin] = operatingHours.openingTime.split(':').map(Number);
        const [closeHour, closeMin] = operatingHours.closingTime.split(':').map(Number);
        const openMinutes = openHour * 60 + openMin;
        const closeMinutes = closeHour * 60 + closeMin;
        
        if (closeMinutes <= openMinutes) {
          return res.status(400).json({
            success: false,
            message: 'Closing time must be after opening time'
          });
        }
      }
    }

    // Validate ambulance service
    if (ambulanceService !== undefined) {
      if (ambulanceService.available && (!ambulanceService.contactNumber || ambulanceService.contactNumber.trim() === '')) {
        return res.status(400).json({
          success: false,
          message: 'Ambulance contact number is required when ambulance service is available'
        });
      }
    }

    // Update fields
    if (governmentRegistrationCertificate !== undefined) {
      diagnosticCenter.governmentRegistrationCertificate = governmentRegistrationCertificate;
    }
    if (departments !== undefined) {
      diagnosticCenter.departments = Array.isArray(departments) ? departments : [departments];
    }
    if (operatingHours !== undefined) {
      diagnosticCenter.operatingHours = {
        openingTime: operatingHours.openingTime || diagnosticCenter.operatingHours?.openingTime,
        closingTime: operatingHours.closingTime || diagnosticCenter.operatingHours?.closingTime
      };
    }
    if (homeSampleCollection !== undefined) {
      diagnosticCenter.homeSampleCollection = homeSampleCollection;
    }
    if (emergencyService !== undefined) {
      diagnosticCenter.emergencyService = emergencyService;
    }
    if (ambulanceService !== undefined) {
      diagnosticCenter.ambulanceService = ambulanceService;
    }
    if (numberOfLabTechnicians !== undefined) {
      diagnosticCenter.numberOfLabTechnicians = numberOfLabTechnicians;
    }
    if (numberOfStaff !== undefined) {
      diagnosticCenter.numberOfStaff = numberOfStaff;
    }
    if (reportingTime !== undefined) {
      diagnosticCenter.reportingTime = reportingTime;
    }
    if (reportDeliveryOptions !== undefined) {
      diagnosticCenter.reportDeliveryOptions = {
        email: reportDeliveryOptions.email !== undefined ? reportDeliveryOptions.email : diagnosticCenter.reportDeliveryOptions?.email || true,
        onlinePortal: reportDeliveryOptions.onlinePortal !== undefined ? reportDeliveryOptions.onlinePortal : diagnosticCenter.reportDeliveryOptions?.onlinePortal || true
      };
    }
    if (logo !== undefined) {
      diagnosticCenter.logo = logo;
    }
    if (contactInfo !== undefined) {
      diagnosticCenter.contactInfo = {
        phone: contactInfo.phone || diagnosticCenter.contactInfo?.phone || [],
        email: contactInfo.email || diagnosticCenter.contactInfo?.email || diagnosticCenter.email,
        website: contactInfo.website || diagnosticCenter.contactInfo?.website || ''
      };
    }

    await diagnosticCenter.save();

    res.json({
      success: true,
      message: 'Diagnostic center profile updated successfully',
      data: { diagnosticCenter }
    });
  } catch (error) {
    console.error('Update diagnostic center profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update diagnostic center profile',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/dashboard
 * Get diagnostic center dashboard metrics
 */
export const getDiagnosticCenterDashboard = async (req, res) => {
  try {
    const { centerId } = req.params;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const today = moment().startOf('day').toDate();
    const thisMonth = moment().startOf('month').toDate();

    // Get total tests
    const totalTests = await Test.countDocuments({
      diagnosticCenterId: centerId,
      isActive: true
    });

    // Get today's orders
    const todayOrders = await Order.countDocuments({
      diagnosticCenterId: centerId,
      createdAt: { $gte: today }
    });

    // Get monthly orders
    const monthlyOrders = await Order.countDocuments({
      diagnosticCenterId: centerId,
      createdAt: { $gte: thisMonth }
    });

    // Get pending orders
    const pendingOrders = await Order.countDocuments({
      diagnosticCenterId: centerId,
      status: 'pending'
    });

    // Get completed orders
    const completedOrders = await Order.countDocuments({
      diagnosticCenterId: centerId,
      status: 'completed'
    });

    res.json({
      success: true,
      data: {
        metrics: {
          totalTests,
          todayOrders,
          monthlyOrders,
          pendingOrders,
          completedOrders
        },
        diagnosticCenter: {
          id: diagnosticCenter._id,
          name: diagnosticCenter.name,
          status: diagnosticCenter.status
        }
      }
    });
  } catch (error) {
    console.error('Get diagnostic center dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch diagnostic center dashboard',
      error: error.message
    });
  }
};

/**
 * POST /api/diagnostic-centers/:centerId/tests
 * Add a new test to diagnostic center
 */
export const addTest = async (req, res) => {
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
    const { name, code, category, description, price, duration, preparation, isPackage, packageTests } = req.body;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    if (diagnosticCenter.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Diagnostic center must be approved to add tests'
      });
    }

    // Check if code already exists
    if (code) {
      const existingTest = await Test.findOne({ code });
      if (existingTest) {
        return res.status(400).json({
          success: false,
          message: 'Test code already exists'
        });
      }
    }

    const test = await Test.create({
      name,
      code: code || undefined,
      category: category || 'other',
      description: description || '',
      price,
      duration: duration || 24,
      preparation: preparation || '',
      diagnosticCenterId: centerId,
      hospitalId: null,
      isActive: true,
      isPackage: isPackage || false,
      packageTests: packageTests || []
    });

    res.status(201).json({
      success: true,
      message: 'Test added successfully',
      data: { test }
    });
  } catch (error) {
    console.error('Add test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add test',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/tests
 * Get all tests for diagnostic center
 */
export const getTests = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { isActive, category, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const query = { diagnosticCenterId: centerId };
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    if (category) {
      query.category = category;
    }

    const tests = await Test.find(query)
      .populate('packageTests', 'name price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Test.countDocuments(query);

    res.json({
      success: true,
      data: {
        tests,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tests',
      error: error.message
    });
  }
};

/**
 * PUT /api/diagnostic-centers/:centerId/tests/:testId
 * Update a test
 */
export const updateTest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { centerId, testId } = req.params;
    const { name, code, category, description, price, duration, preparation, isActive, isPackage, packageTests } = req.body;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const test = await Test.findOne({
      _id: testId,
      diagnosticCenterId: centerId
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Check if code already exists (if changing code)
    if (code && code !== test.code) {
      const existingTest = await Test.findOne({ code, _id: { $ne: testId } });
      if (existingTest) {
        return res.status(400).json({
          success: false,
          message: 'Test code already exists'
        });
      }
    }

    // Update fields
    if (name !== undefined) test.name = name;
    if (code !== undefined) test.code = code;
    if (category !== undefined) test.category = category;
    if (description !== undefined) test.description = description;
    if (price !== undefined) test.price = price;
    if (duration !== undefined) test.duration = duration;
    if (preparation !== undefined) test.preparation = preparation;
    if (isActive !== undefined) test.isActive = isActive;
    if (isPackage !== undefined) test.isPackage = isPackage;
    if (packageTests !== undefined) test.packageTests = packageTests;

    await test.save();

    res.json({
      success: true,
      message: 'Test updated successfully',
      data: { test }
    });
  } catch (error) {
    console.error('Update test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update test',
      error: error.message
    });
  }
};

/**
 * DELETE /api/diagnostic-centers/:centerId/tests/:testId
 * Delete a test
 */
export const deleteTest = async (req, res) => {
  try {
    const { centerId, testId } = req.params;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const test = await Test.findOneAndDelete({
      _id: testId,
      diagnosticCenterId: centerId
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    res.json({
      success: true,
      message: 'Test deleted successfully'
    });
  } catch (error) {
    console.error('Delete test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete test',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/orders
 * Get all orders/bookings for diagnostic center
 */
export const getOrders = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const query = { diagnosticCenterId: centerId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('patientId', 'name email phone')
      .populate('tests.testId', 'name price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

/**
 * PUT /api/diagnostic-centers/:centerId/orders/:orderId/status
 * Update order status
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { centerId, orderId } = req.params;
    const { status } = req.body;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      diagnosticCenterId: centerId
    }).populate('patientId', 'name email phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const oldStatus = order.status;
    order.status = status;
    
    if (status === 'completed') {
      order.completedAt = new Date();
    }

    await order.save();

    const io = req.app.get('io');

    // Send notification to patient
    await createAndSendNotification(
      io,
      order.patientId._id,
      'order_status_update',
      'Order Status Updated',
      `Your diagnostic order #${order.orderNumber} status has been updated to ${status}`,
      order._id,
      'order'
    );

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { order }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
};

/**
 * POST /api/diagnostic-centers/:centerId/orders/:orderId/reports
 * Upload patient report
 */
export const uploadReport = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { centerId, orderId } = req.params;
    const { testId, reportPath } = req.body;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const order = await Order.findById(orderId);
    if (!order || order.diagnosticCenterId?.toString() !== centerId) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if test exists in order
    const testInOrder = order.tests.find(t => t.testId.toString() === testId);
    if (!testInOrder) {
      return res.status(400).json({
        success: false,
        message: 'Test not found in this order'
      });
    }

    // Add or update report
    const existingReportIndex = order.reports.findIndex(r => r.testId.toString() === testId);
    
    if (existingReportIndex >= 0) {
      // Update existing report
      order.reports[existingReportIndex].reportPath = reportPath;
      order.reports[existingReportIndex].uploadedAt = new Date();
      order.reports[existingReportIndex].uploadedBy = req.user._id;
    } else {
      // Add new report
      order.reports.push({
        testId,
        reportPath,
        uploadedAt: new Date(),
        uploadedBy: req.user._id
      });
    }

    await order.save();

    const io = req.app.get('io');

    // Send notification to patient
    await createAndSendNotification(
      io,
      order.patientId,
      'report_ready',
      'Test Report Ready',
      `Your test report for order #${order.orderNumber} is ready`,
      order._id,
      'order'
    );

    res.json({
      success: true,
      message: 'Report uploaded successfully',
      data: { order }
    });
  } catch (error) {
    console.error('Upload report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload report',
      error: error.message
    });
  }
};

/**
 * POST /api/diagnostic-centers/:centerId/home-services
 * Create a new home service for the diagnostic center
 */
export const createHomeService = async (req, res) => {
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
    const { serviceType, price, note, availableTime, offDays } = req.body;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    if (diagnosticCenter.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Diagnostic center must be approved to add home services'
      });
    }

    // Validate availableTime format
    if (availableTime) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (availableTime.startTime && !timeRegex.test(availableTime.startTime)) {
        return res.status(400).json({
          success: false,
          message: 'Start time must be in HH:mm format (e.g., 09:00)'
        });
      }
      if (availableTime.endTime && !timeRegex.test(availableTime.endTime)) {
        return res.status(400).json({
          success: false,
          message: 'End time must be in HH:mm format (e.g., 17:00)'
        });
      }

      // Validate that endTime is after startTime
      if (availableTime.startTime && availableTime.endTime) {
        const [startHour, startMin] = availableTime.startTime.split(':').map(Number);
        const [endHour, endMin] = availableTime.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (endMinutes <= startMinutes) {
          return res.status(400).json({
            success: false,
            message: 'End time must be after start time'
          });
        }
      }
    }

    // Validate offDays
    if (offDays && Array.isArray(offDays)) {
      const invalidDays = offDays.filter(day => day < 0 || day > 6 || !Number.isInteger(day));
      if (invalidDays.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Off days must be integers between 0 (Sunday) and 6 (Saturday)'
        });
      }
    }

    // Create home service
    const homeService = await HomeService.create({
      diagnosticCenterId: centerId,
      hospitalId: null,
      serviceType: serviceType.trim(),
      price,
      note: note ? note.trim() : '',
      availableTime: availableTime || { startTime: '09:00', endTime: '17:00' },
      offDays: offDays || [],
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Home service created successfully',
      data: { homeService }
    });
  } catch (error) {
    console.error('Create home service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create home service',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/home-services
 * Get all home services for a diagnostic center
 */
export const getHomeServices = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { isActive, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const query = { diagnosticCenterId: centerId };
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const homeServices = await HomeService.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HomeService.countDocuments(query);

    res.json({
      success: true,
      data: {
        homeServices,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get home services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home services',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/home-services/:serviceId
 * Get a specific home service
 */
export const getHomeService = async (req, res) => {
  try {
    const { centerId, serviceId } = req.params;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const homeService = await HomeService.findOne({
      _id: serviceId,
      diagnosticCenterId: centerId
    });

    if (!homeService) {
      return res.status(404).json({
        success: false,
        message: 'Home service not found'
      });
    }

    const serialSettings = await HomeServiceSerialSettings.findOne({
      homeServiceId: serviceId,
      diagnosticCenterId: centerId
    });
    const homeServiceObj = homeService.toObject();
    homeServiceObj.serialBooking = buildSerialBookingSummary(serialSettings, homeService);

    res.json({
      success: true,
      data: { homeService: homeServiceObj }
    });
  } catch (error) {
    console.error('Get home service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home service',
      error: error.message
    });
  }
};

/**
 * PUT /api/diagnostic-centers/:centerId/home-services/:serviceId
 * Update a home service
 */
export const updateHomeService = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { centerId, serviceId } = req.params;
    const { serviceType, price, note, availableTime, offDays, isActive } = req.body;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const homeService = await HomeService.findOne({
      _id: serviceId,
      diagnosticCenterId: centerId
    });

    if (!homeService) {
      return res.status(404).json({
        success: false,
        message: 'Home service not found'
      });
    }

    // Validate availableTime if provided
    if (availableTime) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (availableTime.startTime && !timeRegex.test(availableTime.startTime)) {
        return res.status(400).json({
          success: false,
          message: 'Start time must be in HH:mm format'
        });
      }
      if (availableTime.endTime && !timeRegex.test(availableTime.endTime)) {
        return res.status(400).json({
          success: false,
          message: 'End time must be in HH:mm format'
        });
      }

      if (availableTime.startTime && availableTime.endTime) {
        const [startHour, startMin] = availableTime.startTime.split(':').map(Number);
        const [endHour, endMin] = availableTime.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (endMinutes <= startMinutes) {
          return res.status(400).json({
            success: false,
            message: 'End time must be after start time'
          });
        }
      }
    }

    // Update fields
    if (serviceType !== undefined) homeService.serviceType = serviceType.trim();
    if (price !== undefined) homeService.price = price;
    if (note !== undefined) homeService.note = note.trim();
    if (availableTime !== undefined) homeService.availableTime = availableTime;
    if (offDays !== undefined) homeService.offDays = offDays;
    if (isActive !== undefined) homeService.isActive = isActive;

    await homeService.save();

    res.json({
      success: true,
      message: 'Home service updated successfully',
      data: { homeService }
    });
  } catch (error) {
    console.error('Update home service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update home service',
      error: error.message
    });
  }
};

/**
 * DELETE /api/diagnostic-centers/:centerId/home-services/:serviceId
 * Delete a home service
 */
export const deleteHomeService = async (req, res) => {
  try {
    const { centerId, serviceId } = req.params;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const homeService = await HomeService.findOneAndDelete({
      _id: serviceId,
      diagnosticCenterId: centerId
    });

    if (!homeService) {
      return res.status(404).json({
        success: false,
        message: 'Home service not found'
      });
    }

    res.json({
      success: true,
      message: 'Home service deleted successfully'
    });
  } catch (error) {
    console.error('Delete home service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete home service',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/home-service-requests
 * Get all home service requests for a diagnostic center
 */
export const getHomeServiceRequests = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Verify diagnostic center exists
    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    // Build query
    const query = { diagnosticCenterId: centerId };
    if (status) {
      query.status = status;
    }

    const requests = await HomeServiceRequest.find(query)
      .populate('patientId', 'name email phone')
      .populate('homeServiceId', 'serviceType price note')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HomeServiceRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        requests,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get home service requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home service requests',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/home-service-requests/:requestId
 * Get a specific home service request
 */
export const getHomeServiceRequest = async (req, res) => {
  try {
    const { centerId, requestId } = req.params;

    const request = await HomeServiceRequest.findOne({
      _id: requestId,
      diagnosticCenterId: centerId
    })
      .populate('patientId', 'name email phone')
      .populate('homeServiceId', 'serviceType price note availableTime')
      .populate('acceptedBy', 'name email')
      .populate('rejectedBy', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Home service request not found'
      });
    }

    res.json({
      success: true,
      data: { request }
    });
  } catch (error) {
    console.error('Get home service request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home service request',
      error: error.message
    });
  }
};

/**
 * PUT /api/diagnostic-centers/:centerId/home-service-requests/:requestId/accept
 * Accept a home service request
 */
export const acceptHomeServiceRequest = async (req, res) => {
  try {
    const { centerId, requestId } = req.params;
    const { notes } = req.body;

    // Verify diagnostic center exists
    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const request = await HomeServiceRequest.findOne({
      _id: requestId,
      diagnosticCenterId: centerId
    }).populate('patientId', 'name email phone');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Home service request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request cannot be accepted. Current status: ${request.status}`
      });
    }

    // Update request status
    request.status = 'accepted';
    request.acceptedAt = new Date();
    request.acceptedBy = req.user._id;
    if (notes) {
      request.notes = notes;
    }
    await request.save();

    const io = req.app.get('io');

    // Send notification to patient
    await createAndSendNotification(
      io,
      request.patientId._id,
      'order_status_update',
      'Home Service Request Accepted',
      `Your home service request #${request.requestNumber} has been accepted by ${diagnosticCenter.name}`,
      request._id,
      'order'
    );

    res.json({
      success: true,
      message: 'Home service request accepted successfully',
      data: { request }
    });
  } catch (error) {
    console.error('Accept home service request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept home service request',
      error: error.message
    });
  }
};

/**
 * PUT /api/diagnostic-centers/:centerId/home-service-requests/:requestId/reject
 * Reject a home service request
 */
export const rejectHomeServiceRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { centerId, requestId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    // Verify diagnostic center exists
    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const request = await HomeServiceRequest.findOne({
      _id: requestId,
      diagnosticCenterId: centerId
    }).populate('patientId', 'name email phone');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Home service request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request cannot be rejected. Current status: ${request.status}`
      });
    }

    // Update request status
    request.status = 'rejected';
    request.rejectedAt = new Date();
    request.rejectedBy = req.user._id;
    request.rejectionReason = rejectionReason.trim();
    await request.save();

    const io = req.app.get('io');

    // Send notification to patient
    await createAndSendNotification(
      io,
      request.patientId._id,
      'order_status_update',
      'Home Service Request Rejected',
      `Your home service request #${request.requestNumber} has been rejected. Reason: ${rejectionReason}`,
      request._id,
      'order'
    );

    res.json({
      success: true,
      message: 'Home service request rejected successfully',
      data: { request }
    });
  } catch (error) {
    console.error('Reject home service request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject home service request',
      error: error.message
    });
  }
};

/**
 * POST /api/diagnostic-centers/:centerId/tests/:testId/serial-settings
 * Create or update test serial settings
 */
export const createOrUpdateTestSerialSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { centerId, testId } = req.params;
    const { totalSerialsPerDay, serialTimeRange, testPrice, availableDays, isActive } = req.body;

    // Verify diagnostic center exists and is approved
    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    if (diagnosticCenter.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Diagnostic center must be approved to manage test serial settings'
      });
    }

    // Verify test exists and belongs to this diagnostic center
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    if (test.diagnosticCenterId?.toString() !== centerId) {
      return res.status(400).json({
        success: false,
        message: 'Test does not belong to this diagnostic center'
      });
    }

    // Validate time range
    if (serialTimeRange) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (serialTimeRange.startTime && !timeRegex.test(serialTimeRange.startTime)) {
        return res.status(400).json({
          success: false,
          message: 'Start time must be in HH:mm format'
        });
      }
      if (serialTimeRange.endTime && !timeRegex.test(serialTimeRange.endTime)) {
        return res.status(400).json({
          success: false,
          message: 'End time must be in HH:mm format'
        });
      }

      if (serialTimeRange.startTime && serialTimeRange.endTime) {
        const [startHour, startMin] = serialTimeRange.startTime.split(':').map(Number);
        const [endHour, endMin] = serialTimeRange.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (endMinutes <= startMinutes) {
          return res.status(400).json({
            success: false,
            message: 'End time must be after start time'
          });
        }
      }
    }

    // Find or create serial settings
    let serialSettings = await TestSerialSettings.findOne({
      testId,
      diagnosticCenterId: centerId
    });

    if (serialSettings) {
      // Update existing settings
      if (totalSerialsPerDay !== undefined) serialSettings.totalSerialsPerDay = totalSerialsPerDay;
      if (serialTimeRange !== undefined) serialSettings.serialTimeRange = serialTimeRange;
      if (testPrice !== undefined) serialSettings.testPrice = testPrice;
      if (availableDays !== undefined) serialSettings.availableDays = availableDays;
      if (isActive !== undefined) serialSettings.isActive = isActive;
      
      await serialSettings.save();
    } else {
      // Create new settings
      serialSettings = await TestSerialSettings.create({
        testId,
        diagnosticCenterId: centerId,
        totalSerialsPerDay: totalSerialsPerDay || 20,
        serialTimeRange: serialTimeRange || { startTime: '09:00', endTime: '17:00' },
        testPrice: testPrice !== undefined ? testPrice : test.price,
        availableDays: availableDays || [],
        isActive: isActive !== undefined ? isActive : true
      });
    }

    res.json({
      success: true,
      message: 'Test serial settings saved successfully',
      data: { serialSettings }
    });
  } catch (error) {
    console.error('Create/update test serial settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save test serial settings',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/tests/:testId/serial-settings
 * Get test serial settings
 */
export const getTestSerialSettings = async (req, res) => {
  try {
    const { centerId, testId } = req.params;

    const serialSettings = await TestSerialSettings.findOne({
      testId,
      diagnosticCenterId: centerId
    }).populate('testId', 'name code category price').populate('diagnosticCenterId', 'name');

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Test serial settings not found'
      });
    }

    res.json({
      success: true,
      data: { serialSettings }
    });
  } catch (error) {
    console.error('Get test serial settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test serial settings',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/tests/:testId/serial-stats
 * Get test serial statistics
 */
export const getTestSerialStats = async (req, res) => {
  try {
    const { centerId, testId } = req.params;
    const { date } = req.query;

    const serialSettings = await TestSerialSettings.findOne({
      testId,
      diagnosticCenterId: centerId
    });

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Test serial settings not found'
      });
    }

    // Build date range query
    let dateQuery = {};
    if (date) {
      const startDate = moment(date).startOf('day').toDate();
      const endDate = moment(date).endOf('day').toDate();
      dateQuery = {
        appointmentDate: {
          $gte: startDate,
          $lte: endDate
        }
      };
    } else {
      // Get stats for today
      const startDate = moment().startOf('day').toDate();
      const endDate = moment().endOf('day').toDate();
      dateQuery = {
        appointmentDate: {
          $gte: startDate,
          $lte: endDate
        }
      };
    }

    // Get booked serials
    const bookedSerials = await TestSerialBooking.find({
      testId,
      diagnosticCenterId: centerId,
      ...dateQuery,
      status: { $in: ['pending', 'confirmed'] }
    }).populate('patientId', 'name email phone');

    const totalBooked = bookedSerials.length;
    const availableSerials = serialSettings.totalSerialsPerDay;
    const evenNumberedSerials = Math.floor(availableSerials / 2);
    const bookedEvenSerials = bookedSerials.filter(booking => booking.serialNumber % 2 === 0).length;

    res.json({
      success: true,
      data: {
        serialSettings: {
          totalSerialsPerDay: serialSettings.totalSerialsPerDay,
          evenNumberedSerialsAvailable: evenNumberedSerials,
          testPrice: serialSettings.testPrice,
          timeRange: serialSettings.serialTimeRange,
          isActive: serialSettings.isActive
        },
        statistics: {
          date: date || moment().format('YYYY-MM-DD'),
          totalBooked: totalBooked,
          bookedEvenSerials: bookedEvenSerials,
          availableEvenSerials: evenNumberedSerials - bookedEvenSerials,
          bookings: bookedSerials.map(booking => ({
            bookingNumber: booking.bookingNumber,
            serialNumber: booking.serialNumber,
            patient: {
              name: booking.patientName,
              email: booking.patientEmail,
              phone: booking.patientPhone
            },
            time: booking.timeSlot.startTime,
            status: booking.status
          }))
        }
      }
    });
  } catch (error) {
    console.error('Get test serial stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test serial statistics',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/test-serial-bookings
 * Get all test serial bookings for a diagnostic center
 */
export const getTestSerialBookings = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { status, date, testId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    // Build query
    const query = { diagnosticCenterId: centerId };
    if (status) {
      query.status = status;
    }
    if (testId) {
      query.testId = testId;
    }
    if (date) {
      const startDate = moment(date).startOf('day').toDate();
      const endDate = moment(date).endOf('day').toDate();
      query.appointmentDate = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const bookings = await TestSerialBooking.find(query)
      .populate('testId', 'name code category')
      .populate('patientId', 'name email phone')
      .sort({ appointmentDate: -1, serialNumber: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TestSerialBooking.countDocuments(query);

    res.json({
      success: true,
      data: {
        bookings,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get test serial bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test serial bookings',
      error: error.message
    });
  }
};

/**
 * POST /api/diagnostic-centers/:centerId/home-services/:serviceId/serial-settings
 */
export const createOrUpdateHomeServiceSerialSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { centerId, serviceId } = req.params;
    const { totalSerialsPerDay, serialTimeRange, servicePrice, availableDays, isActive } = req.body;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({ success: false, message: 'Diagnostic center not found' });
    }
    if (diagnosticCenter.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Diagnostic center must be approved to manage home service serial settings'
      });
    }

    const homeService = await HomeService.findById(serviceId);
    if (!homeService) {
      return res.status(404).json({ success: false, message: 'Home service not found' });
    }
    if (homeService.diagnosticCenterId?.toString() !== centerId) {
      return res.status(400).json({
        success: false,
        message: 'Home service does not belong to this diagnostic center'
      });
    }

    if (serialTimeRange) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (serialTimeRange.startTime && !timeRegex.test(serialTimeRange.startTime)) {
        return res.status(400).json({ success: false, message: 'Start time must be in HH:mm format' });
      }
      if (serialTimeRange.endTime && !timeRegex.test(serialTimeRange.endTime)) {
        return res.status(400).json({ success: false, message: 'End time must be in HH:mm format' });
      }
      if (serialTimeRange.startTime && serialTimeRange.endTime) {
        const [startHour, startMin] = serialTimeRange.startTime.split(':').map(Number);
        const [endHour, endMin] = serialTimeRange.endTime.split(':').map(Number);
        if (endHour * 60 + endMin <= startHour * 60 + startMin) {
          return res.status(400).json({ success: false, message: 'End time must be after start time' });
        }
      }
    }

    let serialSettings = await HomeServiceSerialSettings.findOne({
      homeServiceId: serviceId,
      diagnosticCenterId: centerId
    });

    const defaultAvailableDays = availableDays ?? offDaysToAvailableDays(homeService.offDays);
    const defaultTimeRange = serialTimeRange || homeService.availableTime || { startTime: '09:00', endTime: '17:00' };

    if (serialSettings) {
      if (totalSerialsPerDay !== undefined) serialSettings.totalSerialsPerDay = totalSerialsPerDay;
      if (serialTimeRange !== undefined) serialSettings.serialTimeRange = serialTimeRange;
      if (servicePrice !== undefined) serialSettings.servicePrice = servicePrice;
      if (availableDays !== undefined) serialSettings.availableDays = availableDays;
      if (isActive !== undefined) serialSettings.isActive = isActive;
      await serialSettings.save();
    } else {
      serialSettings = await HomeServiceSerialSettings.create({
        homeServiceId: serviceId,
        diagnosticCenterId: centerId,
        totalSerialsPerDay: totalSerialsPerDay || 20,
        serialTimeRange: defaultTimeRange,
        servicePrice: servicePrice !== undefined ? servicePrice : homeService.price,
        availableDays: defaultAvailableDays,
        isActive: isActive !== undefined ? isActive : true
      });
    }

    res.json({
      success: true,
      message: 'Home service serial settings saved successfully',
      data: { serialSettings }
    });
  } catch (error) {
    console.error('Create/update diagnostic home service serial settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save home service serial settings',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/home-services/:serviceId/serial-settings
 */
export const getHomeServiceSerialSettings = async (req, res) => {
  try {
    const { centerId, serviceId } = req.params;

    const serialSettings = await HomeServiceSerialSettings.findOne({
      homeServiceId: serviceId,
      diagnosticCenterId: centerId
    })
      .populate('homeServiceId', 'serviceType price note availableTime offDays')
      .populate('diagnosticCenterId', 'name');

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Home service serial settings not found'
      });
    }

    res.json({ success: true, data: { serialSettings } });
  } catch (error) {
    console.error('Get diagnostic home service serial settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home service serial settings',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/home-services/:serviceId/serial-stats
 */
export const getHomeServiceSerialStats = async (req, res) => {
  try {
    const { centerId, serviceId } = req.params;
    const { date } = req.query;

    const serialSettings = await HomeServiceSerialSettings.findOne({
      homeServiceId: serviceId,
      diagnosticCenterId: centerId
    });

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Home service serial settings not found'
      });
    }

    let dateQuery = {};
    if (date) {
      dateQuery = {
        appointmentDate: {
          $gte: moment(date).startOf('day').toDate(),
          $lte: moment(date).endOf('day').toDate()
        }
      };
    } else {
      dateQuery = {
        appointmentDate: {
          $gte: moment().startOf('day').toDate(),
          $lte: moment().endOf('day').toDate()
        }
      };
    }

    const bookedSerials = await HomeServiceSerialBooking.find({
      homeServiceId: serviceId,
      diagnosticCenterId: centerId,
      ...dateQuery,
      status: { $in: ['pending', 'confirmed'] }
    }).populate('patientId', 'name email phone');

    const evenNumberedSerials = Math.floor(serialSettings.totalSerialsPerDay / 2);
    const bookedEvenSerials = bookedSerials.filter((b) => b.serialNumber % 2 === 0).length;

    res.json({
      success: true,
      data: {
        serialSettings: {
          totalSerialsPerDay: serialSettings.totalSerialsPerDay,
          evenNumberedSerialsAvailable: evenNumberedSerials,
          servicePrice: serialSettings.servicePrice,
          timeRange: serialSettings.serialTimeRange,
          isActive: serialSettings.isActive
        },
        statistics: {
          date: date || moment().format('YYYY-MM-DD'),
          totalBooked: bookedSerials.length,
          bookedEvenSerials,
          availableEvenSerials: evenNumberedSerials - bookedEvenSerials,
          bookings: bookedSerials.map((booking) => ({
            bookingNumber: booking.bookingNumber,
            serialNumber: booking.serialNumber,
            patient: {
              name: booking.patientName,
              email: booking.patientEmail,
              phone: booking.patientPhone
            },
            time: booking.timeSlot.startTime,
            status: booking.status,
            homeAddress: booking.homeAddress
          }))
        }
      }
    });
  } catch (error) {
    console.error('Get diagnostic home service serial stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home service serial statistics',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/home-service-serial-bookings
 */
export const getHomeServiceSerialBookings = async (req, res) => {
  try {
    const { centerId } = req.params;
    const {
      status,
      date,
      serviceId,
      serviceType,
      page = 1,
      limit = 20,
      sortBy = 'appointmentDate',
      sortOrder = 'desc'
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({ success: false, message: 'Diagnostic center not found' });
    }

    const query = { diagnosticCenterId: centerId };
    if (status) query.status = status;
    if (serviceId) query.homeServiceId = serviceId;
    if (serviceType) query.serviceType = new RegExp(serviceType, 'i');
    if (date) {
      query.appointmentDate = {
        $gte: moment(date).startOf('day').toDate(),
        $lte: moment(date).endOf('day').toDate()
      };
    }

    const sort = {};
    if (sortBy === 'date' || sortBy === 'appointmentDate') {
      sort.appointmentDate = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'serialNumber') {
      sort.serialNumber = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.appointmentDate = -1;
      sort.serialNumber = 1;
    }

    const bookings = await HomeServiceSerialBooking.find(query)
      .populate('homeServiceId', 'serviceType price note')
      .populate('patientId', 'name email phone')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HomeServiceSerialBooking.countDocuments(query);

    res.json({
      success: true,
      data: {
        bookings,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get diagnostic home service serial bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home service serial bookings',
      error: error.message
    });
  }
};

/**
 * PUT /api/diagnostic-centers/:centerId/home-service-serial-bookings/:bookingId/status
 */
export const updateHomeServiceSerialBookingStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { centerId, bookingId } = req.params;
    const { status, notes } = req.body;

    const booking = await HomeServiceSerialBooking.findOne({
      _id: bookingId,
      diagnosticCenterId: centerId
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.status = status;
    if (notes !== undefined) booking.notes = notes;
    if (status === 'completed') booking.completedAt = new Date();
    if (status === 'cancelled') {
      booking.cancelledAt = new Date();
      booking.cancelledBy = 'diagnostic_center';
    }

    await booking.save();

    const io = req.app.get('io');
    try {
      await createAndSendNotification(
        io,
        booking.patientId,
        'home_service_serial_update',
        'Home Service Serial Updated',
        `Your home service serial #${booking.serialNumber} is now ${status}`,
        booking._id,
        'home_service_booking'
      );
    } catch (notifError) {
      console.error('Failed to send patient notification:', notifError);
    }

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: { booking }
    });
  } catch (error) {
    console.error('Update diagnostic home service serial booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message
    });
  }
};

/**
 * PUT /api/diagnostic-centers/:centerId/home-service-serial-bookings/:bookingId
 */
export const updateHomeServiceSerialBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { centerId, bookingId } = req.params;
    const booking = await findProviderHomeServiceSerialBooking(bookingId, {
      diagnosticCenterId: centerId
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const result = await applyHomeServiceSerialBookingFields(booking, req.body, {
      cancelledBy: 'diagnostic_center'
    });

    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }

    const io = req.app.get('io');
    try {
      await createAndSendNotification(
        io,
        booking.patientId,
        'home_service_serial_update',
        'Home Service Serial Updated',
        `Your home service booking #${booking.serialNumber} has been updated`,
        booking._id,
        'home_service_booking'
      );
    } catch (notifError) {
      console.error('Failed to send patient notification:', notifError);
    }

    res.json({
      success: true,
      message: 'Serial booking updated successfully',
      data: { booking: result.booking }
    });
  } catch (error) {
    console.error('Update diagnostic home service serial booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update serial booking',
      error: error.message
    });
  }
};

/**
 * POST /api/diagnostic-centers/:centerId/doctors
 * Diagnostic center admin adds a new doctor (auto-approved)
 */
export const addDoctorByDiagnosticCenter = async (req, res) => {
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
    const {
      name,
      email,
      phone,
      password,
      medicalLicenseNumber,
      licenseDocumentUrl,
      specialization,
      qualifications,
      experienceYears,
      chamber,
      profilePhotoUrl
    } = req.body;

    // Verify diagnostic center exists and is approved
    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    if (diagnosticCenter.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Diagnostic center must be approved before adding doctors'
      });
    }

    // Check if doctor already exists (email, phone, or medical license number)
    // If exists, link them to this diagnostic center instead of creating new
    let doctor = await Doctor.findOne({
      $or: [
        { email },
        { phone },
        { medicalLicenseNumber }
      ]
    });

    if (doctor) {
      // Doctor already exists - link them to this diagnostic center
      // Check if already linked to this diagnostic center
      const alreadyLinked = diagnosticCenter.associatedDoctors.some(
        ad => ad.doctor.toString() === doctor._id.toString()
      );

      if (alreadyLinked) {
        return res.status(409).json({
          success: false,
          message: 'Doctor is already associated with this diagnostic center'
        });
      }

      // Update doctor's diagnosticCenterId if not set, or keep existing if already set to another center
      // Note: A doctor can have multiple diagnostic center associations via associatedDoctors array
      if (!doctor.diagnosticCenterId) {
        doctor.diagnosticCenterId = centerId;
        await doctor.save();
      }

      // Add doctor to diagnostic center's associated doctors
      diagnosticCenter.associatedDoctors.push({
        doctor: doctor._id,
        joinedAt: new Date()
      });
      await diagnosticCenter.save();
    } else {
      // Check User table to prevent conflicts
      const existingUser = await User.findOne({
        $or: [{ email }, { phone }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email or phone already registered as a user'
        });
      }

      // Create new doctor record
      const doctorData = {
        name,
        email,
        phone,
        password, // Will be hashed by pre-save hook
        bmdcNo: medicalLicenseNumber,
        medicalLicenseNumber,
        licenseDocumentUrl: licenseDocumentUrl || '',
        specialization: Array.isArray(specialization) ? specialization : [specialization],
        qualifications: qualifications || '',
        experienceYears,
        chamber: chamber || null,
        diagnosticCenterId: centerId,
        profilePhotoUrl: profilePhotoUrl || '',
        status: 'approved' // Auto-approved when added by diagnostic center admin
      };
      
      doctor = await Doctor.create(doctorData);

      // Add doctor to diagnostic center's associated doctors
      diagnosticCenter.associatedDoctors.push({
        doctor: doctor._id,
        joinedAt: new Date()
      });
      await diagnosticCenter.save();
    }

    // Log approval action
    await logApproval(
      req.user._id,
      'diagnostic_center_admin',
      'doctor',
      doctor._id,
      'approve',
      'Auto-approved by diagnostic center admin',
      null,
      'approved'
    );

    // Send notification (stub)
    await notifyEmail(
      email,
      'Doctor Account Created',
      'Your doctor account has been created and approved by the diagnostic center admin. You can now login.'
    );

    res.status(201).json({
      success: true,
      message: 'Doctor added and approved successfully',
      data: {
        doctor: {
          id: doctor._id,
          name: doctor.name,
          email: doctor.email,
          status: doctor.status,
          medicalLicenseNumber: doctor.medicalLicenseNumber
        }
      }
    });
  } catch (error) {
    console.error('Add doctor by diagnostic center error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add doctor',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/doctors
 * List doctors for a diagnostic center
 */
export const getDiagnosticCenterDoctors = async (req, res) => {
  try {
    const { centerId } = req.params;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    const doctors = await Doctor.find({ diagnosticCenterId: centerId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        doctors,
        diagnosticCenter: {
          id: diagnosticCenter._id,
          name: diagnosticCenter.name,
          status: diagnosticCenter.status
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch diagnostic center doctors',
      error: error.message
    });
  }
};

/**
 * POST /api/diagnostic-centers/:centerId/doctors/link
 * Link an existing approved doctor to diagnostic center
 */
export const linkDoctorToDiagnosticCenter = async (req, res) => {
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
    const { doctorId, designation, department } = req.body;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    if (diagnosticCenter.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Diagnostic center must be approved to link doctors'
      });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    if (doctor.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only verified (approved) doctors can be linked to diagnostic centers'
      });
    }

    // Check if doctor is already linked to this diagnostic center
    const alreadyLinked = diagnosticCenter.associatedDoctors.some(
      ad => ad.doctor.toString() === doctorId
    );

    if (alreadyLinked) {
      return res.status(409).json({
        success: false,
        message: 'Doctor is already linked to this diagnostic center'
      });
    }

    // Add doctor to diagnostic center's associated doctors
    diagnosticCenter.associatedDoctors.push({
      doctor: doctorId,
      designation: designation || '',
      department: department || '',
      joinedAt: new Date()
    });

    // Update doctor's diagnosticCenterId if not set, or keep existing if already set to another center
    // Note: A doctor can have multiple diagnostic center associations via associatedDoctors array
    // The diagnosticCenterId field stores the primary center, but associatedDoctors tracks all associations
    if (!doctor.diagnosticCenterId) {
      doctor.diagnosticCenterId = centerId;
      await doctor.save();
    }

    await diagnosticCenter.save();

    res.json({
      success: true,
      message: 'Doctor linked to diagnostic center successfully',
      data: {
        doctor: {
          id: doctor._id,
          name: doctor.name,
          email: doctor.email
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to link doctor to diagnostic center',
      error: error.message
    });
  }
};

/**
 * DELETE /api/diagnostic-centers/:centerId/doctors/:doctorId
 * Remove doctor from diagnostic center
 */
export const removeDoctorFromDiagnosticCenter = async (req, res) => {
  try {
    const { centerId, doctorId } = req.params;

    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    // Remove doctor from associated doctors
    diagnosticCenter.associatedDoctors = diagnosticCenter.associatedDoctors.filter(
      ad => ad.doctor.toString() !== doctorId
    );
    await diagnosticCenter.save();

    // Update doctor's diagnosticCenterId
    const doctor = await Doctor.findById(doctorId);
    if (doctor && doctor.diagnosticCenterId?.toString() === centerId) {
      doctor.diagnosticCenterId = null;
      await doctor.save();
    }

    res.json({
      success: true,
      message: 'Doctor removed from diagnostic center successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove doctor from diagnostic center',
      error: error.message
    });
  }
};

/**
 * POST /api/diagnostic-centers/:centerId/doctors/:doctorId/serial-settings
 * Create or update serial settings for a diagnostic center doctor
 */
export const createOrUpdateDoctorSerialSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { centerId, doctorId } = req.params;
    const { totalSerialsPerDay, serialTimeRange, appointmentPrice, availableDays, isActive } = req.body;

    // Verify diagnostic center exists and is approved
    const diagnosticCenter = await DiagnosticCenter.findById(centerId);
    if (!diagnosticCenter) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic center not found'
      });
    }

    if (diagnosticCenter.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Diagnostic center must be approved to manage serial settings'
      });
    }

    // Verify doctor exists and is associated with diagnostic center
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    if (doctor.diagnosticCenterId?.toString() !== centerId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor is not associated with this diagnostic center'
      });
    }

    // Validate time range
    if (serialTimeRange) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (serialTimeRange.startTime && !timeRegex.test(serialTimeRange.startTime)) {
        return res.status(400).json({
          success: false,
          message: 'Start time must be in HH:mm format'
        });
      }
      if (serialTimeRange.endTime && !timeRegex.test(serialTimeRange.endTime)) {
        return res.status(400).json({
          success: false,
          message: 'End time must be in HH:mm format'
        });
      }

      if (serialTimeRange.startTime && serialTimeRange.endTime) {
        const [startHour, startMin] = serialTimeRange.startTime.split(':').map(Number);
        const [endHour, endMin] = serialTimeRange.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (endMinutes <= startMinutes) {
          return res.status(400).json({
            success: false,
            message: 'End time must be after start time'
          });
        }
      }
    }

    // Find or create serial settings
    let serialSettings = await SerialSettings.findOne({
      doctorId,
      diagnosticCenterId: centerId
    });

    if (serialSettings) {
      // Update existing settings
      if (totalSerialsPerDay !== undefined) serialSettings.totalSerialsPerDay = totalSerialsPerDay;
      if (serialTimeRange !== undefined) serialSettings.serialTimeRange = serialTimeRange;
      if (appointmentPrice !== undefined) serialSettings.appointmentPrice = appointmentPrice;
      if (availableDays !== undefined) serialSettings.availableDays = availableDays;
      if (isActive !== undefined) serialSettings.isActive = isActive;
      
      await serialSettings.save();
    } else {
      // Create new settings
      serialSettings = await SerialSettings.create({
        doctorId,
        diagnosticCenterId: centerId,
        hospitalId: null,
        totalSerialsPerDay: totalSerialsPerDay || 20,
        serialTimeRange: serialTimeRange || { startTime: '09:00', endTime: '17:00' },
        appointmentPrice: appointmentPrice || 0,
        availableDays: availableDays || [],
        isActive: isActive !== undefined ? isActive : true
      });
    }

    res.json({
      success: true,
      message: 'Serial settings saved successfully',
      data: { serialSettings }
    });
  } catch (error) {
    console.error('Create/update doctor serial settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save serial settings',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/doctors/:doctorId/serial-settings
 * Get serial settings for a diagnostic center doctor
 */
export const getDoctorSerialSettings = async (req, res) => {
  try {
    const { centerId, doctorId } = req.params;

    const serialSettings = await SerialSettings.findOne({
      doctorId,
      diagnosticCenterId: centerId
    }).populate('doctorId', 'name email').populate('diagnosticCenterId', 'name');

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Serial settings not found'
      });
    }

    res.json({
      success: true,
      data: { serialSettings }
    });
  } catch (error) {
    console.error('Get doctor serial settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch serial settings',
      error: error.message
    });
  }
};

/**
 * GET /api/diagnostic-centers/:centerId/doctors/:doctorId/serial-stats
 * Get serial statistics for a diagnostic center doctor
 */
export const getDoctorSerialStats = async (req, res) => {
  try {
    const { centerId, doctorId } = req.params;
    const { date } = req.query;

    const serialSettings = await SerialSettings.findOne({
      doctorId,
      diagnosticCenterId: centerId
    });

    if (!serialSettings) {
      return res.status(404).json({
        success: false,
        message: 'Serial settings not found'
      });
    }

    // Build date range query
    let dateQuery = {};
    if (date) {
      const startDate = moment(date).startOf('day').toDate();
      const endDate = moment(date).endOf('day').toDate();
      dateQuery = {
        appointmentDate: {
          $gte: startDate,
          $lte: endDate
        }
      };
    } else {
      // Get stats for today
      const startDate = moment().startOf('day').toDate();
      const endDate = moment().endOf('day').toDate();
      dateQuery = {
        appointmentDate: {
          $gte: startDate,
          $lte: endDate
        }
      };
    }

    // Get booked serials
    const bookedAppointments = await Appointment.find({
      doctorId,
      ...dateQuery,
      status: { $in: ['pending', 'accepted'] }
    }).populate('patientId', 'name email phone');

    const totalBooked = bookedAppointments.length;
    const availableSerials = serialSettings.totalSerialsPerDay;
    const evenNumberedSerials = Math.floor(availableSerials / 2);
    const bookedEvenSerials = bookedAppointments.filter(apt => {
      const notes = apt.notes || '';
      const serialMatch = notes.match(/Serial #(\d+)/);
      if (serialMatch) {
        const serialNum = parseInt(serialMatch[1]);
        return serialNum % 2 === 0;
      }
      return false;
    }).length;

    res.json({
      success: true,
      data: {
        serialSettings: {
          totalSerialsPerDay: serialSettings.totalSerialsPerDay,
          evenNumberedSerialsAvailable: evenNumberedSerials,
          appointmentPrice: serialSettings.appointmentPrice,
          timeRange: serialSettings.serialTimeRange,
          isActive: serialSettings.isActive
        },
        statistics: {
          date: date || moment().format('YYYY-MM-DD'),
          totalBooked: totalBooked,
          bookedEvenSerials: bookedEvenSerials,
          availableEvenSerials: evenNumberedSerials - bookedEvenSerials,
          bookedPatients: bookedAppointments.map(apt => ({
            appointmentNumber: apt.appointmentNumber,
            patient: {
              name: apt.patientId.name,
              email: apt.patientId.email,
              phone: apt.patientId.phone
            },
            time: apt.timeSlot?.startTime,
            serialNumber: apt.notes ? apt.notes.match(/Serial #(\d+)/)?.[1] : null
          }))
        }
      }
    });
  } catch (error) {
    console.error('Get doctor serial stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch serial statistics',
      error: error.message
    });
  }
};


