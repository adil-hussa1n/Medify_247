import express from 'express';
import { body } from 'express-validator';
import {
  registerHospital,
  addDoctorByHospital,
  getHospitalDoctors,
  approveDoctorByHospital,
  getHospitalProfile,
  updateHospitalProfile,
  searchVerifiedDoctors,
  linkDoctorToHospital,
  updateDoctorByHospital,
  removeDoctorFromHospital,
  getHospitalAppointments,
  updateHospitalAppointmentStatus,
  getHospitalDashboard,
  createHomeService,
  getHomeServices,
  getHomeService,
  updateHomeService,
  deleteHomeService,
  createOrUpdateSerialSettings,
  getSerialSettings,
  getSerialStats,
  createOrUpdateDateSerialSettings,
  getDateSerialSettings,
  deleteDateSerialSettings,
  getHomeServiceRequests,
  getHomeServiceRequest,
  acceptHomeServiceRequest,
  rejectHomeServiceRequest,
  addTest,
  getTests,
  updateTest,
  deleteTest,
  createOrUpdateTestSerialSettings,
  getTestSerialSettings,
  getTestSerialStats,
  getTestSerialBookings,
  updateTestSerialBookingStatus,
  createOrUpdateHomeServiceSerialSettings,
  getHomeServiceSerialSettings,
  getHomeServiceSerialStats,
  getHomeServiceSerialBookings,
  updateHomeServiceSerialBookingStatus,
  updateHomeServiceSerialBooking
} from '../controllers/hospital.controller.js';
import {
  getPermissionCatalog,
  getMyHospitalAccess,
  listHospitalStaff,
  createHospitalStaff,
  updateHospitalStaff,
  removeHospitalStaff
} from '../controllers/hospitalStaff.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { hospitalGuard } from '../middlewares/hospitalPermission.middleware.js';

const router = express.Router();

// Hospital registration (public - no auth required)
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Hospital name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Valid phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('address').notEmpty().withMessage('Address is required'),
  body('registrationNumber').notEmpty().withMessage('Registration number is required'),
  body('documents').optional()
], registerHospital);

// Hospital admin routes (require authentication and hospital admin role)
router.use(authenticate);
router.use(authorize('hospital_admin', 'super_admin'));

// RBAC — staff & permissions
router.get('/:hospitalId/access', ...hospitalGuard(), getMyHospitalAccess);
router.get('/:hospitalId/permissions', ...hospitalGuard('staff:view'), getPermissionCatalog);
router.get('/:hospitalId/staff', ...hospitalGuard('staff:view'), listHospitalStaff);
router.post('/:hospitalId/staff', ...hospitalGuard('staff:manage'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Valid phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['admin', 'manager', 'receptionist', 'lab_staff', 'viewer', 'custom']).withMessage('Invalid role'),
  body('permissions').optional().isArray(),
  body('jobTitle').optional().trim()
], createHospitalStaff);
router.put('/:hospitalId/staff/:staffId', ...hospitalGuard('staff:manage'), [
  body('role').optional().isIn(['admin', 'manager', 'receptionist', 'lab_staff', 'viewer', 'custom']),
  body('permissions').optional().isArray(),
  body('jobTitle').optional().trim(),
  body('isActive').optional().isBoolean()
], updateHospitalStaff);
router.delete('/:hospitalId/staff/:staffId', ...hospitalGuard('staff:manage'), removeHospitalStaff);

// Doctors
router.post('/:hospitalId/doctors', ...hospitalGuard('doctors:manage'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Valid phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('medicalLicenseNumber').notEmpty().withMessage('Medical license number is required'),
  body('licenseDocumentUrl').optional().isString().withMessage('License document URL must be a string'),
  body('specialization').notEmpty().withMessage('Specialization is required'),
  body('experienceYears').isInt({ min: 0 }).withMessage('Experience years must be a valid number')
], addDoctorByHospital);

router.get('/:hospitalId/doctors', ...hospitalGuard('doctors:view'), getHospitalDoctors);
router.post('/:hospitalId/approve/doctor/:doctorId', ...hospitalGuard('doctors:manage'), approveDoctorByHospital);

// Hospital Profile
router.get('/:hospitalId/profile', ...hospitalGuard('profile:view'), getHospitalProfile);
router.put('/:hospitalId/profile', ...hospitalGuard('profile:manage'), [
  body('name').optional().trim().notEmpty(),
  body('address').optional().trim().notEmpty(),
  body('contactInfo').optional().isObject(),
  body('departments').optional().isArray(),
  body('logo').optional().isString(),
  body('facilities').optional().isArray(),
  body('services').optional().isArray()
], updateHospitalProfile);

