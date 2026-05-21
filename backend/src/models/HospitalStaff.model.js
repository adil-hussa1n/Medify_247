import mongoose from 'mongoose';
import { HOSPITAL_ROLE_KEYS } from '../constants/hospitalPermissions.js';

const hospitalStaffSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
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
    enum: HOSPITAL_ROLE_KEYS,
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

hospitalStaffSchema.index({ hospitalId: 1, userId: 1 }, { unique: true });

const HospitalStaff = mongoose.model('HospitalStaff', hospitalStaffSchema);

export default HospitalStaff;
