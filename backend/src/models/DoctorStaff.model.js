import mongoose from 'mongoose';
import { DOCTOR_ROLE_KEYS } from '../constants/doctorPermissions.js';

const doctorStaffSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
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
    enum: DOCTOR_ROLE_KEYS,
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

doctorStaffSchema.index({ doctorId: 1, userId: 1 }, { unique: true });

const DoctorStaff = mongoose.model('DoctorStaff', doctorStaffSchema);

export default DoctorStaff;
