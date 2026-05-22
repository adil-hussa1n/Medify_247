import mongoose from 'mongoose';
import { DC_ROLE_KEYS } from '../constants/diagnosticCenterPermissions.js';

const diagnosticCenterStaffSchema = new mongoose.Schema({
  diagnosticCenterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticCenter',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: DC_ROLE_KEYS,
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

diagnosticCenterStaffSchema.index({ diagnosticCenterId: 1, userId: 1 }, { unique: true });

const DiagnosticCenterStaff = mongoose.model('DiagnosticCenterStaff', diagnosticCenterStaffSchema);

export default DiagnosticCenterStaff;
