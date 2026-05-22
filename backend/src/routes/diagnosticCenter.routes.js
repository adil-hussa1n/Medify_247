import express from 'express';
import { body } from 'express-validator';
import {
  registerDiagnosticCenter,
  getDiagnosticCenterProfile,
  updateDiagnosticCenterProfile,
  getDiagnosticCenterDashboard,
  addTest,
  getTests,
  updateTest,
  deleteTest,
  getOrders,
  updateOrderStatus,
  uploadReport,
  createHomeService,
  getHomeServices,
  getHomeService,
  updateHomeService,
  deleteHomeService,
  getHomeServiceRequests,
  getHomeServiceRequest,
  acceptHomeServiceRequest,
  rejectHomeServiceRequest,
  createOrUpdateTestSerialSettings,
  getTestSerialSettings,
  getTestSerialStats,
  getTestSerialBookings,
  createOrUpdateHomeServiceSerialSettings,
  getHomeServiceSerialSettings,
  getHomeServiceSerialStats,
  getHomeServiceSerialBookings,
  updateHomeServiceSerialBookingStatus,
  updateHomeServiceSerialBooking,
  addDoctorByDiagnosticCenter,
  getDiagnosticCenterDoctors,
  linkDoctorToDiagnosticCenter,
  removeDoctorFromDiagnosticCenter,
  createOrUpdateDoctorSerialSettings,
  getDoctorSerialSettings,
  getDoctorSerialStats
} from '../controllers/diagnosticCenter.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { diagnosticCenterGuard } from '../middlewares/diagnosticCenterPermission.middleware.js';
import {
  getPermissionCatalog,
  getMyDiagnosticCenterAccess,
  listDiagnosticCenterStaff,
  createDiagnosticCenterStaff,
  updateDiagnosticCenterStaff,
  removeDiagnosticCenterStaff
} from '../controllers/diagnosticCenterStaff.controller.js';

const router = express.Router();

// Diagnostic center registration (public - no auth required)
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Diagnostic center name is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('address').notEmpty().withMessage('Physical address is required'),
  body('ownerName').trim().notEmpty().withMessage('Owner/Admin name is required'),
  body('ownerPhone').trim().notEmpty().withMessage('Owner/Admin phone number is required'),
  body('tradeLicenseNumber').trim().notEmpty().withMessage('Trade license/Registration document number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('tradeLicenseDocument').optional().isString()
], registerDiagnosticCenter);

// Diagnostic center admin routes (require authentication and diagnostic center admin role)
router.use(authenticate);
router.use(authorize('diagnostic_center_admin', 'super_admin'));

// RBAC — staff & permissions
router.get('/:centerId/access', ...diagnosticCenterGuard(), getMyDiagnosticCenterAccess);
router.get('/:centerId/permissions', ...diagnosticCenterGuard('staff:view'), getPermissionCatalog);
router.get('/:centerId/staff', ...diagnosticCenterGuard('staff:view'), listDiagnosticCenterStaff);
router.post('/:centerId/staff', ...diagnosticCenterGuard('staff:manage'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['admin', 'manager', 'lab_staff', 'receptionist', 'viewer', 'custom']).withMessage('Invalid role'),
  body('permissions').optional().isArray(),
  body('jobTitle').optional().trim()
], createDiagnosticCenterStaff);
router.put('/:centerId/staff/:staffId', ...diagnosticCenterGuard('staff:manage'), [
  body('role').optional().isIn(['admin', 'manager', 'lab_staff', 'receptionist', 'viewer', 'custom']),
  body('permissions').optional().isArray(),
  body('jobTitle').optional().trim(),
  body('isActive').optional().isBoolean()
], updateDiagnosticCenterStaff);
router.delete('/:centerId/staff/:staffId', ...diagnosticCenterGuard('staff:manage'), removeDiagnosticCenterStaff);

// Profile Management
router.get('/:centerId/profile', ...diagnosticCenterGuard('profile:view'), getDiagnosticCenterProfile);
router.put('/:centerId/profile', ...diagnosticCenterGuard('profile:manage'), [
  body('governmentRegistrationCertificate').optional().isString(),
  body('departments').optional().isArray(),
  body('operatingHours.openingTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Opening time must be in HH:mm format'),
  body('operatingHours.closingTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Closing time must be in HH:mm format'),
  body('homeSampleCollection').optional().isBoolean(),
  body('emergencyService').optional().isBoolean(),
  body('ambulanceService.available').optional().isBoolean(),
  body('ambulanceService.contactNumber').optional().trim(),
  body('numberOfLabTechnicians').optional().isInt({ min: 0 }),
  body('numberOfStaff').optional().isInt({ min: 0 }),
  body('reportingTime').optional().isIn(['same_day', '24_hours', 'depends_on_test']),
  body('reportDeliveryOptions.email').optional().isBoolean(),
  body('reportDeliveryOptions.onlinePortal').optional().isBoolean(),
  body('logo').optional().isString(),
  body('contactInfo').optional().isObject()
], updateDiagnosticCenterProfile);

