import express from 'express';
import { body } from 'express-validator';
import {
  getDashboardStats,
  createBanner,
  getBanners,
  updateBanner,
  broadcastNotification,
  exportData,
  createHospital,
  getAllHospitals,
  updateHospital,
  deleteHospital,
  getAllUsers,
  updateUser,
  deleteUser,
  getAllDoctors,
  updateDoctor,
  deleteDoctor,
  getAllDiagnosticCenters,
  createDiagnosticCenter,
  updateDiagnosticCenter,
  deleteDiagnosticCenter,
  getActivityLogs,
  getUserGrowth,
  getRecentRegistrations
} from '../controllers/admin.controller.js';
import {
  approveDoctor,
  rejectDoctor,
  approveHospital,
  rejectHospital,
  approveDiagnosticCenter,
  rejectDiagnosticCenter,
  getPendingItems
} from '../controllers/approval.controller.js';
import {
  getPermissionCatalog,
  getMyAdminAccess,
  listAdminTeam,
  createAdminTeamMember,
  updateAdminTeamMember,
  removeAdminTeamMember
} from '../controllers/superAdminStaff.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import {
  resolveSuperAdminContext,
  adminGuard
} from '../middlewares/superAdminPermission.middleware.js';
import upload, { uploadToCloudinaryMiddleware } from '../middlewares/upload.middleware.js';
import { normalizePhoneE164, isValidE164Phone } from '../utils/phone.util.js';

const router = express.Router();

const staffRoleValidator = ['admin', 'support', 'moderator', 'content_manager', 'viewer', 'custom'];

router.use(authenticate);
router.use(authorize('super_admin', 'super_admin_staff'));
router.use(resolveSuperAdminContext);

router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Admin routes are working' });
});

// Team & RBAC
router.get('/team/access', getMyAdminAccess);
router.get('/team/permissions', ...adminGuard('team:view'), getPermissionCatalog);
router.get('/team', ...adminGuard('team:view'), listAdminTeam);
router.post('/team', ...adminGuard('team:manage'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone')
    .trim()
    .customSanitizer(normalizePhoneE164)
    .notEmpty().withMessage('Phone number is required')
    .custom((value) => {
      if (!isValidE164Phone(value)) {
        throw new Error('Enter a valid phone number (e.g. +8801712345678)');
      }
      return true;
    }),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(staffRoleValidator).withMessage('Invalid role'),
  body('permissions').optional().isArray(),
  body('jobTitle').optional().trim()
], createAdminTeamMember);
router.put('/team/:staffId', ...adminGuard('team:manage'), [
  body('role').optional().isIn(staffRoleValidator),
  body('permissions').optional().isArray(),
  body('jobTitle').optional().trim(),
  body('isActive').optional().isBoolean()
], updateAdminTeamMember);
router.delete('/team/:staffId', ...adminGuard('team:manage'), removeAdminTeamMember);

// Dashboard & analytics
router.get('/dashboard/stats', ...adminGuard('dashboard:view'), getDashboardStats);
router.get('/user-growth', ...adminGuard('dashboard:view'), getUserGrowth);
router.get('/recent-registrations', ...adminGuard('dashboard:view'), getRecentRegistrations);

// Approvals
router.get('/pending', ...adminGuard('approvals:view'), getPendingItems);
router.post('/approve/doctor/:doctorId', ...adminGuard('approvals:manage'), [
  body('reason').optional().trim()
], approveDoctor);
router.post('/reject/doctor/:doctorId', ...adminGuard('approvals:manage'), [
  body('reason').notEmpty().withMessage('Rejection reason is required')
], rejectDoctor);
router.post('/approve/hospital/:hospitalId', ...adminGuard('approvals:manage'), [
  body('reason').optional().trim()
], approveHospital);
router.post('/reject/hospital/:hospitalId', ...adminGuard('approvals:manage'), [
  body('reason').notEmpty().withMessage('Rejection reason is required')
], rejectHospital);
router.post('/approve/diagnostic-center/:centerId', ...adminGuard('approvals:manage'), [
  body('reason').optional().trim()
], approveDiagnosticCenter);
router.post('/reject/diagnostic-center/:centerId', ...adminGuard('approvals:manage'), [
  body('reason').notEmpty().withMessage('Rejection reason is required')
], rejectDiagnosticCenter);

// Banners
router.post('/banners', ...adminGuard('banners:manage'), upload.single('banner'), uploadToCloudinaryMiddleware, [
  body('title').notEmpty().withMessage('Title is required')
], createBanner);
router.get('/banners', ...adminGuard('banners:view'), getBanners);
router.put('/banners/:bannerId', ...adminGuard('banners:manage'), upload.single('banner'), uploadToCloudinaryMiddleware, updateBanner);

// Notifications
router.post('/notifications/broadcast', ...adminGuard('notifications:broadcast'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required')
], broadcastNotification);

// Export
router.get('/export', ...adminGuard('export:data'), exportData);

// Users
router.get('/users', ...adminGuard('users:view'), getAllUsers);
router.put('/users/:userId', ...adminGuard('users:manage'), updateUser);
router.delete('/users/:userId', ...adminGuard('users:manage'), deleteUser);

// Doctors
router.get('/doctors', ...adminGuard('doctors:view'), getAllDoctors);
router.put('/doctors/:doctorId', ...adminGuard('doctors:manage'), updateDoctor);
router.delete('/doctors/:doctorId', ...adminGuard('doctors:manage'), deleteDoctor);

// Hospitals
router.get('/hospitals', ...adminGuard('hospitals:view'), getAllHospitals);
router.post('/hospitals', ...adminGuard('hospitals:manage'), [
  body('name').trim().notEmpty().withMessage('Hospital name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('address').notEmpty().withMessage('Address is required'),
  body('registrationNumber').notEmpty().withMessage('Registration number is required')
], createHospital);
router.put('/hospitals/:hospitalId', ...adminGuard('hospitals:manage'), updateHospital);
router.delete('/hospitals/:hospitalId', ...adminGuard('hospitals:manage'), deleteHospital);

// Diagnostic centers
router.get('/diagnostic-centers', ...adminGuard('diagnostic_centers:view'), getAllDiagnosticCenters);
router.post('/diagnostic-centers', ...adminGuard('diagnostic_centers:manage'), [
  body('name').trim().notEmpty().withMessage('Diagnostic center name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('address').notEmpty().withMessage('Address is required'),
  body('ownerName').trim().notEmpty().withMessage('Owner name is required'),
  body('ownerPhone').trim().notEmpty().withMessage('Owner phone is required'),
  body('tradeLicenseNumber').notEmpty().withMessage('Trade license number is required')
], createDiagnosticCenter);
router.put('/diagnostic-centers/:centerId', ...adminGuard('diagnostic_centers:manage'), updateDiagnosticCenter);
router.delete('/diagnostic-centers/:centerId', ...adminGuard('diagnostic_centers:manage'), deleteDiagnosticCenter);

// Activity logs
router.get('/activity-logs', ...adminGuard('activity_logs:view'), getActivityLogs);

export default router;
