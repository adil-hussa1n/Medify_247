import moment from 'moment';
import HomeService from '../models/HomeService.model.js';
import HomeServiceSerialSettings from '../models/HomeServiceSerialSettings.model.js';
import HomeServiceSerialBooking from '../models/HomeServiceSerialBooking.model.js';
import { calculateSerialTimeSlot, offDaysToAvailableDays } from '../utils/homeServiceSerial.util.js';

export const findProviderHomeServiceSerialBooking = (bookingId, providerFilter) => {
  const query = { _id: bookingId, ...providerFilter };
  return HomeServiceSerialBooking.findOne(query);
};

export const getActiveSerialSettingsForBooking = async (booking) => {
  const query = { homeServiceId: booking.homeServiceId, isActive: true };
  if (booking.hospitalId) query.hospitalId = booking.hospitalId;
  else query.diagnosticCenterId = booking.diagnosticCenterId;
  return HomeServiceSerialSettings.findOne(query);
};

const dayRange = (date) => ({
  $gte: moment(date).startOf('day').toDate(),
  $lte: moment(date).endOf('day').toDate()
});

export const validateRescheduleSlot = async (booking, { date, serialNumber }) => {
  if (serialNumber !== undefined && serialNumber % 2 !== 0) {
    return { ok: false, message: 'Only even-numbered serials can be booked online' };
  }

  const newDate = date ? moment(date).startOf('day').toDate() : booking.appointmentDate;
  const newSerial = serialNumber !== undefined ? serialNumber : booking.serialNumber;
  const dateStr = moment(newDate).format('YYYY-MM-DD');
  const dayOfWeek = moment(newDate).day();

  const serialSettings = await getActiveSerialSettingsForBooking(booking);
  if (!serialSettings) {
    return { ok: false, message: 'Serial booking is not enabled for this home service' };
  }

  let availableDays = serialSettings.availableDays;
  if (!availableDays?.length) {
    const homeService = await HomeService.findById(booking.homeServiceId);
    availableDays = offDaysToAvailableDays(homeService?.offDays || []);
  }
  if (availableDays?.length > 0 && !availableDays.includes(dayOfWeek)) {
    return { ok: false, message: 'Serials are not available on this day' };
  }

  const conflictQuery = {
    homeServiceId: booking.homeServiceId,
    appointmentDate: dayRange(dateStr),
    serialNumber: newSerial,
    status: { $in: ['pending', 'confirmed'] },
    _id: { $ne: booking._id }
  };
  if (booking.hospitalId) conflictQuery.hospitalId = booking.hospitalId;
  else conflictQuery.diagnosticCenterId = booking.diagnosticCenterId;

  const conflict = await HomeServiceSerialBooking.findOne(conflictQuery);
  if (conflict) {
    return { ok: false, message: 'This serial is already booked for the selected date' };
  }

  return {
    ok: true,
    appointmentDate: newDate,
    serialNumber: newSerial,
    timeSlot: calculateSerialTimeSlot(serialSettings, newSerial),
    servicePrice: serialSettings.servicePrice
  };
};

export const applyHomeServiceSerialBookingFields = async (booking, body, options = {}) => {
  const {
    status,
    notes,
    date,
    serialNumber,
    patientName,
    patientAge,
    patientGender,
    phoneNumber,
    homeAddress
  } = body;

  const rescheduleRequested = date !== undefined || serialNumber !== undefined;
  if (rescheduleRequested && booking.status !== 'cancelled' && booking.status !== 'completed') {
    const slotCheck = await validateRescheduleSlot(booking, {
      date: date ?? moment(booking.appointmentDate).format('YYYY-MM-DD'),
      serialNumber
    });
    if (!slotCheck.ok) {
      return { ok: false, message: slotCheck.message };
    }
    booking.appointmentDate = slotCheck.appointmentDate;
    booking.serialNumber = slotCheck.serialNumber;
    booking.timeSlot = slotCheck.timeSlot;
    booking.servicePrice = slotCheck.servicePrice;
  }

  if (status !== undefined) {
    booking.status = status;
    if (status === 'completed') booking.completedAt = new Date();
    if (status === 'cancelled') {
      booking.cancelledAt = new Date();
      booking.cancelledBy = options.cancelledBy || 'system';
    }
  }

  if (notes !== undefined) booking.notes = notes;
  if (patientName !== undefined) booking.patientName = patientName;
  if (patientAge !== undefined) booking.patientAge = patientAge;
  if (patientGender !== undefined) booking.patientGender = patientGender;
  if (phoneNumber !== undefined) booking.patientPhone = phoneNumber;
  if (homeAddress !== undefined) {
    const prev = booking.homeAddress?.toObject?.() || booking.homeAddress || {};
    booking.homeAddress = {
      street: homeAddress.street ?? prev.street,
      city: homeAddress.city ?? prev.city,
      state: homeAddress.state ?? prev.state,
      zipCode: homeAddress.zipCode ?? prev.zipCode,
      country: homeAddress.country ?? prev.country,
      coordinates: homeAddress.coordinates ?? prev.coordinates
    };
    booking.markModified('homeAddress');
  }

  await booking.save();
  return { ok: true, booking };
};