// Dashboard
router.get('/:centerId/dashboard', ...diagnosticCenterGuard('dashboard:view'), getDiagnosticCenterDashboard);

// Test Management
router.post('/:centerId/tests', ...diagnosticCenterGuard('tests:manage'), [
  body('name').trim().notEmpty().withMessage('Test name is required'),
  body('code').optional().trim(),
  body('category').optional().isIn(['pathology', 'radiology', 'cardiology', 'other']),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('duration').optional().isInt({ min: 0 }),
  body('isPackage').optional().isBoolean()
], addTest);

router.get('/:centerId/tests', ...diagnosticCenterGuard('tests:view'), getTests);
router.put('/:centerId/tests/:testId', ...diagnosticCenterGuard('tests:manage'), [
  body('name').optional().trim().notEmpty(),
  body('code').optional().trim(),
  body('category').optional().isIn(['pathology', 'radiology', 'cardiology', 'other']),
  body('price').optional().isFloat({ min: 0 }),
  body('duration').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
  body('isPackage').optional().isBoolean()
], updateTest);
router.delete('/:centerId/tests/:testId', ...diagnosticCenterGuard('tests:manage'), deleteTest);

// Order Management
router.get('/:centerId/orders', ...diagnosticCenterGuard('orders:view'), getOrders);
router.put('/:centerId/orders/:orderId/status', ...diagnosticCenterGuard('orders:manage'), [
  body('status').isIn(['pending', 'sample_collected', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status')
], updateOrderStatus);

// Report Upload
router.post('/:centerId/orders/:orderId/reports', ...diagnosticCenterGuard('orders:manage'), [
  body('testId').notEmpty().withMessage('Test ID is required'),
  body('reportPath').notEmpty().withMessage('Report path is required')
], uploadReport);

// Home Services Management
router.post('/:centerId/home-services', ...diagnosticCenterGuard('home_services:manage'), [
  body('serviceType').trim().notEmpty().withMessage('Service type is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('note').optional().trim(),
  body('availableTime.startTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:mm format'),
  body('availableTime.endTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:mm format'),
  body('offDays').optional().isArray().withMessage('Off days must be an array'),
  body('offDays.*').optional().isInt({ min: 0, max: 6 }).withMessage('Each off day must be between 0 (Sunday) and 6 (Saturday)')
], createHomeService);

router.get('/:centerId/home-services', ...diagnosticCenterGuard('home_services:view'), getHomeServices);
router.get('/:centerId/home-services/:serviceId', ...diagnosticCenterGuard('home_services:view'), getHomeService);
router.put('/:centerId/home-services/:serviceId', ...diagnosticCenterGuard('home_services:manage'), [
  body('serviceType').optional().trim().notEmpty(),
  body('price').optional().isFloat({ min: 0 }),
  body('note').optional().trim(),
  body('availableTime.startTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  body('availableTime.endTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  body('offDays').optional().isArray(),
  body('isActive').optional().isBoolean()
], updateHomeService);
router.delete('/:centerId/home-services/:serviceId', ...diagnosticCenterGuard('home_services:manage'), deleteHomeService);

// Home Service Requests Management
router.get('/:centerId/home-service-requests', ...diagnosticCenterGuard('home_requests:view'), getHomeServiceRequests);
router.get('/:centerId/home-service-requests/:requestId', ...diagnosticCenterGuard('home_requests:view'), getHomeServiceRequest);
router.put('/:centerId/home-service-requests/:requestId/accept', ...diagnosticCenterGuard('home_requests:manage'), acceptHomeServiceRequest);
router.put('/:centerId/home-service-requests/:requestId/reject', ...diagnosticCenterGuard('home_requests:manage'), [
  body('rejectionReason').trim().notEmpty().withMessage('Rejection reason is required')
], rejectHomeServiceRequest);

// Test Serial Settings Management
router.post('/:centerId/tests/:testId/serial-settings', ...diagnosticCenterGuard('test_serials:manage'), [
  body('totalSerialsPerDay').isInt({ min: 1 }).withMessage('Total serials per day must be a positive integer'),
  body('serialTimeRange.startTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:mm format'),
  body('serialTimeRange.endTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:mm format'),
  body('testPrice').isFloat({ min: 0 }).withMessage('Test price must be a positive number'),
  body('availableDays').optional().isArray().withMessage('Available days must be an array'),
  body('availableDays.*').optional().isInt({ min: 0, max: 6 }).withMessage('Each day must be between 0 (Sunday) and 6 (Saturday)'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], createOrUpdateTestSerialSettings);

router.get('/:centerId/tests/:testId/serial-settings', ...diagnosticCenterGuard('test_serials:view'), getTestSerialSettings);

router.get('/:centerId/tests/:testId/serial-stats', ...diagnosticCenterGuard('test_serials:view'), getTestSerialStats);

// Test Serial Bookings Management
router.get('/:centerId/test-serial-bookings', ...diagnosticCenterGuard('test_serials:view'), getTestSerialBookings);

// Home Service Serial Settings Management
router.post('/:centerId/home-services/:serviceId/serial-settings', ...diagnosticCenterGuard('home_serials:manage'), [
  body('totalSerialsPerDay').isInt({ min: 1 }).withMessage('Total serials per day must be a positive integer'),
  body('serialTimeRange.startTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:mm format'),
  body('serialTimeRange.endTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:mm format'),
  body('servicePrice').isFloat({ min: 0 }).withMessage('Service price must be a positive number'),
  body('availableDays').optional().isArray().withMessage('Available days must be an array'),
  body('availableDays.*').optional().isInt({ min: 0, max: 6 }).withMessage('Each day must be between 0 (Sunday) and 6 (Saturday)'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], createOrUpdateHomeServiceSerialSettings);

router.get('/:centerId/home-services/:serviceId/serial-settings', ...diagnosticCenterGuard('home_serials:view'), getHomeServiceSerialSettings);
router.get('/:centerId/home-services/:serviceId/serial-stats', ...diagnosticCenterGuard('home_serials:view'), getHomeServiceSerialStats);
router.get('/:centerId/home-service-serial-bookings', ...diagnosticCenterGuard('home_serials:view'), getHomeServiceSerialBookings);
router.put('/:centerId/home-service-serial-bookings/:bookingId/status', ...diagnosticCenterGuard('home_serials:manage'), [
  body('status').isIn(['pending', 'confirmed', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('notes').optional().trim()
], updateHomeServiceSerialBookingStatus);

router.put('/:centerId/home-service-serial-bookings/:bookingId', ...diagnosticCenterGuard('home_serials:manage'), [
  body('status').optional().isIn(['pending', 'confirmed', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('notes').optional().trim(),
  body('date').optional().isISO8601().withMessage('Valid date is required (YYYY-MM-DD)'),
  body('serialNumber').optional().isInt({ min: 1 }).withMessage('Valid serial number is required'),
  body('patientName').optional().trim().notEmpty(),
  body('patientAge').optional().isInt({ min: 0 }),
  body('patientGender').optional().isIn(['male', 'female', 'other']),
  body('phoneNumber').optional().trim().notEmpty(),
  body('homeAddress.street').optional().trim().notEmpty(),
  body('homeAddress.city').optional().trim().notEmpty()
], updateHomeServiceSerialBooking);

// Doctor Management
router.post('/:centerId/doctors', ...diagnosticCenterGuard('doctors:manage'), [
  body('name').trim().notEmpty().withMessage('Doctor name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('medicalLicenseNumber').trim().notEmpty().withMessage('Medical license number is required'),
  body('specialization').notEmpty().withMessage('Specialization is required'),
  body('experienceYears').isInt({ min: 0 }).withMessage('Experience years must be a non-negative integer'),
  body('licenseDocumentUrl').optional().isString(),
  body('qualifications').optional().isString(),
  body('chamber').optional().isObject(),
  body('profilePhotoUrl').optional().isString()
], addDoctorByDiagnosticCenter);

router.get('/:centerId/doctors', ...diagnosticCenterGuard('doctors:view'), getDiagnosticCenterDoctors);

router.post('/:centerId/doctors/link', ...diagnosticCenterGuard('doctors:manage'), [
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('designation').optional().trim(),
  body('department').optional().trim()
], linkDoctorToDiagnosticCenter);

router.delete('/:centerId/doctors/:doctorId', ...diagnosticCenterGuard('doctors:manage'), removeDoctorFromDiagnosticCenter);

// Doctor Serial Settings Management
router.post('/:centerId/doctors/:doctorId/serial-settings', ...diagnosticCenterGuard('doctors:manage'), [
  body('totalSerialsPerDay').isInt({ min: 1 }).withMessage('Total serials per day must be a positive integer'),
  body('serialTimeRange.startTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:mm format'),
  body('serialTimeRange.endTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:mm format'),
  body('appointmentPrice').isFloat({ min: 0 }).withMessage('Appointment price must be a positive number'),
  body('availableDays').optional().isArray().withMessage('Available days must be an array'),
  body('availableDays.*').optional().isInt({ min: 0, max: 6 }).withMessage('Each day must be between 0 (Sunday) and 6 (Saturday)'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], createOrUpdateDoctorSerialSettings);

router.get('/:centerId/doctors/:doctorId/serial-settings', ...diagnosticCenterGuard('doctors:view'), getDoctorSerialSettings);

router.get('/:centerId/doctors/:doctorId/serial-stats', ...diagnosticCenterGuard('doctors:view'), getDoctorSerialStats);

export default router;

