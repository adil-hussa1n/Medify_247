import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import Navbar from '../components/Navbar';
import './UserDashboard.css';

/** Extract MongoDB id string from populated ref or plain id */
const resolveEntityId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  if (value.id) return String(value.id);
  return null;
};

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [testOrders, setTestOrders] = useState([]);
  const [testSerialBookings, setTestSerialBookings] = useState([]);
  const [testOrdersLoading, setTestOrdersLoading] = useState(false);
  const [homeServices, setHomeServices] = useState([]);
  const [homeServiceRequests, setHomeServiceRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [loadingDoctor, setLoadingDoctor] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [homeServiceSerialBookings, setHomeServiceSerialBookings] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [availableTests, setAvailableTests] = useState([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [showTestBookModal, setShowTestBookModal] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'patient') {
      navigate('/login');
      return;
    }
    fetchDashboardData();
    fetchTestOrders();
  }, [user]);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.tab]);

  useEffect(() => {
    if (activeTab === 'appointments') fetchAppointments();
    if (activeTab === 'tests') fetchAvailableTests();
    if (activeTab === 'test-orders') fetchTestOrders();
    if (activeTab === 'home-services') {
      fetchHomeServices();
      fetchHomeServiceRequests();
      fetchHomeServiceSerialBookings();
    }
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch profile for basic info
      const profileResponse = await api.get('/patient/profile');
      if (profileResponse.data.success) {
        setDashboardData(profileResponse.data.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await api.get('/patient/appointments');
      if (response.data.success) {
        setAppointments(response.data.data.appointments || []);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
    }
  };

  const fetchAvailableTests = async (filters = {}) => {
    setTestsLoading(true);
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
        setAvailableTests(list);
      }
    } catch (err) {
      console.error('Error fetching tests:', err);
      setError(err.response?.data?.message || 'Failed to load tests');
      setTimeout(() => setError(''), 3000);
    } finally {
      setTestsLoading(false);
    }
  };

  const fetchTestOrders = async () => {
    setTestOrdersLoading(true);
    try {
      const [ordersRes, serialsRes] = await Promise.all([
        api.get('/patient/diagnostics/orders'),
        api.get('/patient/test-serials/my-bookings')
      ]);
      if (ordersRes.data.success) {
        setTestOrders(ordersRes.data.data.orders || []);
      }
      if (serialsRes.data.success) {
        setTestSerialBookings(serialsRes.data.data.bookings || []);
      }
    } catch (err) {
      console.error('Error fetching test orders:', err);
      setError(err.response?.data?.message || 'Failed to load test orders');
      setTimeout(() => setError(''), 3000);
    } finally {
      setTestOrdersLoading(false);
    }
  };

  const fetchHomeServices = async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.hospitalId) params.append('hospitalId', filters.hospitalId);
      if (filters.diagnosticCenterId) params.append('diagnosticCenterId', filters.diagnosticCenterId);
      if (filters.serviceType) params.append('serviceType', filters.serviceType);
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);
      
      const response = await api.get(`/patient/home-services?${params.toString()}`);
      if (response.data.success) {
        setHomeServices(response.data.data.homeServices || []);
      }
    } catch (err) {
      console.error('Error fetching home services:', err);
      setError('Failed to load home services');
      setTimeout(() => setError(''), 3000);
    }
  };

  const fetchHomeServiceRequests = async () => {
    try {
      const response = await api.get('/patient/history?type=home_services');
      if (response.data.success) {
        setHomeServiceRequests(response.data.data.history || []);
      }
    } catch (err) {
      console.error('Error fetching home service requests:', err);
    }
  };

  const fetchHomeServiceSerialBookings = async () => {
    try {
      const response = await api.get('/patient/home-service-serials/my-bookings');
      if (response.data.success) {
        setHomeServiceSerialBookings(response.data.data.bookings || []);
      }
    } catch (err) {
      console.error('Error fetching home service serial bookings:', err);
    }
  };

  const handleRequestService = (service) => {
    setSelectedService(service);
    setShowRequestModal(true);
  };

  const handleCloseRequestModal = () => {
    setShowRequestModal(false);
    setSelectedService(null);
  };

  const handleBookSerial = (service) => {
    setSelectedService(service);
    setShowSerialModal(true);
  };

  const handleCloseSerialModal = () => {
    setShowSerialModal(false);
    setSelectedService(null);
  };

  const handleBookTestSerial = (test) => {
    setSelectedTest(test);
    setShowTestBookModal(true);
  };

  const handleCloseTestBookModal = () => {
    setShowTestBookModal(false);
    setSelectedTest(null);
  };

  const handleSubmitTestSerialBooking = async () => {
    setSuccess('Test serial booked successfully!');
    setTimeout(() => setSuccess(''), 5000);
    setShowTestBookModal(false);
    setSelectedTest(null);
    fetchTestOrders();
    fetchAvailableTests();
    fetchHistory();
  };

  const handleSubmitSerialBooking = async (bookingData) => {
    try {
      const response = await api.post('/patient/home-service-serials/book', bookingData);
      if (response.data.success) {
        setSuccess('Home service serial booked successfully!');
        setTimeout(() => setSuccess(''), 5000);
        setShowSerialModal(false);
        setSelectedService(null);
        fetchHomeServiceSerialBookings();
        fetchHistory();
      } else {
        setError(response.data.message || 'Failed to book serial');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to book serial');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleSubmitRequest = async (requestData) => {
    try {
      const response = await api.post('/patient/home-services/request', requestData);
      if (response.data.success) {
        setSuccess('Home service request submitted successfully!');
        setTimeout(() => setSuccess(''), 5000);
        setShowRequestModal(false);
        setSelectedService(null);
        fetchHomeServiceRequests();
        fetchHomeServices();
      } else {
        setError(response.data.message || 'Failed to submit request');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error('Error submitting request:', err);
      setError(err.response?.data?.message || 'Failed to submit request');
      setTimeout(() => setError(''), 3000);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await api.get('/patient/history');
      if (response.data.success) {
        setHistory(response.data.data.history || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }

    try {
      const response = await api.put(`/patient/appointments/${appointmentId}/cancel`);
      if (response.data.success) {
        setSuccess('Appointment cancelled successfully');
        fetchAppointments();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel appointment');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDoctorClick = async (doctorId) => {
    if (!doctorId) {
      console.error('No doctor ID provided');
      setError('Doctor ID not available');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    // Handle both string and object ID
    const id = typeof doctorId === 'string' 
      ? doctorId 
      : (doctorId._id || doctorId.id || doctorId);
    
    if (!id) {
      console.error('Invalid doctor ID format:', doctorId);
      setError('Invalid doctor ID');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setShowDoctorModal(true);
    setLoadingDoctor(true);
    setSelectedDoctor(null);

    try {
      const response = await api.get(`/shared/doctors/${id}`);
      if (response.data.success) {
        setSelectedDoctor(response.data.data.doctor || response.data.data);
      } else {
        setError(response.data.message || 'Failed to load doctor details');
        setTimeout(() => setError(''), 3000);
        setShowDoctorModal(false);
      }
    } catch (err) {
      console.error('Error fetching doctor details:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load doctor details';
      setError(errorMessage);
      setTimeout(() => setError(''), 5000);
      setShowDoctorModal(false);
    } finally {
      setLoadingDoctor(false);
    }
  };

  const closeDoctorModal = () => {
    setShowDoctorModal(false);
    setSelectedDoctor(null);
  };

  if (loading && !dashboardData) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const metrics = {
    totalAppointments: appointments.length,
    upcomingAppointments: appointments.filter(apt => 
      new Date(apt.appointmentDate) >= new Date() && apt.status !== 'cancelled'
    ).length,
    testOrders: testOrders.length + testSerialBookings.length,
    homeServiceRequests: history.filter(h => h.type === 'home_service').length
  };

  return (
    <div className="user-dashboard">
      <Navbar />
      <div className="dashboard-container">
        {error && (
          <div className="alert alert-error">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {success}
          </div>
        )}

        <div className="dashboard-header">
          <h1>Welcome back, {user?.name || 'Patient'}!</h1>
          <p>Manage your appointments, tests, and healthcare services</p>
        </div>

        <div className="dashboard-tabs">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Overview
          </button>
          <button
            className={`tab-button ${activeTab === 'appointments' ? 'active' : ''}`}
            onClick={() => setActiveTab('appointments')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            Appointments
          </button>
          <button
            className={`tab-button ${activeTab === 'tests' ? 'active' : ''}`}
            onClick={() => setActiveTab('tests')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM7 8a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            Tests
          </button>
          <button
            className={`tab-button ${activeTab === 'test-orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('test-orders')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM7 8a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            Test Orders
          </button>
          <button
            className={`tab-button ${activeTab === 'home-services' ? 'active' : ''}`}
            onClick={() => setActiveTab('home-services')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Home Services
          </button>
          <button
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            History
          </button>
          <button
            className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            Search
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'overview' && (
            <OverviewTab metrics={metrics} navigate={navigate} />
          )}
          {activeTab === 'appointments' && (
            <AppointmentsTab 
              appointments={appointments}
              onCancel={handleCancelAppointment}
              onRefresh={fetchAppointments}
              onDoctorClick={handleDoctorClick}
              onError={(msg) => {
                setError(msg);
                setTimeout(() => setError(''), 3000);
              }}
            />
          )}
          {activeTab === 'tests' && (
            <TestsBrowseTab
              tests={availableTests}
              loading={testsLoading}
              onSearch={fetchAvailableTests}
              onBookSerial={handleBookTestSerial}
              onViewOrders={() => setActiveTab('test-orders')}
            />
          )}
          {activeTab === 'test-orders' && (
            <TestOrdersTab 
              orders={testOrders}
              serialBookings={testSerialBookings}
              loading={testOrdersLoading}
              onRefresh={fetchTestOrders}
              navigate={navigate}
            />
          )}
          {activeTab === 'home-services' && (
            <HomeServicesTab 
              services={homeServices}
              requests={homeServiceRequests}
              serialBookings={homeServiceSerialBookings}
              onRefresh={fetchHomeServices}
              onRequestService={handleRequestService}
              onBookSerial={handleBookSerial}
              onRefreshRequests={fetchHomeServiceRequests}
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab 
              history={history}
              onRefresh={fetchHistory}
            />
          )}
          {activeTab === 'search' && (
            <SearchTab navigate={navigate} />
          )}
        </div>
      </div>

      {/* Doctor Details Modal */}
      {showDoctorModal && (
        <DoctorDetailsModal
          doctor={selectedDoctor}
          loading={loadingDoctor}
          onClose={closeDoctorModal}
        />
      )}

      {/* Home Service Request Modal */}
      {showRequestModal && selectedService && (
        <HomeServiceRequestModal
          service={selectedService}
          user={user}
          onSubmit={handleSubmitRequest}
          onClose={handleCloseRequestModal}
        />
      )}

      {showSerialModal && selectedService && (
        <HomeServiceSerialBookingModal
          service={selectedService}
          user={user}
          onSubmit={handleSubmitSerialBooking}
          onClose={handleCloseSerialModal}
        />
      )}

      {showTestBookModal && selectedTest && (
        <TestSerialBookingModal
          test={selectedTest}
          onSuccess={handleSubmitTestSerialBooking}
          onClose={handleCloseTestBookModal}
          setError={setError}
        />
      )}
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ metrics, navigate }) => {
  return (
    <div className="overview-tab">
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon appointments">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="metric-content">
            <h3>{metrics.totalAppointments}</h3>
            <p>Total Appointments</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon upcoming">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="metric-content">
            <h3>{metrics.upcomingAppointments}</h3>
            <p>Upcoming Appointments</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon tests">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM7 8a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="metric-content">
            <h3>{metrics.testOrders}</h3>
            <p>Test Orders</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon services">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </div>
          <div className="metric-content">
            <h3>{metrics.homeServiceRequests}</h3>
            <p>Home Service Requests</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <button className="action-card" onClick={() => navigate('/search-doctors')}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <h3>Search Doctors</h3>
            <p>Find and book appointments with doctors</p>
          </button>

          <button className="action-card" onClick={() => navigate('/user/dashboard', { state: { tab: 'tests' } })}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM7 8a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            <h3>Book Tests</h3>
            <p>Search tests and book a serial</p>
          </button>

          <button className="action-card" onClick={() => navigate('/home-services')}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <h3>Home Services</h3>
            <p>Request home healthcare services</p>
          </button>
        </div>
      </div>
    </div>
  );
};

// Appointments Tab Component
const AppointmentsTab = ({ appointments, onCancel, onRefresh, onDoctorClick, onError }) => {
  const getStatusBadge = (status) => {
    const badges = {
      pending: 'badge-warning',
      confirmed: 'badge-success',
      completed: 'badge-info',
      cancelled: 'badge-danger'
    };
    return badges[status] || 'badge-default';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (appointments.length === 0) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" strokeWidth="2" />
        </svg>
        <h3>No Appointments</h3>
        <p>You don't have any appointments yet. Book one now!</p>
      </div>
    );
  }

  return (
    <div className="appointments-tab">
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Date</th>
              <th>Time</th>
              <th>Serial Number</th>
              <th>Hospital/Clinic</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((apt) => {
              // Extract serial number and admin note from notes if it's a serial booking
              const serialMatch = apt.notes?.match(/Serial #(\d+)/);
              const serialNumber = serialMatch ? serialMatch[1] : null;
              const adminNoteMatch = apt.notes?.match(/Admin Note: (.+)$/);
              const adminNote = adminNoteMatch ? adminNoteMatch[1] : null;
              
              // Get time from timeSlot or fallback to direct properties
              const startTime = apt.timeSlot?.startTime || apt.startTime || 'N/A';
              const endTime = apt.timeSlot?.endTime || apt.endTime || 'N/A';
              
              // Format appointment date - handle both string and Date objects
              let appointmentDate = null;
              if (apt.appointmentDate) {
                if (typeof apt.appointmentDate === 'string') {
                  appointmentDate = new Date(apt.appointmentDate);
                } else if (apt.appointmentDate instanceof Date) {
                  appointmentDate = apt.appointmentDate;
                } else if (apt.appointmentDate.$date) {
                  // Handle MongoDB date format
                  appointmentDate = new Date(apt.appointmentDate.$date);
                } else {
                  appointmentDate = new Date(apt.appointmentDate);
                }
              }
              
              return (
                <tr key={apt._id}>
                  <td>
                    <div className="doctor-info">
                      {apt.doctorId?.profilePhotoUrl && (
                        <img src={apt.doctorId.profilePhotoUrl} alt={apt.doctorId.name} />
                      )}
                      <div>
                        <strong 
                          className="doctor-name-clickable"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!onDoctorClick) {
                              console.error('onDoctorClick handler not provided');
                              return;
                            }
                            // Try multiple ways to get the doctor ID
                            const doctorId = apt.doctorId?._id || 
                                           apt.doctorId?.id || 
                                           apt.doctorId || 
                                           apt.doctor;
                            if (doctorId) {
                              onDoctorClick(doctorId);
                            } else {
                              console.error('No doctor ID found in appointment:', apt);
                              if (onError) {
                                onError('Doctor information not available');
                              }
                            }
                          }}
                          style={{ cursor: 'pointer', color: '#667eea' }}
                          title="Click to view doctor details"
                        >
                          {apt.doctorId?.name || 'Unknown'}
                        </strong>
                        <small>{apt.doctorId?.specialization?.join(', ') || 'N/A'}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {appointmentDate ? formatDate(appointmentDate) : 'N/A'}
                  </td>
                  <td>
                    {startTime !== 'N/A' && endTime !== 'N/A' 
                      ? `${startTime} - ${endTime}` 
                      : 'N/A'}
                  </td>
                  <td>
                    {serialNumber ? (
                      <span className="serial-badge">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        #{serialNumber}
                      </span>
                    ) : (
                      <span className="no-serial">-</span>
                    )}
                  </td>
                  <td>
                    <div>
                      {apt.chamberId?.hospitalId?.facilityName || 
                       apt.chamberId?.hospitalId?.name ||
                       apt.chamberId?.name || 
                       'N/A'}
                    </div>
                    {adminNote && (
                      <div className="admin-note-display" title={adminNote}>
                        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: '14px', height: '14px', marginRight: '4px' }}>
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <small>{adminNote}</small>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(apt.status)}`}>
                      {apt.status}
                    </span>
                  </td>
                  <td>
                    {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                      <button
                        className="btn-cancel"
                        onClick={() => onCancel(apt._id)}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Browse available tests and book serials
const TestsBrowseTab = ({ tests, loading, onSearch, onBookSerial, onViewOrders }) => {
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    providerType: 'all'
  });
  const [filteredTests, setFilteredTests] = useState(tests);

  useEffect(() => {
    setFilteredTests(tests);
  }, [tests]);

  useEffect(() => {
    let list = tests;
    if (filters.providerType === 'hospital') {
      list = list.filter((t) => t.hospitalId || t.hospital);
    } else if (filters.providerType === 'diagnostic') {
      list = list.filter((t) => t.diagnosticCenterId || t.diagnosticCenter);
    }
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name?.toLowerCase().includes(q) ||
          t.code?.toLowerCase().includes(q) ||
          t.hospital?.name?.toLowerCase().includes(q) ||
          t.diagnosticCenter?.name?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q)
      );
    }
    setFilteredTests(list);
  }, [tests, filters.search, filters.providerType]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch({
      search: filters.search.trim(),
      category: filters.category,
      providerType: filters.providerType
    });
  };

  const getProviderName = (test) => test.hospital?.name || test.diagnosticCenter?.name || 'N/A';
  const getProviderType = (test) => (test.hospital || test.hospitalId ? 'Hospital' : 'Diagnostic Center');

  return (
    <div className="home-services-tab">
      <div className="home-services-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Available Tests</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            Search tests and book an even-numbered serial (2, 4, 6…)
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={onViewOrders}>
          View My Test Orders →
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="services-filters" style={{ marginTop: '1rem' }}>
        <div className="search-box">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Search by test name, code, hospital, or category..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="filter-select"
        >
          <option value="">All Categories</option>
          <option value="pathology">Pathology</option>
          <option value="radiology">Radiology</option>
          <option value="cardiology">Cardiology</option>
          <option value="other">Other</option>
        </select>
        <div className="filter-buttons">
          <button
            type="button"
            className={`filter-btn ${filters.providerType === 'all' ? 'active' : ''}`}
            onClick={() => setFilters({ ...filters, providerType: 'all' })}
          >
            All
          </button>
          <button
            type="button"
            className={`filter-btn ${filters.providerType === 'hospital' ? 'active' : ''}`}
            onClick={() => setFilters({ ...filters, providerType: 'hospital' })}
          >
            Hospitals
          </button>
          <button
            type="button"
            className={`filter-btn ${filters.providerType === 'diagnostic' ? 'active' : ''}`}
            onClick={() => setFilters({ ...filters, providerType: 'diagnostic' })}
          >
            Diagnostic Centers
          </button>
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
          <p>Loading tests...</p>
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="empty-state">
          <h3>No Tests Found</h3>
          <p>Try a different search term or filter, or check back later.</p>
        </div>
      ) : (
        <div className="services-grid">
          {filteredTests.map((test) => (
            <div key={test._id} className="service-card">
              <div className="service-card-header">
                <div className="service-provider">
                  <span className="provider-type">{getProviderType(test)}</span>
                  <h4>{getProviderName(test)}</h4>
                </div>
              </div>
              <div className="service-card-body">
                <h3 className="service-type">{test.name}</h3>
                {test.code && <p className="service-note">Code: {test.code}</p>}
                <p className="service-price">
                  <span className="price-label">Price:</span>
                  <span className="price-value">{test.price} tk</span>
                </p>
                <p className="service-note" style={{ textTransform: 'capitalize' }}>
                  Category: {test.category || 'other'}
                </p>
                {test.duration != null && (
                  <p className="service-note">Report in ~{test.duration} hours</p>
                )}
                {test.preparation && <p className="service-note">{test.preparation}</p>}
              </div>
              <div className="service-card-footer">
                <button type="button" className="btn-primary btn-request" onClick={() => onBookSerial(test)}>
                  Book Serial
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#6b7280' }}>
        {filteredTests.length} test{filteredTests.length !== 1 ? 's' : ''} shown
        {tests.length !== filteredTests.length ? ` (filtered from ${tests.length})` : ''}
      </p>
    </div>
  );
};

// Test Orders Tab Component (lab orders + serial bookings)
const TestOrdersTab = ({ orders, serialBookings, loading, onRefresh, navigate }) => {
  const [viewMode, setViewMode] = useState('all');

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'badge-warning',
      confirmed: 'badge-success',
      completed: 'badge-info',
      cancelled: 'badge-danger'
    };
    return badges[status] || 'badge-default';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const totalCount = orders.length + serialBookings.length;

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" />
        <p>Loading test orders...</p>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeWidth="2" />
        </svg>
        <h3>No Test Orders Yet</h3>
        <p>Book a test serial or place a lab order to see them here.</p>
        <button type="button" className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/user/dashboard', { state: { tab: 'tests' } })}>
          Book Test Serial
        </button>
      </div>
    );
  }

  const showSerials = viewMode === 'all' || viewMode === 'serials';
  const showOrders = viewMode === 'all' || viewMode === 'orders';

  return (
    <div className="test-orders-tab">
      <div className="home-services-header" style={{ marginBottom: '1rem' }}>
        <div className="view-mode-toggle">
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'serials' ? 'active' : ''}`}
            onClick={() => setViewMode('serials')}
          >
            Serial Bookings ({serialBookings.length})
          </button>
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'orders' ? 'active' : ''}`}
            onClick={() => setViewMode('orders')}
          >
            Lab Orders ({orders.length})
          </button>
        </div>
        <button type="button" className="btn-primary" onClick={onRefresh} style={{ marginLeft: 'auto' }}>
          Refresh
        </button>
      </div>

      <div className="orders-grid">
        {showSerials && serialBookings.map((booking) => (
          <div key={booking._id} className="order-card">
            <div className="order-header">
              <h3>Serial #{booking.serialNumber}</h3>
              <span className="badge badge-info">Serial</span>
              <span className={`badge ${getStatusBadge(booking.status)}`}>
                {booking.status}
              </span>
            </div>
            <div className="order-details">
              <p><strong>Booking:</strong> {booking.bookingNumber}</p>
              <p><strong>Test:</strong> {booking.testName || booking.testId?.name}</p>
              <p><strong>Provider:</strong> {booking.hospitalId?.name || booking.diagnosticCenterId?.name || 'N/A'}</p>
              <p><strong>Date:</strong> {formatDate(booking.appointmentDate)}</p>
              <p><strong>Time:</strong> {booking.timeSlot?.startTime} - {booking.timeSlot?.endTime}</p>
              <p><strong>Price:</strong> {booking.testPrice} tk</p>
            </div>
          </div>
        ))}

        {showOrders && orders.map((order) => (
          <div key={order._id} className="order-card">
            <div className="order-header">
              <h3>Order #{order.orderNumber}</h3>
              <span className="badge badge-default">Lab Order</span>
              <span className={`badge ${getStatusBadge(order.status)}`}>
                {order.status}
              </span>
            </div>
            <div className="order-details">
              <p><strong>Provider:</strong> {order.hospitalId?.name || order.diagnosticCenterId?.name || 'N/A'}</p>
              <p><strong>Tests:</strong> {order.tests?.length || 0} test(s)</p>
              {order.tests?.length > 0 && (
                <ul style={{ margin: '0.25rem 0 0 1rem', fontSize: '0.9rem' }}>
                  {order.tests.map((t, i) => (
                    <li key={i}>{t.testName || t.name} — {t.price} tk</li>
                  ))}
                </ul>
              )}
              <p><strong>Total:</strong> {order.finalAmount ?? order.totalAmount ?? 0} tk</p>
              <p><strong>Collection:</strong> {order.collectionType?.replace('_', ' ') || 'N/A'}</p>
              <p><strong>Ordered:</strong> {formatDate(order.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {viewMode === 'serials' && serialBookings.length === 0 && (
        <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '1rem' }}>No serial bookings. <button type="button" className="btn-link" onClick={() => navigate('/user/dashboard', { state: { tab: 'tests' } })}>Book a test serial</button></p>
      )}
      {viewMode === 'orders' && orders.length === 0 && (
        <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '1rem' }}>No lab orders yet.</p>
      )}
    </div>
  );
};

// Home Services Tab Component
const HomeServicesTab = ({ services, requests, serialBookings = [], onRefresh, onRequestService, onBookSerial, onRefreshRequests }) => {
  const [viewMode, setViewMode] = useState('browse'); // browse | my-requests | my-serials
  const [filterType, setFilterType] = useState('all'); // 'all', 'hospital', 'diagnostic'
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredServices, setFilteredServices] = useState(services);

  useEffect(() => {
    let filtered = services;

    // Filter by type
    if (filterType === 'hospital') {
      filtered = filtered.filter(s => s.hospitalId || s.hospital);
    } else if (filterType === 'diagnostic') {
      filtered = filtered.filter(s => s.diagnosticCenterId || s.diagnosticCenter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.serviceType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.hospital?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.diagnosticCenter?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredServices(filtered);
  }, [services, filterType, searchTerm]);

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'badge-warning',
      accepted: 'badge-success',
      rejected: 'badge-danger',
      completed: 'badge-info',
      cancelled: 'badge-default'
    };
    return badges[status] || 'badge-default';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="home-services-tab">
      <div className="home-services-header">
        <div className="view-mode-toggle">
          <button
            className={`view-mode-btn ${viewMode === 'browse' ? 'active' : ''}`}
            onClick={() => setViewMode('browse')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Browse Services
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'my-requests' ? 'active' : ''}`}
            onClick={() => setViewMode('my-requests')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            My Requests ({requests.length})
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'my-serials' ? 'active' : ''}`}
            onClick={() => setViewMode('my-serials')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            My Serials ({serialBookings.length})
          </button>
        </div>
      </div>

      {viewMode === 'browse' && (
        <div className="browse-services">
          <div className="services-filters">
            <div className="search-box">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                placeholder="Search services, hospitals, or diagnostic centers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All Services
              </button>
              <button
                className={`filter-btn ${filterType === 'hospital' ? 'active' : ''}`}
                onClick={() => setFilterType('hospital')}
              >
                Hospitals
              </button>
              <button
                className={`filter-btn ${filterType === 'diagnostic' ? 'active' : ''}`}
                onClick={() => setFilterType('diagnostic')}
              >
                Diagnostic Centers
              </button>
            </div>
          </div>

          {filteredServices.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" strokeWidth="2" />
              </svg>
              <h3>No Services Found</h3>
              <p>Try adjusting your filters or search term</p>
            </div>
          ) : (
            <div className="services-grid">
              {filteredServices.map((service) => (
                <div key={service._id} className="service-card">
                  <div className="service-card-header">
                    {(service.hospital?.logo || service.diagnosticCenter?.logo) && (
                      <img 
                        src={service.hospital?.logo || service.diagnosticCenter?.logo} 
                        alt={service.hospital?.name || service.diagnosticCenter?.name}
                        className="provider-logo"
                      />
                    )}
                    <div className="service-provider">
                      <span className="provider-type">
                        {service.hospital ? 'Hospital' : 'Diagnostic Center'}
                      </span>
                      <h4>{service.hospital?.name || service.diagnosticCenter?.name}</h4>
                    </div>
                  </div>
                  <div className="service-card-body">
                    <h3 className="service-type">{service.serviceType}</h3>
                    <p className="service-price">
                      <span className="price-label">Price:</span>
                      <span className="price-value">{service.price} tk</span>
                    </p>
                    {service.note && (
                      <p className="service-note">{service.note}</p>
                    )}
                    {service.availableTime && (
                      <div className="service-time">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        <span>{service.availableTime.startTime} - {service.availableTime.endTime}</span>
                      </div>
                    )}
                  </div>
                  <div className="service-card-footer" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {(service.hospitalId || service.hospital) && onBookSerial && (
                      <button
                        className="btn-primary btn-request"
                        onClick={() => onBookSerial(service)}
                      >
                        Book Serial
                      </button>
                    )}
                    <button 
                      className="btn-primary btn-request"
                      style={{ background: (service.hospitalId || service.hospital) ? '#6b7280' : undefined }}
                      onClick={() => onRequestService(service)}
                    >
                      {(service.hospitalId || service.hospital) ? 'Request (Manual)' : 'Request Service'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'my-serials' && (
        <div className="my-requests">
          {serialBookings.length === 0 ? (
            <div className="empty-state">
              <h3>No Serial Bookings Yet</h3>
              <p>Book a hospital home service serial to see it here.</p>
            </div>
          ) : (
            <div className="requests-list">
              {serialBookings.map((booking) => (
                <div key={booking._id} className="request-card">
                  <div className="request-header">
                    <div className="request-number">
                      <strong>{booking.bookingNumber}</strong>
                      <span className={`badge ${getStatusBadge(booking.status)}`}>{booking.status}</span>
                    </div>
                    <span>Serial #{booking.serialNumber}</span>
                  </div>
                  <div className="request-body">
                    <div className="request-info-row">
                      <div className="info-item">
                        <label>Service:</label>
                        <span>{booking.serviceType || booking.homeServiceId?.serviceType}</span>
                      </div>
                      <div className="info-item">
                        <label>Hospital:</label>
                        <span>{booking.hospitalId?.name || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <label>Date:</label>
                        <span>{formatDate(booking.appointmentDate)}</span>
                      </div>
                      <div className="info-item">
                        <label>Time:</label>
                        <span>{booking.timeSlot?.startTime} - {booking.timeSlot?.endTime}</span>
                      </div>
                    </div>
                    {booking.homeAddress && (
                      <div className="request-address">
                        <label>Address:</label>
                        <span>{booking.homeAddress.street}, {booking.homeAddress.city}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'my-requests' && (
        <div className="my-requests">
          {requests.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" />
              </svg>
              <h3>No Requests Yet</h3>
              <p>You haven't made any home service requests. Browse services to get started!</p>
            </div>
          ) : (
            <div className="requests-list">
              {requests.map((request) => (
                <div key={request.id} className="request-card">
                  <div className="request-header">
                    <div className="request-number">
                      <strong>Request #{request.requestNumber}</strong>
                      <span className={`badge ${getStatusBadge(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="request-date">
                      {formatDate(request.createdAt)}
                    </div>
                  </div>
                  <div className="request-body">
                    <div className="request-info-row">
                      <div className="info-item">
                        <label>Service:</label>
                        <span>{request.service?.serviceType || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <label>Provider:</label>
                        <span>{request.hospital?.name || request.diagnosticCenter?.name || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <label>Price:</label>
                        <span>{request.service?.price || 0} tk</span>
                      </div>
                    </div>
                    <div className="request-info-row">
                      <div className="info-item">
                        <label>Patient:</label>
                        <span>{request.patientName} ({request.patientAge} years, {request.patientGender})</span>
                      </div>
                      <div className="info-item">
                        <label>Phone:</label>
                        <span>{request.phoneNumber}</span>
                      </div>
                    </div>
                    {request.homeAddress && (
                      <div className="request-address">
                        <label>Address:</label>
                        <span>
                          {request.homeAddress.street}, {request.homeAddress.city}
                          {request.homeAddress.state && `, ${request.homeAddress.state}`}
                          {request.homeAddress.zipCode && ` ${request.homeAddress.zipCode}`}
                        </span>
                      </div>
                    )}
                    {request.requestedDate && (
                      <div className="request-date-time">
                        <label>Requested Date/Time:</label>
                        <span>
                          {formatDate(request.requestedDate)}
                          {request.requestedTime && ` at ${request.requestedTime}`}
                        </span>
                      </div>
                    )}
                    {request.notes && (
                      <div className="request-notes">
                        <label>Notes:</label>
                        <span>{request.notes}</span>
                      </div>
                    )}
                    {request.rejectionReason && (
                      <div className="request-rejection">
                        <label>Rejection Reason:</label>
                        <span className="rejection-text">{request.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// History Tab Component
const HistoryTab = ({ history, onRefresh }) => {
  if (history.length === 0) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" />
        </svg>
        <h3>No History</h3>
        <p>Your history will appear here</p>
      </div>
    );
  }

  return (
    <div className="history-tab">
      <div className="history-list">
        {history.map((item) => (
          <div key={item.id} className="history-item">
            <div className="history-icon">
              {item.type === 'serial' ? (
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              )}
            </div>
            <div className="history-content">
              <h4>
                {item.type === 'serial' ? 'Appointment'
                  : item.type === 'test_serial' ? `Test Serial #${item.serialNumber || ''}`
                  : item.type === 'home_service_serial' ? 'Home Service Serial'
                  : 'Home Service'}
              </h4>
              <p>{new Date(item.createdAt).toLocaleDateString()}</p>
              <span className={`badge ${item.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Search Tab Component
const SearchTab = ({ navigate }) => {
  return (
    <div className="search-tab">
      <div className="search-options">
        <button className="search-option-card" onClick={() => navigate('/search-doctors')}>
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
          <h3>Search Doctors</h3>
          <p>Find doctors by specialization, location, or name</p>
        </button>

        <button className="search-option-card" onClick={() => navigate('/user/dashboard', { state: { tab: 'tests' } })}>
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM7 8a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          <h3>Search Tests</h3>
          <p>Find diagnostic tests and book appointments</p>
        </button>

        <button className="search-option-card" onClick={() => navigate('/search-hospitals')}>
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          <h3>Search Hospitals</h3>
          <p>Find hospitals and clinics near you</p>
        </button>
      </div>
    </div>
  );
};

// Doctor Details Modal Component
const DoctorDetailsModal = ({ doctor, loading, onClose }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  if (loading) {
    return (
      <div className="doctor-modal-overlay" onClick={onClose}>
        <div className="doctor-modal" onClick={(e) => e.stopPropagation()}>
          <div className="doctor-modal-loading">
            <div className="spinner"></div>
            <p>Loading doctor details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="doctor-modal-overlay" onClick={onClose}>
        <div className="doctor-modal" onClick={(e) => e.stopPropagation()}>
          <div className="doctor-modal-error">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h3>Doctor details not available</h3>
            <button onClick={onClose} className="btn-close-modal">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="doctor-modal-overlay" onClick={onClose}>
      <div className="doctor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="doctor-modal-header">
          <h2>Doctor Details</h2>
          <button onClick={onClose} className="doctor-modal-close">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="doctor-modal-body">
          <div className="doctor-profile-section">
            <div className="doctor-profile-image">
              {doctor.profilePhotoUrl ? (
                <img src={doctor.profilePhotoUrl} alt={doctor.name} />
              ) : (
                <div className="doctor-profile-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
            <div className="doctor-profile-info">
              <h3>{doctor.name}</h3>
              {doctor.specialization && (
                <p className="doctor-specialization">
                  {Array.isArray(doctor.specialization) 
                    ? doctor.specialization.join(', ') 
                    : doctor.specialization}
                </p>
              )}
              {doctor.designation && (
                <p className="doctor-designation">{doctor.designation}</p>
              )}
            </div>
          </div>

          <div className="doctor-details-grid">
            <div className="detail-section">
              <h4>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                Contact Information
              </h4>
              <div className="detail-items">
                {doctor.email && (
                  <div className="detail-item">
                    <label>Email:</label>
                    <span>{doctor.email}</span>
                  </div>
                )}
                {doctor.phone && (
                  <div className="detail-item">
                    <label>Phone:</label>
                    <span>{doctor.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {doctor.medicalLicenseNumber && (
              <div className="detail-section">
                <h4>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Professional Information
                </h4>
                <div className="detail-items">
                  <div className="detail-item">
                    <label>Medical License:</label>
                    <span>{doctor.medicalLicenseNumber}</span>
                  </div>
                  {doctor.qualifications && doctor.qualifications.length > 0 && (
                    <div className="detail-item">
                      <label>Qualifications:</label>
                      <span>{Array.isArray(doctor.qualifications) ? doctor.qualifications.join(', ') : doctor.qualifications}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {doctor.bio && (
              <div className="detail-section">
                <h4>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Biography
                </h4>
                <p className="doctor-bio">{doctor.bio}</p>
              </div>
            )}

            {doctor.hospitals && doctor.hospitals.length > 0 && (
              <div className="detail-section">
                <h4>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                  Hospital Associations
                </h4>
                <div className="hospital-list">
                  {doctor.hospitals.map((hospital, index) => (
                    <div key={index} className="hospital-item">
                      <h5>{hospital.hospitalName}</h5>
                      {hospital.department && (
                        <p className="hospital-department">Department: {hospital.department}</p>
                      )}
                      {hospital.designation && (
                        <p className="hospital-designation">Designation: {hospital.designation}</p>
                      )}
                      {hospital.address && (
                        <p className="hospital-address">
                          <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: '14px', height: '14px', display: 'inline', marginRight: '4px' }}>
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          {typeof hospital.address === 'string' ? hospital.address : (
                            <>
                              {hospital.address.street && `${hospital.address.street}, `}
                              {hospital.address.city && `${hospital.address.city}, `}
                              {hospital.address.state && `${hospital.address.state}`}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {doctor.chambers && doctor.chambers.length > 0 && (
              <div className="detail-section">
                <h4>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  Chambers & Schedule
                </h4>
                <div className="chamber-list">
                  {doctor.chambers.map((chamber, index) => (
                    <div key={index} className="chamber-item">
                      <h5>{chamber.name}</h5>
                      {chamber.hospital && chamber.hospital.name && (
                        <p className="chamber-hospital">Hospital: {chamber.hospital.name}</p>
                      )}
                      {chamber.consultationFee && (
                        <p className="chamber-fee">Consultation Fee: {chamber.consultationFee} tk</p>
                      )}
                      {chamber.followUpFee && (
                        <p className="chamber-fee">Follow-up Fee: {chamber.followUpFee} tk</p>
                      )}
                      {chamber.schedules && chamber.schedules.length > 0 && (
                        <div className="chamber-schedule">
                          <strong>Schedule:</strong>
                          <ul>
                            {chamber.schedules.map((schedule, sIdx) => {
                              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                              const dayName = dayNames[schedule.dayOfWeek] || `Day ${schedule.dayOfWeek}`;
                              return (
                                <li key={sIdx}>
                                  {dayName}: {schedule.timeSlots && schedule.timeSlots.length > 0 ? (
                                    schedule.timeSlots.map((slot, slotIdx) => (
                                      <span key={slotIdx}>
                                        {slot.startTime} - {slot.endTime}
                                        {slotIdx < schedule.timeSlots.length - 1 ? ', ' : ''}
                                      </span>
                                    ))
                                  ) : 'Not specified'}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="doctor-modal-footer">
          <button onClick={onClose} className="btn-close-modal">Close</button>
        </div>
      </div>
    </div>
  );
};

// Home Service Request Modal Component
const HomeServiceRequestModal = ({ service, user, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    patientName: user?.name || '',
    patientAge: '',
    patientGender: user?.gender || '',
    phoneNumber: user?.phone || '',
    homeAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    },
    requestedDate: '',
    requestedTime: '',
    notes: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('address.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        homeAddress: {
          ...prev.homeAddress,
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.patientName.trim()) newErrors.patientName = 'Patient name is required';
    if (!formData.patientAge || formData.patientAge < 0) newErrors.patientAge = 'Valid age is required';
    if (!formData.patientGender) newErrors.patientGender = 'Gender is required';
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
    if (!formData.homeAddress.street.trim()) newErrors['address.street'] = 'Street address is required';
    if (!formData.homeAddress.city.trim()) newErrors['address.city'] = 'City is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const requestData = {
        homeServiceId: service._id,
        patientName: formData.patientName,
        patientAge: parseInt(formData.patientAge),
        patientGender: formData.patientGender,
        phoneNumber: formData.phoneNumber,
        homeAddress: formData.homeAddress,
        requestedDate: formData.requestedDate || undefined,
        requestedTime: formData.requestedTime || undefined,
        notes: formData.notes || undefined
      };

      const hid = resolveEntityId(service.hospital) || resolveEntityId(service.hospitalId);
      const cid = resolveEntityId(service.diagnosticCenter) || resolveEntityId(service.diagnosticCenterId);
      if (hid) requestData.hospitalId = hid;
      if (cid) requestData.diagnosticCenterId = cid;

      await onSubmit(requestData);
    } catch (err) {
      console.error('Error submitting request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="home-service-modal-overlay" onClick={onClose}>
      <div className="home-service-modal" onClick={(e) => e.stopPropagation()}>
        <div className="home-service-modal-header">
          <h2>Request Home Service</h2>
          <button onClick={onClose} className="modal-close-btn">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="home-service-modal-body">
          <div className="service-summary">
            <h3>{service.serviceType}</h3>
            <p className="service-provider">
              {service.hospital?.name || service.diagnosticCenter?.name}
            </p>
            <p className="service-price-summary">Price: {service.price} tk</p>
          </div>

          <form onSubmit={handleSubmit} className="request-form">
            <div className="form-section">
              <h4>Patient Information</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Patient Name *</label>
                  <input
                    type="text"
                    name="patientName"
                    value={formData.patientName}
                    onChange={handleChange}
                    className={errors.patientName ? 'error' : ''}
                  />
                  {errors.patientName && <span className="error-text">{errors.patientName}</span>}
                </div>
                <div className="form-group">
                  <label>Age *</label>
                  <input
                    type="number"
                    name="patientAge"
                    value={formData.patientAge}
                    onChange={handleChange}
                    min="0"
                    className={errors.patientAge ? 'error' : ''}
                  />
                  {errors.patientAge && <span className="error-text">{errors.patientAge}</span>}
                </div>
                <div className="form-group">
                  <label>Gender *</label>
                  <select
                    name="patientGender"
                    value={formData.patientGender}
                    onChange={handleChange}
                    className={errors.patientGender ? 'error' : ''}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.patientGender && <span className="error-text">{errors.patientGender}</span>}
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    className={errors.phoneNumber ? 'error' : ''}
                  />
                  {errors.phoneNumber && <span className="error-text">{errors.phoneNumber}</span>}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4>Home Address</h4>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Street Address *</label>
                  <input
                    type="text"
                    name="address.street"
                    value={formData.homeAddress.street}
                    onChange={handleChange}
                    className={errors['address.street'] ? 'error' : ''}
                  />
                  {errors['address.street'] && <span className="error-text">{errors['address.street']}</span>}
                </div>
                <div className="form-group">
                  <label>City *</label>
                  <input
                    type="text"
                    name="address.city"
                    value={formData.homeAddress.city}
                    onChange={handleChange}
                    className={errors['address.city'] ? 'error' : ''}
                  />
                  {errors['address.city'] && <span className="error-text">{errors['address.city']}</span>}
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input
                    type="text"
                    name="address.state"
                    value={formData.homeAddress.state}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Zip Code</label>
                  <input
                    type="text"
                    name="address.zipCode"
                    value={formData.homeAddress.zipCode}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Country</label>
                  <input
                    type="text"
                    name="address.country"
                    value={formData.homeAddress.country}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4>Service Schedule (Optional)</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Preferred Date</label>
                  <input
                    type="date"
                    name="requestedDate"
                    value={formData.requestedDate}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="form-group">
                  <label>Preferred Time</label>
                  <input
                    type="time"
                    name="requestedTime"
                    value={formData.requestedTime}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-group full-width">
                <label>Additional Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Any special instructions or requirements..."
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const HomeServiceSerialBookingModal = ({ service, user, onSubmit, onClose }) => {
  const hospitalId = resolveEntityId(service.hospital) || resolveEntityId(service.hospitalId);
  const serviceId = resolveEntityId(service) || service._id;
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSerials, setAvailableSerials] = useState([]);
  const [selectedSerial, setSelectedSerial] = useState(null);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [serialError, setSerialError] = useState('');
  const [servicePrice, setServicePrice] = useState(service.price);
  const [formData, setFormData] = useState({
    patientName: user?.name || '',
    patientAge: '',
    patientGender: user?.gender || '',
    phoneNumber: user?.phone || '',
    homeAddress: { street: '', city: '', state: '', zipCode: '', country: '' },
    notes: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

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
    if (!selectedDate || !hospitalId) return;
    const loadSerials = async () => {
      setLoadingSerials(true);
      setSerialError('');
      setSelectedSerial(null);
      try {
        const response = await api.get(
          `/patient/hospitals/${hospitalId}/home-services/${serviceId}/serials?date=${selectedDate}`
        );
        if (response.data.success) {
          setAvailableSerials(response.data.data.availableSerials || []);
          if (response.data.data.servicePrice) setServicePrice(response.data.data.servicePrice);
          if (response.data.data.message) setSerialError(response.data.data.message);
        }
      } catch (err) {
        setSerialError(err.response?.data?.message || 'Serial booking not available for this service');
        setAvailableSerials([]);
      } finally {
        setLoadingSerials(false);
      }
    };
    loadSerials();
  }, [selectedDate, hospitalId, serviceId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('address.')) {
      const field = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        homeAddress: { ...prev.homeAddress, [field]: value }
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!selectedDate) newErrors.date = 'Date is required';
    if (!selectedSerial) newErrors.serial = 'Please select a serial';
    if (!formData.patientName.trim()) newErrors.patientName = 'Patient name is required';
    if (!formData.patientAge || formData.patientAge < 0) newErrors.patientAge = 'Valid age is required';
    if (!formData.patientGender) newErrors.patientGender = 'Gender is required';
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
    if (!formData.homeAddress.street.trim()) newErrors['address.street'] = 'Street address is required';
    if (!formData.homeAddress.city.trim()) newErrors['address.city'] = 'City is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        hospitalId,
        homeServiceId: serviceId,
        serialNumber: selectedSerial.serialNumber,
        date: selectedDate,
        patientName: formData.patientName,
        patientAge: parseInt(formData.patientAge, 10),
        patientGender: formData.patientGender,
        phoneNumber: formData.phoneNumber,
        homeAddress: formData.homeAddress,
        notes: formData.notes || undefined
      });
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="home-service-modal-overlay" onClick={onClose}>
      <div className="home-service-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="home-service-modal-header">
          <h2>Book Home Service Serial</h2>
          <button onClick={onClose} className="modal-close-btn">×</button>
        </div>
        <div className="home-service-modal-body">
          <div className="service-summary">
            <h3>{service.serviceType}</h3>
            <p>{service.hospital?.name}</p>
            <p className="service-price-summary">Price: {servicePrice} tk</p>
          </div>
          {!hospitalId ? (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              Could not determine hospital for this service. Please refresh the page and try again.
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="request-form">
            <div className="form-section">
              <h4>Select Date & Serial</h4>
              <div className="form-group">
                <label>Appointment Date *</label>
                <input
                  type="date"
                  min={minDate}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={errors.date ? 'error' : ''}
                />
                {errors.date && <span className="error-text">{errors.date}</span>}
              </div>
              {loadingSerials && <p>Loading available serials...</p>}
              {serialError && !loadingSerials && <p className="error-text">{serialError}</p>}
              {selectedDate && !loadingSerials && availableSerials.length > 0 && (
                <div className="serials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {availableSerials.map((s) => (
                    <button
                      key={s.serialNumber}
                      type="button"
                      className={`serial-button ${selectedSerial?.serialNumber === s.serialNumber ? 'selected' : ''}`}
                      style={{
                        padding: '0.75rem',
                        border: selectedSerial?.serialNumber === s.serialNumber ? '2px solid #667eea' : '1px solid #ddd',
                        borderRadius: '8px',
                        background: selectedSerial?.serialNumber === s.serialNumber ? '#eef2ff' : '#fff',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedSerial(s)}
                    >
                      <div><strong>#{s.serialNumber}</strong></div>
                      <small>{s.time} - {s.endTime}</small>
                    </button>
                  ))}
                </div>
              )}
              {errors.serial && <span className="error-text">{errors.serial}</span>}
            </div>

            <div className="form-section">
              <h4>Patient Information</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Patient Name *</label>
                  <input type="text" name="patientName" value={formData.patientName} onChange={handleChange} className={errors.patientName ? 'error' : ''} />
                  {errors.patientName && <span className="error-text">{errors.patientName}</span>}
                </div>
                <div className="form-group">
                  <label>Age *</label>
                  <input type="number" name="patientAge" value={formData.patientAge} onChange={handleChange} min="0" className={errors.patientAge ? 'error' : ''} />
                  {errors.patientAge && <span className="error-text">{errors.patientAge}</span>}
                </div>
                <div className="form-group">
                  <label>Gender *</label>
                  <select name="patientGender" value={formData.patientGender} onChange={handleChange} className={errors.patientGender ? 'error' : ''}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.patientGender && <span className="error-text">{errors.patientGender}</span>}
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className={errors.phoneNumber ? 'error' : ''} />
                  {errors.phoneNumber && <span className="error-text">{errors.phoneNumber}</span>}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4>Home Address</h4>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Street *</label>
                  <input type="text" name="address.street" value={formData.homeAddress.street} onChange={handleChange} className={errors['address.street'] ? 'error' : ''} />
                  {errors['address.street'] && <span className="error-text">{errors['address.street']}</span>}
                </div>
                <div className="form-group">
                  <label>City *</label>
                  <input type="text" name="address.city" value={formData.homeAddress.city} onChange={handleChange} className={errors['address.city'] ? 'error' : ''} />
                  {errors['address.city'] && <span className="error-text">{errors['address.city']}</span>}
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting || !hospitalId}>
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
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
        setSerialError(err.response?.data?.message || 'Serial booking not available. Ask the provider to enable serial settings.');
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
      setTimeout(() => setError(''), 3000);
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
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to book serial');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = new Date().toISOString().split('T')[0];
  const providerName = test.hospital?.name || test.diagnosticCenter?.name;

  return (
    <div className="home-service-modal-overlay" onClick={onClose}>
      <div className="home-service-modal" onClick={(e) => e.stopPropagation()}>
        <div className="home-service-modal-header">
          <h2>Book Test Serial</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="home-service-modal-body">
          <div className="service-summary">
            <h3>{test.name}</h3>
            <p className="service-provider">{providerName}</p>
            <p className="service-price-summary">Price: {testPrice} tk</p>
          </div>
          <form onSubmit={handleSubmit} className="request-form">
            <div className="form-section">
              <div className="form-group">
                <label>Appointment Date *</label>
                <input
                  type="date"
                  min={minDate}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                />
              </div>
              {loadingSerials && <p>Loading available serials...</p>}
              {serialError && !loadingSerials && <p className="error-text">{serialError}</p>}
              {selectedDate && !loadingSerials && availableSerials.length > 0 && (
                <div className="form-group">
                  <label>Select Serial (even numbers only) *</label>
                  <div className="serials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {availableSerials.map((s) => (
                      <button
                        key={s.serialNumber}
                        type="button"
                        className={`serial-button ${selectedSerial?.serialNumber === s.serialNumber ? 'selected' : ''}`}
                        style={{
                          padding: '0.6rem',
                          border: selectedSerial?.serialNumber === s.serialNumber ? '2px solid #667eea' : '1px solid #ddd',
                          borderRadius: '8px',
                          background: selectedSerial?.serialNumber === s.serialNumber ? '#eef2ff' : '#fff',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedSerial(s)}
                      >
                        <div><strong>#{s.serialNumber}</strong></div>
                        <small>{s.time} – {s.endTime}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="form-actions">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting || !selectedSerial}>
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;


