import mongoose from 'mongoose';

const homeServiceSerialBookingSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    index: true
  },
  homeServiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HomeService',
    required: true,
    index: true
  },
  bookingNumber: {
    type: String,
    required: true,
    unique: true
  },
  serialNumber: {
    type: Number,
    required: true
  },
  appointmentDate: {
    type: Date,
    required: true,
    index: true
  },
  timeSlot: {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true }
  },
  servicePrice: {
    type: Number,
    required: true
  },
  serviceType: {
    type: String,
    required: true
  },
  patientName: {
    type: String,
    required: true
  },
  patientAge: {
    type: Number,
    required: true,
    min: 0
  },
  patientGender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  patientEmail: {
    type: String,
    required: true
  },
  patientPhone: {
    type: String,
    required: true
  },
  homeAddress: {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  notes: {
    type: String
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: String,
    enum: ['patient', 'hospital', 'system']
  },
  cancellationReason: {
    type: String
  },
  completedAt: {
    type: Date
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

homeServiceSerialBookingSchema.index({ patientId: 1, createdAt: -1 });
homeServiceSerialBookingSchema.index({ hospitalId: 1, appointmentDate: 1, status: 1 });
homeServiceSerialBookingSchema.index({ homeServiceId: 1, appointmentDate: 1, serialNumber: 1 });
homeServiceSerialBookingSchema.index(
  { hospitalId: 1, homeServiceId: 1, appointmentDate: 1, serialNumber: 1 },
  { unique: true }
);

const HomeServiceSerialBooking = mongoose.model('HomeServiceSerialBooking', homeServiceSerialBookingSchema);

export default HomeServiceSerialBooking;
