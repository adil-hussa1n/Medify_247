import express from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { doctorGuard } from '../middlewares/doctorPermission.middleware.js';
import {
  getPermissionCatalog,
  getMyDoctorAccess,
  listDoctorStaff,
  createDoctorStaff,
  updateDoctorStaff,
  removeDoctorStaff
} from '../controllers/doctorStaff.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize('doctor', 'doctor_staff', 'super_admin'));

router.get('/:doctorId/access', ...doctorGuard(), getMyDoctorAccess);
router.get('/:doctorId/permissions', ...doctorGuard('staff:view'), getPermissionCatalog);
router.get('/:doctorId/staff', ...doctorGuard('staff:view'), listDoctorStaff);
router.post('/:doctorId/staff', ...doctorGuard('staff:manage'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Valid phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['admin', 'assistant', 'receptionist', 'viewer', 'custom']).withMessage('Invalid role'),
  body('permissions').optional().isArray(),
  body('jobTitle').optional().trim()
], createDoctorStaff);
router.put('/:doctorId/staff/:staffId', ...doctorGuard('staff:manage'), [
  body('role').optional().isIn(['admin', 'assistant', 'receptionist', 'viewer', 'custom']),
  body('permissions').optional().isArray(),
  body('jobTitle').optional().trim(),
  body('isActive').optional().isBoolean()
], updateDoctorStaff);
router.delete('/:doctorId/staff/:staffId', ...doctorGuard('staff:manage'), removeDoctorStaff);

export default router;