router.get('/:hospitalId/doctors/search', ...hospitalGuard('doctors:view'), searchVerifiedDoctors);
router.post('/:hospitalId/doctors/link', ...hospitalGuard('doctors:manage'), [
  body('doctorId').isMongoId().withMessage('Valid doctor ID is required'),
  body('designation').optional().trim(),
  body('department').optional().trim()
], linkDoctorToHospital);

router.put('/:hospitalId/doctors/:doctorId', ...hospitalGuard('doctors:manage'), [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().trim().matches(/^\+?[1-9]\d{1,14}$/).withMessage('Valid phone number is required'),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('specialization').optional(),
  body('qualifications').optional().trim(),
  body('experienceYears').optional().isInt({ min: 0 }).withMessage('Experience years must be a valid number'),
  body('licenseDocumentUrl').optional().isString().withMessage('License document URL must be a string'),
  body('profilePhotoUrl').optional().isString().withMessage('Profile photo URL must be a string')
], updateDoctorByHospital);

router.delete('/:hospitalId/doctors/:doctorId', ...hospitalGuard('doctors:manage'), removeDoctorFromHospital);

// Appointments
router.get('/:hospitalId/appointments', ...hospitalGuard('appointments:view'), getHospitalAppointments);
router.put('/:hospitalId/appointments/:appointmentId/status', ...hospitalGuard('appointments:manage'), [
  body('status').isIn(['accepted', 'rejected', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('notes').optional().trim()
], updateHospitalAppointmentStatus);

router.get('/:hospitalId/dashboard', ...hospitalGuard('dashboard:view'), getHospitalDashboard);

// Home Services
router.post('/:hospitalId/home-services', ...hospitalGuard('home_services:manage'), [
  body('serviceType').trim().notEmpty().withMessage('Service type is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('note').optional().trim(),
  body('availableTime.startTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:mm format'),
  body('availableTime.endTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:mm format'),
  body('offDays').optional().isArray().withMessage('Off days must be an array'),
  body('offDays.*').optional().isInt({ min: 0, max: 6 }).withMessage('Each off day must be between 0 (Sunday) and 6 (Saturday)')
], createHomeService);

router.get('/:hospitalId/home-services', ...hospitalGuard('home_services:view'), getHomeServices);
router.get('/:hospitalId/home-services/:serviceId', ...hospitalGuard('home_services:view'), getHomeService);

router.put('/:hospitalId/home-services/:serviceId', ...hospitalGuard('home_services:manage'), [
  body('serviceType').optional().trim().notEmpty(),
  body('price').optional().isFloat({ min: 0 }),
  body('note').optional().trim(),
  body('availableTime.startTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:mm format'),
  body('availableTime.endTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:mm format'),
  body('offDays').optional().isArray().withMessage('Off days must be an array'),
  body('offDays.*').optional().isInt({ min: 0, max: 6 }).withMessage('Each off day must be between 0 (Sunday) and 6 (Saturday)'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], updateHomeService);

router.delete('/:hospitalId/home-services/:serviceId', ...hospitalGuard('home_services:manage'), deleteHomeService);

router.post('/:hospitalId/home-services/:serviceId/serial-settings', ...hospitalGuard('home_serials:manage'), [
  body('totalSerialsPerDay').isInt({ min: 1 }).withMessage('Total serials per day must be a positive integer'),
  body('serialTimeRange.startTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:mm format'),
  body('serialTimeRange.endTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:mm format'),
  body('servicePrice').isFloat({ min: 0 }).withMessage('Service price must be a positive number'),
  body('availableDays').optional().isArray().withMessage('Available days must be an array'),
  body('availableDays.*').optional().isInt({ min: 0, max: 6 }).withMessage('Each day must be between 0 (Sunday) and 6 (Saturday)'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], createOrUpdateHomeServiceSerialSettings);

router.get('/:hospitalId/home-services/:serviceId/serial-settings', ...hospitalGuard('home_serials:view'), getHomeServiceSerialSettings);
router.get('/:hospitalId/home-services/:serviceId/serial-stats', ...hospitalGuard('home_serials:view'), getHomeServiceSerialStats);
router.get('/:hospitalId/home-service-serial-bookings', ...hospitalGuard('home_serials:view'), getHomeServiceSerialBookings);
router.put('/:hospitalId/home-service-serial-bookings/:bookingId/status', ...hospitalGuard('home_serials:manage'), [
  body('status').isIn(['pending', 'confirmed', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('notes').optional().trim()
], updateHomeServiceSerialBookingStatus);

router.put('/:hospitalId/home-service-serial-bookings/:bookingId', ...hospitalGuard('home_serials:manage'), [
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

// Doctor serial settings
router.post('/:hospitalId/doctors/:doctorId/serial-settings', ...hospitalGuard('doctors:manage'), [
  body('totalSerialsPerDay').isInt({ min: 1 }).withMessage('Total serials per day must be a positive integer'),
  body('serialTimeRange.startTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:mm format'),
  body('serialTimeRange.endTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:mm format'),
  body('appointmentPrice').isFloat({ min: 0 }).withMessage('Appointment price must be a positive number'),
  body('availableDays').optional().isArray().withMessage('Available days must be an array'),
  body('availableDays.*').optional().isInt({ min: 0, max: 6 }).withMessage('Each day must be between 0 (Sunday) and 6 (Saturday)'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], createOrUpdateSerialSettings);

router.get('/:hospitalId/doctors/:doctorId/serial-settings', ...hospitalGuard('doctors:view'), getSerialSettings);
router.get('/:hospitalId/doctors/:doctorId/serial-stats', ...hospitalGuard('doctors:view'), getSerialStats);

router.post('/:hospitalId/doctors/:doctorId/date-serial-settings', ...hospitalGuard('doctors:manage'), [
  body('date').isISO8601().withMessage('Valid date is required (YYYY-MM-DD)'),
  body('totalSerialsPerDay').isInt({ min: 1 }).withMessage('Total serials per day must be a positive integer'),
  body('adminNote').optional().trim().isLength({ max: 500 }).withMessage('Admin note must be less than 500 characters'),
  body('isEnabled').optional().isBoolean().withMessage('isEnabled must be a boolean'),
  body('serialTimeRange.startTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:mm format'),
  body('serialTimeRange.endTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:mm format'),
  body('appointmentPrice').optional().isFloat({ min: 0 }).withMessage('Appointment price must be a positive number')
], createOrUpdateDateSerialSettings);

router.get('/:hospitalId/doctors/:doctorId/date-serial-settings', ...hospitalGuard('doctors:view'), getDateSerialSettings);
router.delete('/:hospitalId/doctors/:doctorId/date-serial-settings/:dateSettingsId', ...hospitalGuard('doctors:manage'), deleteDateSerialSettings);

// Home service requests
router.get('/:hospitalId/home-service-requests', ...hospitalGuard('home_requests:view'), getHomeServiceRequests);
router.get('/:hospitalId/home-service-requests/:requestId', ...hospitalGuard('home_requests:view'), getHomeServiceRequest);
router.put('/:hospitalId/home-service-requests/:requestId/accept', ...hospitalGuard('home_requests:manage'), acceptHomeServiceRequest);
router.put('/:hospitalId/home-service-requests/:requestId/reject', ...hospitalGuard('home_requests:manage'), [
  body('rejectionReason').trim().notEmpty().withMessage('Rejection reason is required')
], rejectHomeServiceRequest);

// Tests
router.post('/:hospitalId/tests', ...hospitalGuard('tests:manage'), [
  body('name').trim().notEmpty().withMessage('Test name is required'),
  body('code').optional().trim(),
  body('category').optional().isIn(['pathology', 'radiology', 'cardiology', 'other']),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('duration').optional().isInt({ min: 0 }),
  body('isPackage').optional().isBoolean()
], addTest);

router.get('/:hospitalId/tests', ...hospitalGuard('tests:view'), getTests);

router.put('/:hospitalId/tests/:testId', ...hospitalGuard('tests:manage'), [
  body('name').optional().trim().notEmpty(),
  body('code').optional().trim(),
  body('category').optional().isIn(['pathology', 'radiology', 'cardiology', 'other']),
  body('price').optional().isFloat({ min: 0 }),
  body('duration').optional().isInt({ min: 0 }),
  body('isPackage').optional().isBoolean()
], updateTest);

router.delete('/:hospitalId/tests/:testId', ...hospitalGuard('tests:manage'), deleteTest);

router.post('/:hospitalId/tests/:testId/serial-settings', ...hospitalGuard('test_serials:manage'), [
  body('totalSerialsPerDay').isInt({ min: 1 }).withMessage('Total serials per day must be a positive integer'),
  body('serialTimeRange.startTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:mm format'),
  body('serialTimeRange.endTime').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:mm format'),
  body('testPrice').isFloat({ min: 0 }).withMessage('Test price must be a positive number'),
  body('availableDays').optional().isArray().withMessage('Available days must be an array'),
  body('availableDays.*').optional().isInt({ min: 0, max: 6 }).withMessage('Each day must be between 0 (Sunday) and 6 (Saturday)'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], createOrUpdateTestSerialSettings);

router.get('/:hospitalId/tests/:testId/serial-settings', ...hospitalGuard('test_serials:view'), getTestSerialSettings);
router.get('/:hospitalId/tests/:testId/serial-stats', ...hospitalGuard('test_serials:view'), getTestSerialStats);

router.get('/:hospitalId/test-serial-bookings', ...hospitalGuard('test_serials:view'), getTestSerialBookings);
router.put('/:hospitalId/test-serial-bookings/:bookingId/status', ...hospitalGuard('test_serials:manage'), [
  body('status').isIn(['pending', 'confirmed', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('notes').optional().trim()
], updateTestSerialBookingStatus);

export default router;
