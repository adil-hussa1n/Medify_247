import mongoose from 'mongoose';
import { SUPER_ADMIN_ROLE_KEYS } from '../constants/superAdminPermissions.js';

const superAdminStaffSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  role: {
    type: String,
    enum: SUPER_ADMIN_ROLE_KEYS.filter((r) => r !== 'owner'),
    required: true,
    default: 'viewer'
  },
  permissions: [{
    type: String
  }],
  jobTitle: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const SuperAdminStaff = mongoose.model('SuperAdminStaff', superAdminStaffSchema);

export default SuperAdminStaff;
