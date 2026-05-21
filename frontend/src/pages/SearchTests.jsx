import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import Navbar from '../components/Navbar';
import './SearchDoctors.css';

const resolveEntityId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  if (value.id) return String(value.id);
  return null;
};

const SearchTests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewMode, setViewMode] = useState('browse');
  const [selectedTest, setSelectedTest] = useState(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    providerType: 'all'
  });

  useEffect(() => {
    if (!user || user.role !== 'patient') {
      navigate('/login');
      return;
    }
    fetchTests();
    fetchMyBookings();
  }, [user]);

  const fetchTests = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filters.search) params.append('search', filters.search);
      if (filters.category) params.append('category', filters.category);
      const response = await api.get(`/patient/diagnostics/tests?${params.toString()}`);
      if (response.data.success) {
        let list = response.data.data.tests || [];
        if (filters.providerType === 'hospital') {
          list = list.filter((t) => t.hospitalId || t.hospital);
        } else if (filters.providerType === 'diagnostic') {
          list = list.filter((t) => t.diagnosticCenterId || t.diagnosticCenter);
        }
        setTests(list);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tests');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const response = await api.get('/patient/test-serials/my-bookings');
      if (response.data.success) {
        setMyBookings(response.data.data.bookings || []);
      }
    } catch (err) {
      console.error('Error fetching test serial bookings:', err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchTests();
  };

  const handleBookSerial = (test) => {
    setSelectedTest(test);
    setShowBookModal(true);
  };

  const handleBookingSuccess = () => {
    setSuccess('Test serial booked successfully!');
    setTimeout(() => setSuccess(''), 5000);
    setShowBookModal(false);
    setSelectedTest(null);
    fetchMyBookings();
  };

  const getProviderName = (test) =>
    test.hospital?.name || test.diagnosticCenter?.name || 'N/A';

  const getProviderType = (test) =>
    test.hospital || test.hospitalId ? 'Hospital' : 'Diagnostic Center';

  return (
    <div className="search-doctors-page">
      <Navbar />
      <div className="search-container">
        <div className="search-header">
          <h1>Search & Book Test Serials</h1>
          <p>Book even-numbered serials for hospital and diagnostic tests</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="view-mode-toggle" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className={`filter-btn ${viewMode === 'browse' ? 'active' : ''}`}
            onClick={() => setViewMode('browse')}
          >
            Browse Tests
          </button>
          <button
            type="button"
            className={`filter-btn ${viewMode === 'my-bookings' ? 'active' : ''}`}
            onClick={() => setViewMode('my-bookings')}
          >
            My Serials ({myBookings.length})
          </button>
        </div>

        {viewMode === 'browse' && (
          <>
            <form onSubmit={handleSearch} className="search-filters">
              <div className="filter-group">
                <input
                  type="text"
                  placeholder="Search by test name or code..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                >
                  <option value="">All Categories</option>
                  <option value="pathology">Pathology</option>
                  <option value="radiology">Radiology</option>
                  <option value="cardiology">Cardiology</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="filter-group">
                <select
                  value={filters.providerType}
                  onChange={(e) => setFilters({ ...filters, providerType: e.target.value })}
                >
                  <option value="all">All Providers</option>
                  <option value="hospital">Hospitals Only</option>
                  <option value="diagnostic">Diagnostic Centers Only</option>
                </select>
              </div>
              <button type="submit" className="search-btn" disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>

            {loading ? (
              <div className="loading-state"><div className="spinner" /><p>Loading tests...</p></div>
            ) : tests.length === 0 ? (
              <div className="empty-state"><p>No tests found. Try different filters.</p></div>
            ) : (
              <div className="doctors-grid">
                {tests.map((test) => (
                  <div key={test._id} className="doctor-card">
                    <div className="doctor-card-header">
                      <div>
                        <span className="specialization-badge" style={{ textTransform: 'capitalize' }}>
                          {test.category || 'other'}
                        </span>
                        <h3>{test.name}</h3>
                        <p className="doctor-hospital">{getProviderType(test)}: {getProviderName(test)}</p>
                      </div>
                    </div>
                    <div className="doctor-card-body">
                      {test.code && <p><strong>Code:</strong> {test.code}</p>}
                      <p><strong>Price:</strong> {test.price} tk</p>
                      {test.duration && <p><strong>Duration:</strong> {test.duration} hrs</p>}
                      {test.preparation && <p className="doctor-bio">{test.preparation}</p>}
                    </div>
                    <div className="doctor-card-footer">
                      <button
                        type="button"
                        className="book-btn"
                        onClick={() => handleBookSerial(test)}
                      >
                        Book Serial
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {viewMode === 'my-bookings' && (
          <div className="doctors-grid">
            {myBookings.length === 0 ? (
              <div className="empty-state"><p>No test serial bookings yet.</p></div>
            ) : (
              myBookings.map((booking) => (
                <div key={booking._id} className="doctor-card">
                  <div className="doctor-card-header">
                    <h3>{booking.testName || booking.testId?.name}</h3>
                    <span className={`specialization-badge ${booking.status}`}>{booking.status}</span>
                  </div>
                  <div className="doctor-card-body">
                    <p><strong>Booking:</strong> {booking.bookingNumber}</p>
                    <p><strong>Serial:</strong> #{booking.serialNumber}</p>
                    <p><strong>Provider:</strong> {booking.hospitalId?.name || booking.diagnosticCenterId?.name}</p>
                    <p><strong>Date:</strong> {new Date(booking.appointmentDate).toLocaleDateString()}</p>
                    <p><strong>Time:</strong> {booking.timeSlot?.startTime} - {booking.timeSlot?.endTime}</p>
                    <p><strong>Price:</strong> {booking.testPrice} tk</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showBookModal && selectedTest && (
        <TestSerialBookingModal
          test={selectedTest}
          onSuccess={handleBookingSuccess}
          onClose={() => { setShowBookModal(false); setSelectedTest(null); }}
          setError={setError}
        />
      )}
    </div>
  );
};

const TestSerialBookingModal = ({ test, onSuccess, onClose, setError }) => {
  const hospitalId = resolveEntityId(test.hospital) || resolveEntityId(test.hospitalId);
  const diagnosticCenterId = resolveEntityId(test.diagnosticCenter) || resolveEntityId(test.diagnosticCenterId);
  const testId = resolveEntityId(test) || test._id;
  const isHospital = Boolean(hospitalId);

  const [selectedDate, setSelectedDate] = useState('');
  const [availableSerials, setAvailableSerials] = useState([]);
  const [selectedSerial, setSelectedSerial] = useState(null);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [serialError, setSerialError] = useState('');
  const [testPrice, setTestPrice] = useState(test.price);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedDate || (!hospitalId && !diagnosticCenterId)) return;
    const loadSerials = async () => {
      setLoadingSerials(true);
      setSerialError('');
      setSelectedSerial(null);
      try {
        const url = isHospital
          ? `/patient/hospitals/${hospitalId}/tests/${testId}/serials?date=${selectedDate}`
          : `/patient/diagnostic-centers/${diagnosticCenterId}/tests/${testId}/serials?date=${selectedDate}`;
        const response = await api.get(url);
        if (response.data.success) {
          setAvailableSerials(response.data.data.availableSerials || []);
          if (response.data.data.testPrice) setTestPrice(response.data.data.testPrice);
          if (response.data.data.message) setSerialError(response.data.data.message);
        }
      } catch (err) {
        setSerialError(err.response?.data?.message || 'Serial booking not available for this test');
        setAvailableSerials([]);
      } finally {
        setLoadingSerials(false);
      }
    };
    loadSerials();
  }, [selectedDate, hospitalId, diagnosticCenterId, testId, isHospital]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedSerial) {
      setError('Please select date and serial');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        testId,
        serialNumber: selectedSerial.serialNumber,
        date: selectedDate
      };
      if (isHospital) body.hospitalId = hospitalId;
      else body.diagnosticCenterId = diagnosticCenterId;

      const response = await api.post('/patient/test-serials/book', body);
      if (response.data.success) {
        onSuccess();
      } else {
        setError(response.data.message || 'Booking failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to book serial');
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = new Date().toISOString().split('T')[0];
  const providerName = test.hospital?.name || test.diagnosticCenter?.name;

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', maxWidth: '480px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h2>Book Test Serial</h2>
        <p><strong>{test.name}</strong> — {providerName}</p>
        <p>Price: {testPrice} tk</p>

        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label>Date *</label>
            <input type="date" min={minDate} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} required style={{ width: '100%', marginTop: '0.25rem' }} />
          </div>

          {loadingSerials && <p>Loading serials...</p>}
          {serialError && !loadingSerials && <p style={{ color: '#dc2626' }}>{serialError}</p>}

          {selectedDate && !loadingSerials && availableSerials.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <label>Select Serial (even numbers only) *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                {availableSerials.map((s) => (
                  <button
                    key={s.serialNumber}
                    type="button"
                    onClick={() => setSelectedSerial(s)}
                    style={{
                      padding: '0.5rem',
                      border: selectedSerial?.serialNumber === s.serialNumber ? '2px solid #667eea' : '1px solid #ddd',
                      borderRadius: '8px',
                      background: selectedSerial?.serialNumber === s.serialNumber ? '#eef2ff' : '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <div><strong>#{s.serialNumber}</strong></div>
                    <small>{s.time}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={submitting || !selectedSerial} className="book-btn">
              {submitting ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SearchTests;
