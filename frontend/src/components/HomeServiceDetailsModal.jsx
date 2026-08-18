import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../config/api';
import './HomeServiceDetailsModal.css';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatOffDays = (offDays) => {
  if (!offDays?.length) return 'Open all week';
  return offDays.map((d) => DAY_NAMES[d] ?? d).join(', ');
};

const formatAddress = (address) => {
  if (!address) return null;
  if (typeof address === 'string') return address;
  const parts = [address.street, address.city, address.state, address.zipCode, address.country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};

const formatDisplayDate = (date) =>
  date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const resolveSerialBooking = (service, serialSettings) => {
  if (service?.serialBooking) return service.serialBooking;
  if (!serialSettings) return null;
  let availableDays = serialSettings.availableDays;
  if (!availableDays?.length && service?.offDays) {
    availableDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !service.offDays.includes(d));
  }
  if (!availableDays?.length) availableDays = [0, 1, 2, 3, 4, 5, 6];
  return {
    enabled: Boolean(serialSettings.isActive),
    totalSerialsPerDay: serialSettings.totalSerialsPerDay,
    evenSerialsPerDay: Math.floor(serialSettings.totalSerialsPerDay / 2),
    serialTimeRange: serialSettings.serialTimeRange,
    servicePrice: serialSettings.servicePrice,
    availableDays: [...availableDays].sort((a, b) => a - b),
  };
};

