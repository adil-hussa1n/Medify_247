import express from 'express';
import { body } from 'express-validator';
import {
  getProfile,
  updateProfile,
  searchDoctors,
  getDoctorDetails,
  getAvailableSlots,
  bookAppointment,
  getMyAppointments,
  cancelAppointment,
  getMedicalRecords,
  downloadPrescription,
  getDiagnosticTests,
  createOrder,
  getMyOrders,
  getSpecializations,
  getDoctorSerialSettings,
  getAvailableSerials,
  bookSerial,
  getAllHomeServices,
  getHomeServiceDetails,
  submitHomeServiceRequest,
  getMyHistory,
  getAvailableTestSerials,
  bookTestSerial,
  getAvailableHomeServiceSerials,
  bookHomeServiceSerial,
  getMyHomeServiceSerialBookings,
  getMyTestSerialBookings
} from '../controllers/patient.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All routes require authentication and patient role
router.use(authenticate);
router.use(authorize('patient'));

// Profile routes
router.get('/profile', getProfile);
router.put('/profile', [
  body('name').optional().trim().notEmpty(),
  body('dateOfBirth').optional().isISO8601(),
  body('gender').optional().isIn(['male', 'female', 'other'])
], updateProfile);

// Doctor search and details
router.get('/doctors/search', searchDoctors);
router.get('/doctors/:doctorId', getDoctorDetails);
router.get('/doctors/:doctorId/slots', getAvailableSlots);
router.get('/specializations', getSpecializations);

// Serial booking
router.get('/doctors/:doctorId/serial-settings', getDoctorSerialSettings);
router.get('/doctors/:doctorId/serials', getAvailableSerials);
router.post('/serials/book', [
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('serialNumber').isInt({ min: 1 }).withMessage('Valid serial number is required'),
  body('date').isISO8601().withMessage('Valid date is required (YYYY-MM-DD)')
], bookSerial);

// Test Serial booking (Diagnostic Center)
router.get('/diagnostic-centers/:diagnosticCenterId/tests/:testId/serials', getAvailableTestSerials);

// Test Serial booking (Hospital)
router.get('/hospitals/:hospitalId/tests/:testId/serials', getAvailableTestSerials);

// Book Test Serial (supports both hospital and diagnostic center)
router.post('/test-serials/book', [
  body('testId').notEmpty().withMessage('Test ID is required'),
  body('hospitalId').optional().notEmpty().withMessage('Hospital ID is required if diagnosticCenterId is not provided'),
  body('diagnosticCenterId').optional().notEmpty().withMessage('Diagnostic center ID is required if hospitalId is not provided'),
  body('serialNumber').isInt({ min: 1 }).withMessage('Valid serial number is required'),
  body('date').isISO8601().withMessage('Valid date is required (YYYY-MM-DD)')
], bookTestSerial);
router.get('/test-serials/my-bookings', getMyTestSerialBookings);

// Home Services
router.get('/home-services', getAllHomeServices);
router.get('/home-services/:serviceId', getHomeServiceDetails);
router.post('/home-services/request', [
  body('hospitalId').optional().notEmpty(),
  body('diagnosticCenterId').optional().notEmpty(),
  body('homeServiceId').notEmpty().withMessage('Home service ID is required'),
  body('patientName').trim().notEmpty().withMessage('Patient name is required'),
  body('patientAge').isInt({ min: 0 }).withMessage('Valid patient age is required'),
  body('patientGender').isIn(['male', 'female', 'other']).withMessage('Valid gender is required'),
  body('homeAddress.street').trim().notEmpty().withMessage('Street address is required'),
  body('homeAddress.city').trim().notEmpty().withMessage('City is required'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  body('requestedDate').optional().isISO8601().withMessage('Valid requested date is required'),
  body('requestedTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Requested time must be in HH:mm format')
], submitHomeServiceRequest);

// Home Service Serial booking (Hospital)
router.get('/hospitals/:hospitalId/home-services/:serviceId/serials', getAvailableHomeServiceSerials);
router.post('/home-service-serials/book', [
  body('hospitalId').notEmpty().withMessage('Hospital ID is required'),
  body('homeServiceId').notEmpty().withMessage('Home service ID is required'),
  body('serialNumber').isInt({ min: 1 }).withMessage('Valid serial number is required'),
  body('date').isISO8601().withMessage('Valid date is required (YYYY-MM-DD)'),
  body('patientName').trim().notEmpty().withMessage('Patient name is required'),
  body('patientAge').isInt({ min: 0 }).withMessage('Valid patient age is required'),
  body('patientGender').isIn(['male', 'female', 'other']).withMessage('Valid gender is required'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  body('homeAddress.street').trim().notEmpty().withMessage('Street address is required'),
  body('homeAddress.city').trim().notEmpty().withMessage('City is required'),
  body('notes').optional().trim()
], bookHomeServiceSerial);
router.get('/home-service-serials/my-bookings', getMyHomeServiceSerialBookings);

// User History
router.get('/history', getMyHistory);

// Appointments
router.post('/appointments', [
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('chamberId').notEmpty().withMessage('Chamber ID is required'),
  body('appointmentDate').isISO8601().withMessage('Valid appointment date is required'),
  body('startTime').notEmpty().withMessage('Start time is required'),
  body('endTime').notEmpty().withMessage('End time is required')
], bookAppointment);
router.get('/appointments', getMyAppointments);
router.put('/appointments/:appointmentId/cancel', cancelAppointment);

// Medical records
router.get('/medical-records', getMedicalRecords);
router.get('/appointments/:appointmentId/prescription', downloadPrescription);

// Diagnostics
router.get('/diagnostics/tests', getDiagnosticTests);
router.post('/diagnostics/orders', [
  body('hospitalId').optional().notEmpty(),
  body('diagnosticCenterId').optional().notEmpty(),
  body('tests').isArray({ min: 1 }).withMessage('At least one test is required'),
  body('collectionType').isIn(['walk_in', 'home_collection']).withMessage('Invalid collection type')
], createOrder);
router.get('/diagnostics/orders', getMyOrders);

export default router;

