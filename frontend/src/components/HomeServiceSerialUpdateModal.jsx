import { useState, useEffect, useMemo } from 'react';
import api from '../config/api';
import './HomeServiceSerialUpdateModal.css';

const resolveEntityId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  if (value.id) return String(value.id);
  return null;
};

const HomeServiceSerialUpdateModal = ({
  booking,
  mode = 'patient',
  providerId,
  onClose,
  onSuccess,
  setError,
}) => {
  const hospitalId = resolveEntityId(booking.hospitalId);
  const diagnosticCenterId = resolveEntityId(booking.diagnosticCenterId);
  const homeServiceId = resolveEntityId(booking.homeServiceId);
  const isDiagnostic = Boolean(diagnosticCenterId && !hospitalId);
  const isAdmin = mode === 'hospital' || mode === 'diagnostic';

  const initialDate = booking.appointmentDate
    ? new Date(booking.appointmentDate).toISOString().split('T')[0]
    : '';

  const [formData, setFormData] = useState({
    status: booking.status || 'pending',
    date: initialDate,
    serialNumber: booking.serialNumber || '',
    notes: booking.notes || '',
    patientName: booking.patientName || '',
    patientAge: booking.patientAge ?? '',
    patientGender: booking.patientGender || '',
    phoneNumber: booking.patientPhone || '',
    homeAddress: {
      street: booking.homeAddress?.street || '',
      city: booking.homeAddress?.city || '',
      state: booking.homeAddress?.state || '',
      zipCode: booking.homeAddress?.zipCode || '',
    },
  });
  const [availableSerials, setAvailableSerials] = useState([]);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serialError, setSerialError] = useState('');

  const canEdit = useMemo(() => {
    if (isAdmin) return true;
    return !['completed', 'cancelled'].includes(booking.status);
  }, [isAdmin, booking.status]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  useEffect(() => {
    if (!formData.date || !homeServiceId) return;

    const loadSerials = async () => {
      setLoadingSerials(true);
      setSerialError('');
      try {
        const url = isDiagnostic
          ? `/patient/diagnostic-centers/${diagnosticCenterId}/home-services/${homeServiceId}/serials?date=${formData.date}`
          : `/patient/hospitals/${hospitalId}/home-services/${homeServiceId}/serials?date=${formData.date}`;
        const response = await api.get(url);
        if (response.data.success) {
          let slots = response.data.data.availableSerials || [];
          const current = Number(formData.serialNumber);
          if (current && !slots.some((s) => s.serialNumber === current)) {
            slots = [
              {
                serialNumber: current,
                time: booking.timeSlot?.startTime || '--:--',
                endTime: booking.timeSlot?.endTime || '--:--',
                available: true,
                current: true,
              },
              ...slots,
            ];
          }
          setAvailableSerials(slots);
        }
      } catch (err) {
        setSerialError(err.response?.data?.message || 'Could not load serial slots');
        setAvailableSerials([]);
      } finally {
        setLoadingSerials(false);
      }
    };

    loadSerials();
  }, [formData.date, homeServiceId, hospitalId, diagnosticCenterId, isDiagnostic]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('address.')) {
      const field = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        homeAddress: { ...prev.homeAddress, [field]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const buildPayload = () => {
    const payload = {
      notes: formData.notes || undefined,
      date: formData.date,
      serialNumber: parseInt(formData.serialNumber, 10),
      phoneNumber: formData.phoneNumber,
      homeAddress: formData.homeAddress,
    };
    if (isAdmin) {
      payload.status = formData.status;
      payload.patientName = formData.patientName;
      payload.patientAge = parseInt(formData.patientAge, 10);
      payload.patientGender = formData.patientGender;
    } else if (formData.status === 'cancelled') {
      payload.status = 'cancelled';
    }
    return payload;
  };

  const getUpdateUrl = () => {
    if (mode === 'hospital') {
      return `/hospitals/${providerId}/home-service-serial-bookings/${booking._id}`;
    }
    if (mode === 'diagnostic') {
      return `/diagnostic-centers/${providerId}/home-service-serial-bookings/${booking._id}`;
    }
    return `/patient/home-service-serials/${booking._id}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSubmitting(true);
    try {
      const response = await api.put(getUpdateUrl(), buildPayload());
      if (response.data.success) {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update booking';
      setError?.(msg);
      setSerialError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!window.confirm('Cancel this serial booking?')) return;
    setFormData((prev) => ({ ...prev, status: 'cancelled' }));
    setSubmitting(true);
    try {
      const response = await api.put(getUpdateUrl(), {
        ...buildPayload(),
        status: 'cancelled',
      });
      if (response.data.success) {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      setError?.(err.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="hs-update-overlay" onClick={onClose}>
      <div className="hs-update-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hs-update-header">
          <div>
            <span className="hs-update-eyebrow">Serial booking</span>
            <h2>Update Serial</h2>
            <p className="hs-update-ref">{booking.bookingNumber}</p>
          </div>
          <button type="button" className="hs-update-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {!canEdit ? (
          <div className="hs-update-body">
            <p className="hs-update-muted">This booking is {booking.status} and cannot be edited.</p>
            <button type="button" className="hs-update-btn secondary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="hs-update-form">
            <div className="hs-update-body">
              {isAdmin && (
                <div className="hs-update-field">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}

              <div className="hs-update-row">
                <div className="hs-update-field">
                  <label>Appointment date *</label>
                  <input
                    type="date"
                    name="date"
                    min={minDate}
                    value={formData.date}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="hs-update-field">
                  <label>Serial number *</label>
                  <select
                    name="serialNumber"
                    value={formData.serialNumber}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select serial</option>
                    {availableSerials.map((s) => (
                      <option key={s.serialNumber} value={s.serialNumber}>
                        #{s.serialNumber} — {s.time}–{s.endTime}
                        {s.current ? ' (current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loadingSerials && <p className="hs-update-hint">Loading available serials...</p>}
              {serialError && <p className="hs-update-error">{serialError}</p>}

              {isAdmin && (
                <div className="hs-update-row">
                  <div className="hs-update-field">
                    <label>Patient name</label>
                    <input type="text" name="patientName" value={formData.patientName} onChange={handleChange} />
                  </div>
                  <div className="hs-update-field">
                    <label>Age</label>
                    <input type="number" name="patientAge" min="0" value={formData.patientAge} onChange={handleChange} />
                  </div>
                  <div className="hs-update-field">
                    <label>Gender</label>
                    <select name="patientGender" value={formData.patientGender} onChange={handleChange}>
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="hs-update-field">
                <label>Phone *</label>
                <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} required />
              </div>

              <div className="hs-update-field">
                <label>Street *</label>
                <input type="text" name="address.street" value={formData.homeAddress.street} onChange={handleChange} required />
              </div>
              <div className="hs-update-row">
                <div className="hs-update-field">
                  <label>City *</label>
                  <input type="text" name="address.city" value={formData.homeAddress.city} onChange={handleChange} required />
                </div>
                <div className="hs-update-field">
                  <label>State</label>
                  <input type="text" name="address.state" value={formData.homeAddress.state} onChange={handleChange} />
                </div>
                <div className="hs-update-field">
                  <label>Zip</label>
                  <input type="text" name="address.zipCode" value={formData.homeAddress.zipCode} onChange={handleChange} />
                </div>
              </div>

              <div className="hs-update-field">
                <label>Notes</label>
                <textarea name="notes" rows="3" value={formData.notes} onChange={handleChange} placeholder="Optional notes" />
              </div>
            </div>

            <div className="hs-update-footer">
              {!isAdmin && (
                <button type="button" className="hs-update-btn danger" onClick={handleCancelBooking} disabled={submitting}>
                  Cancel booking
                </button>
              )}
              <button type="button" className="hs-update-btn secondary" onClick={onClose} disabled={submitting}>
                Close
              </button>
              <button type="submit" className="hs-update-btn primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default HomeServiceSerialUpdateModal;