const HomeServiceDetailsModal = ({
  serviceId,
  mode = 'patient',
  providerId,
  initialService = null,
  onClose,
  onBookSerial,
  onRequestService,
}) => {
  const [service, setService] = useState(initialService);
  const [serialSettings, setSerialSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = useMemo(() => new Date(), []);
  const todayLabel = useMemo(() => formatDisplayDate(today), [today]);
  const todayDayIndex = today.getDay();

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
    const load = async () => {
      setLoading(true);
      setError('');
      setSerialSettings(null);
      try {
        let detailsUrl;
        if (mode === 'patient') {
          detailsUrl = `/patient/home-services/${serviceId}`;
        } else if (mode === 'hospital') {
          detailsUrl = `/hospitals/${providerId}/home-services/${serviceId}`;
        } else {
          detailsUrl = `/diagnostic-centers/${providerId}/home-services/${serviceId}`;
        }

        const response = await api.get(detailsUrl);
        if (response.data.success) {
          setService(response.data.data.homeService);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load service details');
      }

      if (mode !== 'patient' && providerId) {
        try {
          const serialUrl =
            mode === 'hospital'
              ? `/hospitals/${providerId}/home-services/${serviceId}/serial-settings`
              : `/diagnostic-centers/${providerId}/home-services/${serviceId}/serial-settings`;
          const serialRes = await api.get(serialUrl);
          if (serialRes.data.success && serialRes.data.data.serialSettings) {
            setSerialSettings(serialRes.data.data.serialSettings);
          }
        } catch {
          setSerialSettings(null);
        }
      }

      setLoading(false);
    };

    load();
  }, [serviceId, mode, providerId]);

  const serialBooking = useMemo(
    () => resolveSerialBooking(service, serialSettings),
    [service, serialSettings]
  );

  const provider = service?.hospital || service?.diagnosticCenter;
  const providerType = service?.hospital ? 'Hospital' : service?.diagnosticCenter ? 'Diagnostic Center' : null;
  const providerPhone =
    provider?.contactInfo?.phone ||
    provider?.contactInfo?.mobile ||
    provider?.phone;

  const isBookableToday = serialBooking?.enabled && serialBooking.availableDays?.includes(todayDayIndex);

  const handleAction = (action) => {
    if (service) action(service);
    onClose();
  };

  return createPortal(
    <div className="hs-details-overlay" onClick={onClose}>
      <div className="hs-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hs-details-header">
          <div className="hs-details-header-text">
            <span className="hs-details-eyebrow">Home Service</span>
            <h2>Service Details</h2>
          </div>
          <button type="button" className="hs-details-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="hs-details-body">
          {loading ? (
            <div className="hs-details-loading">
              <div className="hs-details-spinner" />
              <p>Loading details...</p>
            </div>
          ) : error ? (
            <div className="hs-details-error">
              <p>{error}</p>
              <button type="button" className="hs-details-btn secondary" onClick={onClose}>Close</button>
            </div>
          ) : service ? (
            <>
              <div className="hs-details-hero">
                <div className="hs-details-hero-main">
                  {provider?.logo ? (
                    <img src={provider.logo} alt="" className="hs-details-logo" />
                  ) : (
                    <div className="hs-details-logo-placeholder">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1V9.5z" />
                      </svg>
                    </div>
                  )}
                  <div className="hs-details-hero-text">
                    <h3>{service.serviceType}</h3>
                    {providerType && <span className="hs-details-badge">{providerType}</span>}
                    {provider?.name && <p className="hs-details-provider-name">{provider.name}</p>}
                  </div>
                </div>
                <div className="hs-details-price-tag">
                  <span className="hs-details-price-label">From</span>
                  <span className="hs-details-price-value">{service.price} <small>tk</small></span>
                </div>
              </div>

              <div className="hs-details-cards">
                <div className="hs-details-card">
                  <span className="hs-details-card-icon hs-icon-clock" aria-hidden />
                  <div>
                    <label>Hours</label>
                    <span>{service.availableTime?.startTime} – {service.availableTime?.endTime}</span>
                  </div>
                </div>
                <div className="hs-details-card">
                  <span className="hs-details-card-icon hs-icon-calendar" aria-hidden />
                  <div>
                    <label>Closed on</label>
                    <span>{formatOffDays(service.offDays)}</span>
                  </div>
                </div>
                <div className="hs-details-card">
                  <span className="hs-details-card-icon hs-icon-status" aria-hidden />
                  <div>
                    <label>Status</label>
                    <span className={`hs-details-pill ${service.isActive ? 'active' : 'inactive'}`}>
                      {service.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {service.note && (
                <div className="hs-details-block">
                  <h4 className="hs-details-block-title">About this service</h4>
                  <p className="hs-details-desc">{service.note}</p>
                </div>
              )}

              {provider && (
                <div className="hs-details-block hs-details-provider-block">
                  <h4 className="hs-details-block-title">Provider</h4>
                  <div className="hs-details-provider-rows">
                    {formatAddress(provider.address) && (
                      <div className="hs-details-row">
                        <span className="hs-details-row-label">Address</span>
                        <span>{formatAddress(provider.address)}</span>
                      </div>
                    )}
                    {providerPhone && (
                      <div className="hs-details-row">
                        <span className="hs-details-row-label">Contact</span>
                        <span>{providerPhone}</span>
                      </div>
                    )}
                    {provider.departments?.length > 0 && (
                      <div className="hs-details-row">
                        <span className="hs-details-row-label">Departments</span>
                        <span>{provider.departments.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {serialBooking ? (
                <div className={`hs-details-block hs-details-serial-block ${serialBooking.enabled ? 'enabled' : 'disabled'}`}>
                  <div className="hs-details-serial-head">
                    <h4 className="hs-details-block-title">Online Serial Booking</h4>
                    <span className={`hs-details-pill ${serialBooking.enabled ? 'active' : 'inactive'}`}>
                      {serialBooking.enabled ? 'Available' : 'Not available'}
                    </span>
                  </div>

                  {serialBooking.enabled ? (
                    <>
                      <div className="hs-details-serial-date-banner">
                        <div className="hs-details-serial-date-icon" aria-hidden />
                        <div>
                          <span className="hs-details-serial-date-label">Booking opens from</span>
                          <strong className="hs-details-serial-date-value">{todayLabel}</strong>
                          <span className={`hs-details-serial-today ${isBookableToday ? 'open' : 'closed'}`}>
                            {isBookableToday ? 'Slots available today' : 'No slots today — pick another day below'}
                          </span>
                        </div>
                      </div>

                      <div className="hs-details-serial-subsection">
                        <span className="hs-details-serial-subtitle">Available booking days</span>
                        <div className="hs-details-day-chips">
                          {DAY_SHORT.map((short, index) => {
                            const isAvailable = serialBooking.availableDays?.includes(index);
                            return (
                              <span
                                key={short}
                                className={`hs-details-day-chip ${isAvailable ? 'available' : 'unavailable'} ${index === todayDayIndex ? 'today' : ''}`}
                                title={DAY_NAMES[index]}
                              >
                                {short}
                              </span>
                            );
                          })}
                        </div>
                        <p className="hs-details-serial-days-full">
                          {serialBooking.availableDays?.map((d) => DAY_NAMES[d]).join(' · ')}
                        </p>
                      </div>

                      <div className="hs-details-serial-stats">
                        <div className="hs-details-serial-stat">
                          <label>Slot window</label>
                          <span>
                            {serialBooking.serialTimeRange?.startTime} – {serialBooking.serialTimeRange?.endTime}
                          </span>
                        </div>
                        <div className="hs-details-serial-stat">
                          <label>Online price</label>
                          <span>{serialBooking.servicePrice} tk</span>
                        </div>
                        <div className="hs-details-serial-stat">
                          <label>Bookable slots</label>
                          <span>{serialBooking.evenSerialsPerDay} even serials / day</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="hs-details-serial-muted">
                      Online serial booking is turned off for this service. You can still submit a manual request.
                    </p>
                  )}
                </div>
              ) : mode === 'patient' && (
                <div className="hs-details-block hs-details-serial-block disabled">
                  <h4 className="hs-details-block-title">Online Serial Booking</h4>
                  <p className="hs-details-serial-muted">
                    Serial booking is not configured yet. Use <strong>Request (Manual)</strong> to book this service.
                  </p>
                </div>
              )}

              {mode === 'patient' && serialBooking?.enabled && (
                <p className="hs-details-hint">
                  Choose a date on an available day, then pick an even serial number (2, 4, 6…) when you book.
                </p>
              )}
            </>
          ) : null}
        </div>

        {!loading && !error && service && mode === 'patient' && (onBookSerial || onRequestService) && (
          <div className="hs-details-footer">
            {onBookSerial && serialBooking?.enabled && (
              <button type="button" className="hs-details-btn primary" onClick={() => handleAction(onBookSerial)}>
                Book Serial
              </button>
            )}
            {onRequestService && (
              <button type="button" className="hs-details-btn secondary" onClick={() => handleAction(onRequestService)}>
                Request (Manual)
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default HomeServiceDetailsModal;
