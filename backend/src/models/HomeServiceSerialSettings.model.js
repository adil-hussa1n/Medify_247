import mongoose from 'mongoose';

const homeServiceSerialSettingsSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    index: true
  },
  homeServiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HomeService',
    required: true
  },
  totalSerialsPerDay: {
    type: Number,
    required: true,
    min: 1,
    default: 20
  },
  serialTimeRange: {
    startTime: {
      type: String,
      required: true,
      match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:mm format']
    },
    endTime: {
      type: String,
      required: true,
      match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:mm format']
    }
  },
  servicePrice: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  availableDays: [{
    type: Number,
    min: 0,
    max: 6
  }],
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

homeServiceSerialSettingsSchema.pre('save', function(next) {
  if (this.serialTimeRange?.startTime && this.serialTimeRange?.endTime) {
    const [startHour, startMin] = this.serialTimeRange.startTime.split(':').map(Number);
    const [endHour, endMin] = this.serialTimeRange.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      return next(new Error('End time must be after start time'));
    }
  }
  next();
});

homeServiceSerialSettingsSchema.index({ homeServiceId: 1, hospitalId: 1 }, { unique: true });
homeServiceSerialSettingsSchema.index({ hospitalId: 1, homeServiceId: 1 });
homeServiceSerialSettingsSchema.index({ homeServiceId: 1, isActive: 1 });

const HomeServiceSerialSettings = mongoose.model('HomeServiceSerialSettings', homeServiceSerialSettingsSchema);

export default HomeServiceSerialSettings;
