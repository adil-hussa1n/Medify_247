import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import Navbar from '../components/Navbar';
import HomeServiceDetailsModal from '../components/HomeServiceDetailsModal';
import HomeServiceSerialUpdateModal from '../components/HomeServiceSerialUpdateModal';
import {
  canAccess,
  canAccessTab,
  ROLE_OPTIONS,
  DC_PERMISSIONS
} from '../utils/diagnosticCenterPermissions';
import './DiagnosticCenterDashboard.css';

const DASHBOARD_TABS = [
  { key: 'overview', label: 'Overview', icon: 'overview' },
  { key: 'tests', label: 'Tests', icon: 'tests' },
  { key: 'orders', label: 'Orders', icon: 'orders' },
  { key: 'home-services', label: 'Home Services', icon: 'home' },
  { key: 'requests', label: 'Service Requests', icon: 'requests' },
  { key: 'home-serial-bookings', label: 'Serial Bookings', icon: 'serials' },
  { key: 'doctors', label: 'Doctors', icon: 'doctors' },
  { key: 'staff', label: 'Team & Access', icon: 'staff' }
];

const DiagnosticCenterDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [centerId, setCenterId] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [tests, setTests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [homeServices, setHomeServices] = useState([]);
  const [homeServiceRequests, setHomeServiceRequests] = useState([]);
  const [homeServiceSerialBookings, setHomeServiceSerialBookings] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [membership, setMembership] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);

  useEffect(() => {
    if (!user || user.role !== 'diagnostic_center_admin') {
      navigate('/diagnostic-center/login');
      return;
    }
    fetchCenterId();
  }, [user]);

  useEffect(() => {
    if (centerId) {
      fetchCenterAccess();
      if (!dashboardData) {
        fetchDashboardData();
      }
      if (activeTab === 'tests') fetchTests();
      if (activeTab === 'orders') fetchOrders();
      if (activeTab === 'home-services') fetchHomeServices();
      if (activeTab === 'requests') fetchHomeServiceRequests();
      if (activeTab === 'home-serial-bookings') fetchHomeServiceSerialBookings();
      if (activeTab === 'doctors') fetchDoctors();
      if (activeTab === 'staff') fetchStaffMembers();
    }
  }, [centerId, activeTab]);

  const visibleTabs = useMemo(
    () => DASHBOARD_TABS.filter((tab) => canAccessTab(permissions, tab.key)),
    [permissions]
  );

  useEffect(() => {
    if (!permissions.length || !visibleTabs.length) return;
    if (!canAccessTab(permissions, activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [permissions, visibleTabs, activeTab]);

  const fetchCenterId = async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      const userResponse = await api.get(`/users/${user.id}`);
      console.log('User response:', userResponse.data);
      
      if (userResponse.data.success && userResponse.data.data.roleData) {
        const id = userResponse.data.data.roleData._id;
        console.log('Center ID:', id);
        setCenterId(id);
        const access = userResponse.data.data.diagnosticCenterAccess;
        if (access?.permissions) {
          setPermissions(access.permissions);
          setMembership(access);
        }

        // Fetch dashboard data immediately after getting centerId
        try {
          const dashboardResponse = await api.get(`/diagnostic-centers/${id}/dashboard`);
          console.log('Dashboard response:', dashboardResponse.data);
          
          if (dashboardResponse.data.success) {
            setDashboardData(dashboardResponse.data.data);
          } else {
            setError(dashboardResponse.data.message || 'Failed to load dashboard data.');
          }
        } catch (dashboardErr) {
          console.error('Error fetching dashboard:', dashboardErr);
          console.error('Dashboard error response:', dashboardErr.response?.data);
          
          if (dashboardErr.response?.status === 403) {
            setError('Diagnostic center must be approved to view dashboard.');
          } else if (dashboardErr.response?.status === 404) {
            setError('Diagnostic center not found.');
          } else if (dashboardErr.response?.status === 401) {
            setError('Unauthorized. Please log in again.');
          } else {
            setError(dashboardErr.response?.data?.message || 'Failed to load dashboard data. Please try again.');
          }
        }
      } else {
        console.error('No roleData found in user response:', userResponse.data);
        setError('Failed to load diagnostic center data. Role data not found. Please contact support.');
      }
    } catch (err) {
      console.error('Error fetching diagnostic center ID:', err);
      console.error('Error response:', err.response?.data);
      
      if (err.response?.status === 401) {
        setError('Unauthorized. Please log in again.');
        navigate('/diagnostic-center/login');
      } else if (err.response?.status === 404) {
        setError('User not found. Please contact support.');
      } else {
        setError(err.response?.data?.message || 'Failed to load diagnostic center data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCenterAccess = async () => {
    if (!centerId) return;
    try {
      const response = await api.get(`/diagnostic-centers/${centerId}/access`);
      if (response.data.success) {
        setPermissions(response.data.data.permissions || []);
        setMembership(response.data.data.membership);
      }
    } catch (err) {
      console.error('Error fetching center access:', err);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const response = await api.get(`/diagnostic-centers/${centerId}/staff`);
      if (response.data.success) {
        setStaffMembers(response.data.data.staff || []);
      }
    } catch (err) {
      console.error('Error fetching staff:', err);
      if (err.response?.status === 403) {
        setError('You do not have permission to view team members.');
      }
    }
  };

  const fetchDashboardData = async () => {
    if (!centerId) return;
    try {
      setLoading(true);
      const response = await api.get(`/diagnostic-centers/${centerId}/dashboard`);
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      if (err.response?.status === 403) {
        setError('Diagnostic center must be approved to view dashboard.');
      } else if (err.response?.status === 404) {
        setError('Diagnostic center not found.');
      } else {
        setError(err.response?.data?.message || 'Failed to load dashboard data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTests = async () => {
    try {
      const response = await api.get(`/diagnostic-centers/${centerId}/tests`);
      if (response.data.success) {
        setTests(response.data.data.tests || []);
      }
    } catch (err) {
      console.error('Error fetching tests:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await api.get(`/diagnostic-centers/${centerId}/orders`);
      if (response.data.success) {
        setOrders(response.data.data.orders || []);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  const fetchHomeServices = async () => {
    try {
      const response = await api.get(`/diagnostic-centers/${centerId}/home-services`);
      if (response.data.success) {
        setHomeServices(response.data.data.homeServices || []);
      }
    } catch (err) {
      console.error('Error fetching home services:', err);
    }
  };

  const fetchHomeServiceSerialBookings = async () => {
    try {
      const response = await api.get(`/diagnostic-centers/${centerId}/home-service-serial-bookings`);
      if (response.data.success) {
        setHomeServiceSerialBookings(response.data.data.bookings || []);
      }
    } catch (err) {
      console.error('Error fetching home service serial bookings:', err);
    }
  };

  const fetchHomeServiceRequests = async () => {
    try {
      const response = await api.get(`/diagnostic-centers/${centerId}/home-service-requests`);
      if (response.data.success) {
        setHomeServiceRequests(response.data.data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await api.get(`/diagnostic-centers/${centerId}/doctors`);
      if (response.data.success) {
        setDoctors(response.data.data.doctors || []);
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  // Show loading only if we're still loading and don't have centerId yet
  if (loading && !centerId && !error) {
    return (
      <div className="dashboard-container">
        <Navbar />
        <div className="dashboard-loading">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { metrics, diagnosticCenter } = dashboardData || {};

  return (
    <div className="dashboard-container">
      <Navbar />
      
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Diagnostic Center Dashboard</h1>
            <p className="dashboard-subtitle">
              Welcome back, {diagnosticCenter?.name || 'Admin'}
              {membership?.roleLabel && (
                <span className="role-badge"> · {membership.roleLabel}</span>
              )}
            </p>
          </div>
        </div>

        {error && (
          <div className="dashboard-alert alert-error">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {success && (
          <div className="dashboard-alert alert-success">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {success}
          </div>
        )}

        <div className="dashboard-tabs">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <TabIcon type={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {activeTab === 'overview' && (
            <OverviewTab 
              metrics={metrics} 
              diagnosticCenter={diagnosticCenter}
              navigate={navigate}
            />
          )}
          {activeTab === 'tests' && (
            <TestsTab 
              centerId={centerId}
              tests={tests}
              onRefresh={fetchTests}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'orders' && (
            <OrdersTab 
              centerId={centerId}
              orders={orders}
              onRefresh={fetchOrders}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'home-services' && (
            <HomeServicesTab 
              centerId={centerId}
              services={homeServices}
              onRefresh={fetchHomeServices}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'requests' && (
            <RequestsTab 
              centerId={centerId}
              requests={homeServiceRequests}
              onRefresh={fetchHomeServiceRequests}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'home-serial-bookings' && (
            <DiagnosticHomeServiceSerialBookingsTab
              centerId={centerId}
              bookings={homeServiceSerialBookings}
              onRefresh={fetchHomeServiceSerialBookings}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'doctors' && (
            <DoctorsTab 
              centerId={centerId}
              doctors={doctors}
              onRefresh={fetchDoctors}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'staff' && (
            <DiagnosticCenterStaffTab
              centerId={centerId}
              staff={staffMembers}
              membership={membership}
              canManage={canAccess(permissions, 'staff:manage')}
              onRefresh={fetchStaffMembers}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ metrics, diagnosticCenter, navigate }) => {
  return (
    <>
      <div className="dashboard-metrics">
        <div className="metric-card">
          <div className="metric-icon tests">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{metrics?.totalTests || 0}</h3>
            <p className="metric-label">Total Tests</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon orders">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{metrics?.pendingOrders || 0}</h3>
            <p className="metric-label">Pending Orders</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon completed">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{metrics?.completedOrders || 0}</h3>
            <p className="metric-label">Completed Orders</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon revenue">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.177 1.089V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.177-1.089V5z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{metrics?.totalRevenue || 0} tk</h3>
            <p className="metric-label">Total Revenue</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2 className="section-title">Quick Actions</h2>
        <div className="action-cards">
          <div className="action-card" onClick={() => navigate('/diagnostic-center/profile')}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <h3>Center Profile</h3>
            <p>View and edit diagnostic center information</p>
          </div>
        </div>
      </div>
    </>
  );
};

// Tests Tab Component - Similar to Hospital Dashboard TestsTab
const TestsTab = ({ centerId, tests, onRefresh, setSuccess, setError }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [testToDelete, setTestToDelete] = useState(null);
  const [serialSettings, setSerialSettings] = useState(null);
  const [serialStats, setSerialStats] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'other',
    description: '',
    price: '',
    duration: '24',
    preparation: '',
    isActive: true,
    isPackage: false,
  });
  const [serialFormData, setSerialFormData] = useState({
    totalSerialsPerDay: 20,
    startTime: '09:00',
    endTime: '17:00',
    testPrice: '',
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingSerial, setLoadingSerial] = useState(false);
  const [loadingView, setLoadingView] = useState(false);

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      category: 'other',
      description: '',
      price: '',
      duration: '24',
      preparation: '',
      isActive: true,
      isPackage: false,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post(`/diagnostic-centers/${centerId}/tests`, {
        ...formData,
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration),
      });
      if (response.data.success) {
        setSuccess('Test added successfully!');
        setShowAddForm(false);
        resetForm();
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add test.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleView = async (test) => {
    setSelectedTest(test);
    setLoadingView(true);
    setShowViewModal(true);
    
    try {
      // Fetch serial settings
      try {
        const settingsResponse = await api.get(`/diagnostic-centers/${centerId}/tests/${test._id}/serial-settings`);
        if (settingsResponse.data.success && settingsResponse.data.data.serialSettings) {
          setSerialSettings(settingsResponse.data.data.serialSettings);
        }
      } catch (err) {
        // Serial settings might not exist yet
        setSerialSettings(null);
      }

      // Fetch serial statistics
      try {
        const statsResponse = await api.get(`/diagnostic-centers/${centerId}/tests/${test._id}/serial-stats`);
        if (statsResponse.data.success) {
          setSerialStats(statsResponse.data.data);
        }
      } catch (err) {
        // Stats might not be available
        setSerialStats(null);
      }
    } catch (err) {
      console.error('Error fetching test details:', err);
    } finally {
      setLoadingView(false);
    }
  };

  const handleManageSerial = async (test) => {
    setSelectedTest(test);
    setLoadingSerial(true);
    try {
      const response = await api.get(`/diagnostic-centers/${centerId}/tests/${test._id}/serial-settings`);
      if (response.data.success && response.data.data.serialSettings) {
        const settings = response.data.data.serialSettings;
        setSerialFormData({
          totalSerialsPerDay: settings.totalSerialsPerDay || 20,
          startTime: settings.serialTimeRange?.startTime || '09:00',
          endTime: settings.serialTimeRange?.endTime || '17:00',
          testPrice: settings.testPrice || test.price || '',
          availableDays: settings.availableDays || [0, 1, 2, 3, 4, 5, 6],
          isActive: settings.isActive !== undefined ? settings.isActive : true,
        });
      } else {
        // Use test price as default
        setSerialFormData({
          totalSerialsPerDay: 20,
          startTime: '09:00',
          endTime: '17:00',
          testPrice: test.price || '',
          availableDays: [0, 1, 2, 3, 4, 5, 6],
          isActive: true,
        });
      }
      setShowSerialModal(true);
    } catch (err) {
      // If no settings exist, use defaults
      setSerialFormData({
        totalSerialsPerDay: 20,
        startTime: '09:00',
        endTime: '17:00',
        testPrice: test.price || '',
        availableDays: [0, 1, 2, 3, 4, 5, 6],
        isActive: true,
      });
      setShowSerialModal(true);
    } finally {
      setLoadingSerial(false);
    }
  };

  const handleSerialSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const submitData = {
        totalSerialsPerDay: parseInt(serialFormData.totalSerialsPerDay),
        serialTimeRange: {
          startTime: serialFormData.startTime,
          endTime: serialFormData.endTime,
        },
        testPrice: parseFloat(serialFormData.testPrice),
        availableDays: serialFormData.availableDays,
        isActive: serialFormData.isActive,
      };
      
      const response = await api.post(`/diagnostic-centers/${centerId}/tests/${selectedTest._id}/serial-settings`, submitData);
      if (response.data.success) {
        setSuccess('Test serial settings updated successfully!');
        setShowSerialModal(false);
        setSelectedTest(null);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update serial settings.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDay = (day) => {
    setSerialFormData(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter(d => d !== day)
        : [...prev.availableDays, day]
    }));
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const handleEdit = (test) => {
    setSelectedTest(test);
    setFormData({
      name: test.name || '',
      code: test.code || '',
      category: test.category || 'other',
      description: test.description || '',
      price: test.price || '',
      duration: test.duration || '24',
      preparation: test.preparation || '',
      isActive: test.isActive !== undefined ? test.isActive : true,
      isPackage: test.isPackage || false,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.put(`/diagnostic-centers/${centerId}/tests/${selectedTest._id}`, {
        ...formData,
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration),
      });
      if (response.data.success) {
        setSuccess('Test updated successfully!');
        setShowEditModal(false);
        setSelectedTest(null);
        resetForm();
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update test.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (test) => {
    setTestToDelete(test);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!testToDelete) return;
    
    setDeleting(true);
    try {
      const response = await api.delete(`/diagnostic-centers/${centerId}/tests/${testToDelete._id}`);
      if (response.data.success) {
        setSuccess('Test deleted successfully!');
        setShowDeleteModal(false);
        setTestToDelete(null);
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete test.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setTestToDelete(null);
  };

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Tests Management</h2>
        <button onClick={() => setShowAddForm(!showAddForm)} className="add-button">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Test
        </button>
      </div>

      {showAddForm && (
        <div className="add-form-card">
          <div className="form-header">
            <h3>Add New Test</h3>
            <button type="button" className="close-button" onClick={() => { setShowAddForm(false); resetForm(); }}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Test Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Test Code</label>
                <input type="text" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label>Category *</label>
                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} required>
                  <option value="pathology">Pathology</option>
                  <option value="radiology">Radiology</option>
                  <option value="cardiology">Cardiology</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Price (tk) *</label>
                <input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} required min="0" />
              </div>
              <div className="form-group">
                <label>Duration (hours)</label>
                <input type="number" value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} min="0" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows="3" />
              </div>
              <div className="form-group">
                <label>Preparation Instructions</label>
                <textarea value={formData.preparation} onChange={(e) => setFormData({...formData, preparation: e.target.value})} rows="3" />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => { setShowAddForm(false); resetForm(); }}>Cancel</button>
              <button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Test'}</button>
            </div>
          </form>
        </div>
      )}

      {/* View Test Modal */}
      {showViewModal && selectedTest && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>Test Details - {selectedTest.name}</h2>
              <button className="close-button" onClick={() => setShowViewModal(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              {loadingView ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="spinner" style={{ margin: '0 auto' }}></div>
                  <p>Loading test details...</p>
                </div>
              ) : (
                <>
                  {/* Test Information Section */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e5e7eb' }}>
                      Test Information
                    </h3>
                    <div className="doctor-detail-grid">
                      <div className="detail-item">
                        <label>Test Name:</label>
                        <span>{selectedTest.name}</span>
                      </div>
                      {selectedTest.code && (
                        <div className="detail-item">
                          <label>Test Code:</label>
                          <span>{selectedTest.code}</span>
                        </div>
                      )}
                      <div className="detail-item">
                        <label>Category:</label>
                        <span style={{ textTransform: 'capitalize' }}>{selectedTest.category}</span>
                      </div>
                      <div className="detail-item">
                        <label>Price:</label>
                        <span>{selectedTest.price} tk</span>
                      </div>
                      <div className="detail-item">
                        <label>Duration:</label>
                        <span>{selectedTest.duration} hours</span>
                      </div>
                      <div className="detail-item">
                        <label>Status:</label>
                        <span className={`status-badge ${selectedTest.isActive ? 'active' : 'inactive'}`}>
                          {selectedTest.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {selectedTest.description && (
                        <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                          <label>Description:</label>
                          <span>{selectedTest.description}</span>
                        </div>
                      )}
                      {selectedTest.preparation && (
                        <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                          <label>Preparation Instructions:</label>
                          <span>{selectedTest.preparation}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Serial Settings Section */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e5e7eb' }}>
                      Serial Settings
                    </h3>
                    {serialSettings ? (
                      <div className="doctor-detail-grid">
                        <div className="detail-item">
                          <label>Total Serials Per Day:</label>
                          <span>{serialSettings.totalSerialsPerDay || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Time Range:</label>
                          <span>{serialSettings.serialTimeRange?.startTime || 'N/A'} - {serialSettings.serialTimeRange?.endTime || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Test Price:</label>
                          <span>{serialSettings.testPrice ? `${serialSettings.testPrice} tk` : 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Status:</label>
                          <span className={`status-badge ${serialSettings.isActive ? 'active' : 'inactive'}`}>
                            {serialSettings.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {serialSettings.availableDays && serialSettings.availableDays.length > 0 && (
                          <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                            <label>Available Days:</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                              {dayNames.map((day, index) => (
                                serialSettings.availableDays.includes(index) && (
                                  <span key={index} style={{ 
                                    padding: '0.25rem 0.75rem', 
                                    background: '#dbeafe', 
                                    color: '#1e40af', 
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    fontWeight: '500'
                                  }}>
                                    {day}
                                  </span>
                                )
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ color: '#6b7280', margin: 0 }}>No serial settings configured yet. Click "Manage Serial" to set up.</p>
                      </div>
                    )}
                  </div>

                  {/* Serial Statistics Section */}
                  {serialStats && (
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e5e7eb' }}>
                        Serial Statistics
                      </h3>
                      <div className="doctor-detail-grid">
                        <div className="detail-item">
                          <label>Date:</label>
                          <span>{serialStats.statistics?.date || 'Today'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Total Booked:</label>
                          <span>{serialStats.statistics?.totalBooked || 0}</span>
                        </div>
                        <div className="detail-item">
                          <label>Booked Even Serials:</label>
                          <span>{serialStats.statistics?.bookedEvenSerials || 0}</span>
                        </div>
                        <div className="detail-item">
                          <label>Available Even Serials:</label>
                          <span>{serialStats.statistics?.availableEvenSerials || 0}</span>
                        </div>
                        {serialStats.statistics?.bookedPatients && serialStats.statistics.bookedPatients.length > 0 && (
                          <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                            <label>Booked Patients:</label>
                            <div style={{ marginTop: '0.5rem' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                  <tr style={{ background: '#f3f4f6' }}>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #e5e7eb' }}>Serial #</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #e5e7eb' }}>Patient</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #e5e7eb' }}>Time</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {serialStats.statistics.bookedPatients.map((booking, idx) => (
                                    <tr key={idx}>
                                      <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb' }}>{booking.serialNumber || '-'}</td>
                                      <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb' }}>{booking.patient?.name || 'N/A'}</td>
                                      <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb' }}>{booking.time || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowViewModal(false); handleManageSerial(selectedTest); }} className="edit-btn">
                Manage Serial
              </button>
              <button onClick={() => { setShowViewModal(false); handleEdit(selectedTest); }} className="edit-btn">Edit</button>
              <button onClick={() => setShowViewModal(false)} className="close-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Serial Settings Modal */}
      {showSerialModal && selectedTest && (
        <div className="modal-overlay" onClick={() => setShowSerialModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Serial Settings - {selectedTest.name}</h2>
              <button className="close-button" onClick={() => setShowSerialModal(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              {loadingSerial ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="spinner" style={{ margin: '0 auto' }}></div>
                  <p>Loading serial settings...</p>
                </div>
              ) : (
                <form onSubmit={handleSerialSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Total Serials Per Day *</label>
                      <input type="number" value={serialFormData.totalSerialsPerDay} onChange={(e) => setSerialFormData({...serialFormData, totalSerialsPerDay: e.target.value})} required min="1" />
                    </div>
                    <div className="form-group">
                      <label>Start Time *</label>
                      <input type="time" value={serialFormData.startTime} onChange={(e) => setSerialFormData({...serialFormData, startTime: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label>End Time *</label>
                      <input type="time" value={serialFormData.endTime} onChange={(e) => setSerialFormData({...serialFormData, endTime: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label>Test Price (tk) *</label>
                      <input type="number" step="0.01" value={serialFormData.testPrice} onChange={(e) => setSerialFormData({...serialFormData, testPrice: e.target.value})} required min="0" />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Available Days *</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {dayNames.map((day, index) => (
                          <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={serialFormData.availableDays.includes(index)}
                              onChange={() => toggleDay(index)}
                            />
                            <span>{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select value={serialFormData.isActive ? 'active' : 'inactive'} onChange={(e) => setSerialFormData({...serialFormData, isActive: e.target.value === 'active'})}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowSerialModal(false)}>Cancel</button>
                    <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Settings'}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && testToDelete && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="close-button" onClick={handleDeleteCancel}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-confirmation-content">
                <div className="delete-confirmation-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3>Are you sure you want to delete this test?</h3>
                <p>
                  This will permanently delete <strong>{testToDelete.name}</strong>. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={handleDeleteCancel} className="close-btn" disabled={deleting}>
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} className="delete-btn" disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Test Modal */}
      {showEditModal && selectedTest && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Test</h2>
              <button className="close-button" onClick={() => setShowEditModal(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpdate}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Test Name *</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Test Code</label>
                    <input type="text" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} required>
                      <option value="pathology">Pathology</option>
                      <option value="radiology">Radiology</option>
                      <option value="cardiology">Cardiology</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Price (tk) *</label>
                    <input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} required min="0" />
                  </div>
                  <div className="form-group">
                    <label>Duration (hours)</label>
                    <input type="number" value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} min="0" />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={formData.isActive ? 'active' : 'inactive'} onChange={(e) => setFormData({...formData, isActive: e.target.value === 'active'})}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows="3" />
                  </div>
                  <div className="form-group">
                    <label>Preparation Instructions</label>
                    <textarea value={formData.preparation} onChange={(e) => setFormData({...formData, preparation: e.target.value})} rows="3" />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" disabled={submitting}>{submitting ? 'Updating...' : 'Update Test'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="data-table">
        {tests.length === 0 ? (
          <div className="empty-state">
            <p>No tests found. Add your first test to get started.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Category</th>
                <th>Price</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr key={test._id}>
                  <td>{test.name}</td>
                  <td>{test.code || '-'}</td>
                  <td><span className="status-badge" style={{ textTransform: 'capitalize' }}>{test.category}</span></td>
                  <td>{test.price} tk</td>
                  <td>{test.duration} hrs</td>
                  <td><span className={`status-badge ${test.isActive ? 'active' : 'inactive'}`}>{test.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="action-buttons">
                      <button onClick={() => handleView(test)} className="action-btn view-btn">View</button>
                      <button onClick={() => handleEdit(test)} className="action-btn edit-btn">Edit</button>
                      <button onClick={() => handleManageSerial(test)} className="action-btn edit-btn">Manage Serial</button>
                      <button onClick={() => handleDeleteClick(test)} className="action-btn delete-btn" disabled={deleting}>
                        {deleting ? '...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// Orders Tab Component
const OrdersTab = ({ centerId, orders, onRefresh, setSuccess, setError }) => {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reportUrl, setReportUrl] = useState('');

  const handleStatusUpdate = async (orderId, status) => {
    try {
      const response = await api.put(`/diagnostic-centers/${centerId}/orders/${orderId}/status`, { status });
      if (response.data.success) {
        setSuccess(`Order ${status} successfully!`);
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update order status.');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleView = (order) => {
    setSelectedOrder(order);
    setShowViewModal(true);
  };

  const handleUploadClick = (order) => {
    setSelectedOrder(order);
    setReportUrl('');
    setShowUploadModal(true);
  };

  const handleUploadReport = async (e) => {
    e.preventDefault();
    if (!reportUrl.trim()) {
      setError('Please provide a report URL.');
      return;
    }
    
    setUploading(true);
    try {
      const response = await api.post(`/diagnostic-centers/${centerId}/orders/${selectedOrder._id}/upload-report`, {
        reportUrl: reportUrl.trim()
      });
      if (response.data.success) {
        setSuccess('Report uploaded successfully!');
        setShowUploadModal(false);
        setSelectedOrder(null);
        setReportUrl('');
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload report.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Test Orders</h2>
      </div>
      <div className="data-table">
        {orders.length === 0 ? (
          <div className="empty-state">
            <p>No orders found.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Patient</th>
                <th>Test</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id}>
                  <td>{order.orderNumber || order._id.slice(-8)}</td>
                  <td>{order.patientId?.name || 'N/A'}</td>
                  <td>{order.testId?.name || 'N/A'}</td>
                  <td>{new Date(order.orderDate || order.createdAt).toLocaleDateString()}</td>
                  <td><span className={`status-badge ${order.status}`}>{order.status}</span></td>
                  <td>
                    <div className="action-buttons">
                      <button onClick={() => handleView(order)} className="action-btn view-btn">View</button>
                      {order.status === 'pending' && (
                        <>
                          <button onClick={() => handleStatusUpdate(order._id, 'processing')} className="action-btn edit-btn">Process</button>
                        </>
                      )}
                      {order.status === 'processing' && (
                        <button onClick={() => handleUploadClick(order)} className="action-btn edit-btn">Upload Report</button>
                      )}
                      {order.status === 'completed' && order.reportUrl && (
                        <a href={order.reportUrl} target="_blank" rel="noopener noreferrer" className="action-btn view-btn">View Report</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View Order Modal */}
      {showViewModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Order Details</h2>
              <button className="close-button" onClick={() => setShowViewModal(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="doctor-detail-grid">
                <div className="detail-item">
                  <label>Order Number:</label>
                  <span>{selectedOrder.orderNumber || selectedOrder._id.slice(-8)}</span>
                </div>
                <div className="detail-item">
                  <label>Patient:</label>
                  <span>{selectedOrder.patientId?.name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Test:</label>
                  <span>{selectedOrder.testId?.name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Price:</label>
                  <span>{selectedOrder.totalAmount || selectedOrder.testId?.price || 0} tk</span>
                </div>
                <div className="detail-item">
                  <label>Status:</label>
                  <span className={`status-badge ${selectedOrder.status}`}>{selectedOrder.status}</span>
                </div>
                <div className="detail-item">
                  <label>Order Date:</label>
                  <span>{new Date(selectedOrder.orderDate || selectedOrder.createdAt).toLocaleString()}</span>
                </div>
                {selectedOrder.reportUrl && (
                  <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                    <label>Report:</label>
                    <a href={selectedOrder.reportUrl} target="_blank" rel="noopener noreferrer" className="report-link">View Report</a>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowViewModal(false)} className="close-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Report Modal */}
      {showUploadModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Report</h2>
              <button className="close-button" onClick={() => setShowUploadModal(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUploadReport}>
                <div className="form-group">
                  <label>Report URL *</label>
                  <input 
                    type="url" 
                    value={reportUrl} 
                    onChange={(e) => setReportUrl(e.target.value)} 
                    placeholder="https://example.com/report.pdf"
                    required 
                  />
                  <small>Enter the URL where the test report is hosted</small>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowUploadModal(false)}>Cancel</button>
                  <button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload Report'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Home Services Tab - Similar to Hospital Dashboard
const HomeServicesTab = ({ centerId, services, onRefresh, setSuccess, setError }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [formData, setFormData] = useState({
    serviceType: '',
    price: '',
    note: '',
    startTime: '09:00',
    endTime: '17:00',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const resetForm = () => {
    setFormData({
      serviceType: '',
      price: '',
      note: '',
      startTime: '09:00',
      endTime: '17:00',
      isActive: true,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post(`/diagnostic-centers/${centerId}/home-services`, {
        ...formData,
        availableTime: { startTime: formData.startTime, endTime: formData.endTime },
        price: parseFloat(formData.price),
      });
      if (response.data.success) {
        setSuccess('Home service added successfully!');
        setShowAddForm(false);
        resetForm();
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add service.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (service) => {
    setSelectedService(service);
    setFormData({
      serviceType: service.serviceType || '',
      price: service.price || '',
      note: service.note || '',
      startTime: service.availableTime?.startTime || '09:00',
      endTime: service.availableTime?.endTime || '17:00',
      isActive: service.isActive !== undefined ? service.isActive : true,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.put(`/diagnostic-centers/${centerId}/home-services/${selectedService._id}`, {
        serviceType: formData.serviceType,
        price: parseFloat(formData.price),
        note: formData.note,
        availableTime: { startTime: formData.startTime, endTime: formData.endTime },
        isActive: formData.isActive,
      });
      if (response.data.success) {
        setSuccess('Home service updated successfully!');
        setShowEditModal(false);
        setSelectedService(null);
        resetForm();
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update service.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (service) => {
    setServiceToDelete(service);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!serviceToDelete) return;
    
    setDeleting(true);
    try {
      const response = await api.delete(`/diagnostic-centers/${centerId}/home-services/${serviceToDelete._id}`);
      if (response.data.success) {
        setSuccess('Home service deleted successfully!');
        setShowDeleteModal(false);
        setServiceToDelete(null);
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete service.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setServiceToDelete(null);
  };

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Home Services</h2>
        <button onClick={() => setShowAddForm(!showAddForm)} className="add-button">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Service
        </button>
      </div>

      {showAddForm && (
        <div className="add-form-card">
          <div className="form-header">
            <h3>Add Home Service</h3>
            <button type="button" className="close-button" onClick={() => { setShowAddForm(false); resetForm(); }}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Service Type *</label>
                <input type="text" placeholder="Service Type" value={formData.serviceType} onChange={(e) => setFormData({...formData, serviceType: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Price (tk) *</label>
                <input type="number" step="0.01" placeholder="Price" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} required min="0" />
              </div>
              <div className="form-group">
                <label>Note</label>
                <input type="text" placeholder="Note (optional)" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Start Time *</label>
                <input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>End Time *</label>
                <input type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} required />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => { setShowAddForm(false); resetForm(); }}>Cancel</button>
              <button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Service'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && serviceToDelete && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="close-button" onClick={handleDeleteCancel}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-confirmation-content">
                <div className="delete-confirmation-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3>Are you sure you want to delete this service?</h3>
                <p>
                  This will permanently delete <strong>{serviceToDelete.serviceType}</strong>. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={handleDeleteCancel} className="close-btn" disabled={deleting}>
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} className="delete-btn" disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Service'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {showEditModal && selectedService && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Home Service</h2>
              <button className="close-button" onClick={() => setShowEditModal(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpdate}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Service Type *</label>
                    <input type="text" value={formData.serviceType} onChange={(e) => setFormData({...formData, serviceType: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Price (tk) *</label>
                    <input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} required min="0" />
                  </div>
                  <div className="form-group">
                    <label>Note</label>
                    <input type="text" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>End Time *</label>
                    <input type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={formData.isActive ? 'active' : 'inactive'} onChange={(e) => setFormData({...formData, isActive: e.target.value === 'active'})}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" disabled={submitting}>{submitting ? 'Updating...' : 'Update Service'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="services-grid">
        {services.length === 0 ? (
          <div className="empty-state">
            <p>No home services found. Add your first service to get started.</p>
          </div>
        ) : (
          services.map((service) => (
            <div key={service._id} className="service-card">
              <div className="service-card-header">
                <h3>{service.serviceType}</h3>
                <div className="service-actions">
                  <button
                    onClick={() => { setSelectedService(service); setShowDetailsModal(true); }}
                    className="action-btn"
                    title="View Details"
                  >
                    View
                  </button>
                  <button
                    onClick={() => { setSelectedService(service); setShowSerialModal(true); }}
                    className="action-btn"
                    title="Serial Settings"
                  >
                    Serial
                  </button>
                  <button onClick={() => handleEdit(service)} className="action-btn edit-btn" title="Edit">
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: '14px', height: '14px' }}>
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDeleteClick(service)} className="action-btn delete-btn" title="Delete">
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: '14px', height: '14px' }}>
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="service-price">{service.price} tk</p>
              {service.note && <p className="service-note">{service.note}</p>}
              <div className="service-meta">
                <span>{service.availableTime?.startTime} - {service.availableTime?.endTime}</span>
                <span className={`status-badge ${service.isActive ? 'active' : 'inactive'}`}>
                  {service.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {showDetailsModal && selectedService && (
        <HomeServiceDetailsModal
          serviceId={selectedService._id}
          mode="diagnostic"
          providerId={centerId}
          initialService={selectedService}
          onClose={() => { setShowDetailsModal(false); setSelectedService(null); }}
        />
      )}

      {showSerialModal && selectedService && (
        <DiagnosticHomeServiceSerialSettingsModal
          centerId={centerId}
          service={selectedService}
          onClose={() => { setShowSerialModal(false); setSelectedService(null); }}
          setSuccess={setSuccess}
          setError={setError}
        />
      )}
    </div>
  );
};

const DiagnosticHomeServiceSerialSettingsModal = ({ centerId, service, onClose, setSuccess, setError }) => {
  const [formData, setFormData] = useState({
    totalSerialsPerDay: 20,
    startTime: service.availableTime?.startTime || '09:00',
    endTime: service.availableTime?.endTime || '17:00',
    servicePrice: service.price || 0,
    isActive: true
  });
  const [statsDate, setStatsDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [service._id]);

  useEffect(() => {
    if (formData.totalSerialsPerDay) loadStats();
  }, [statsDate, service._id]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/diagnostic-centers/${centerId}/home-services/${service._id}/serial-settings`);
      if (response.data.success) {
        const s = response.data.data.serialSettings;
        setFormData({
          totalSerialsPerDay: s.totalSerialsPerDay,
          startTime: s.serialTimeRange?.startTime || '09:00',
          endTime: s.serialTimeRange?.endTime || '17:00',
          servicePrice: s.servicePrice,
          isActive: s.isActive
        });
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'Failed to load serial settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get(
        `/diagnostic-centers/${centerId}/home-services/${service._id}/serial-stats?date=${statsDate}`
      );
      if (response.data.success) setStats(response.data.data);
    } catch (err) {
      if (err.response?.status !== 404) console.error(err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post(`/diagnostic-centers/${centerId}/home-services/${service._id}/serial-settings`, {
        totalSerialsPerDay: parseInt(formData.totalSerialsPerDay, 10),
        serialTimeRange: { startTime: formData.startTime, endTime: formData.endTime },
        servicePrice: parseFloat(formData.servicePrice),
        isActive: formData.isActive
      });
      if (response.data.success) {
        setSuccess('Serial settings saved successfully!');
        loadStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save serial settings');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h2>Serial Settings — {service.serviceType}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <p>Loading settings...</p>
          ) : (
            <>
              <form onSubmit={handleSave}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Total Serials Per Day *</label>
                    <input
                      type="number"
                      min="2"
                      step="2"
                      value={formData.totalSerialsPerDay}
                      onChange={(e) => setFormData({ ...formData, totalSerialsPerDay: e.target.value })}
                      required
                    />
                    <small>Only even serials (2, 4, 6…) are bookable online</small>
                  </div>
                  <div className="form-group">
                    <label>Service Price (tk) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.servicePrice}
                      onChange={(e) => setFormData({ ...formData, servicePrice: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Time *</label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      value={formData.isActive ? 'active' : 'inactive'}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={onClose}>Cancel</button>
                  <button type="submit" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>

              <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <h3>Serial Stats</h3>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={statsDate} onChange={(e) => setStatsDate(e.target.value)} />
                </div>
                {stats ? (
                  <div className="serial-stats-summary">
                    <p>Booked: {stats.statistics?.bookedEvenSerials ?? 0} / Available online: {stats.statistics?.availableEvenSerials ?? 0}</p>
                    {stats.statistics?.bookings?.length > 0 && (
                      <ul>
                        {stats.statistics.bookings.map((b) => (
                          <li key={b.bookingNumber}>
                            Serial #{b.serialNumber} — {b.patient?.name} at {b.time} ({b.status})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p>Save settings first to view stats.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const DiagnosticHomeServiceSerialBookingsTab = ({ centerId, bookings, onRefresh, setSuccess, setError }) => {
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [updateBooking, setUpdateBooking] = useState(null);

  const handleStatusUpdate = async (bookingId, status) => {
    try {
      const response = await api.put(
        `/diagnostic-centers/${centerId}/home-service-serial-bookings/${bookingId}/status`,
        { status }
      );
      if (response.data.success) {
        setSuccess(`Booking marked as ${status}`);
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
      setTimeout(() => setError(''), 5000);
    }
  };

  const filtered = bookings.filter((b) => {
    if (filterStatus && b.status !== filterStatus) return false;
    if (filterDate) {
      const d = new Date(b.appointmentDate).toISOString().split('T')[0];
      if (d !== filterDate) return false;
    }
    return true;
  });

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Home Service Serial Bookings</h2>
        <button onClick={onRefresh} className="add-button">Refresh</button>
      </div>
      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <div className="form-group">
          <label>Filter by date</label>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Filter by status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <div className="requests-list">
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No serial bookings found.</p></div>
        ) : (
          filtered.map((booking) => (
            <div key={booking._id} className="request-card">
              <div className="request-header">
                <h3>{booking.bookingNumber} — Serial #{booking.serialNumber}</h3>
                <span className={`status-badge ${booking.status}`}>{booking.status}</span>
              </div>
              <div className="request-details">
                <p><strong>Service:</strong> {booking.serviceType || booking.homeServiceId?.serviceType}</p>
                <p><strong>Patient:</strong> {booking.patientName} ({booking.patientPhone})</p>
                <p><strong>Date:</strong> {new Date(booking.appointmentDate).toLocaleDateString()}</p>
                <p><strong>Time:</strong> {booking.timeSlot?.startTime} - {booking.timeSlot?.endTime}</p>
                <p><strong>Price:</strong> {booking.servicePrice} tk</p>
                {booking.homeAddress && (
                  <p><strong>Address:</strong> {booking.homeAddress.street}, {booking.homeAddress.city}</p>
                )}
              </div>
              <div className="request-actions">
                <button
                  type="button"
                  onClick={() => setUpdateBooking(booking)}
                  className="action-btn"
                  style={{ marginRight: '0.5rem' }}
                >
                  Update Serial
                </button>
                {booking.status === 'pending' && (
                  <>
                    <button onClick={() => handleStatusUpdate(booking._id, 'confirmed')} className="accept-btn">Confirm</button>
                    <button onClick={() => handleStatusUpdate(booking._id, 'cancelled')} className="reject-btn">Cancel</button>
                  </>
                )}
                {booking.status === 'confirmed' && (
                  <button onClick={() => handleStatusUpdate(booking._id, 'completed')} className="accept-btn">Mark Completed</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {updateBooking && (
        <HomeServiceSerialUpdateModal
          booking={updateBooking}
          mode="diagnostic"
          providerId={centerId}
          onClose={() => setUpdateBooking(null)}
          onSuccess={() => {
            setSuccess('Serial booking updated successfully');
            onRefresh();
            setTimeout(() => setSuccess(''), 3000);
          }}
          setError={setError}
        />
      )}
    </div>
  );
};

// Requests Tab Component
const RequestsTab = ({ centerId, requests, onRefresh, setSuccess, setError }) => {
  const handleAccept = async (requestId) => {
    try {
      const response = await api.put(`/diagnostic-centers/${centerId}/home-service-requests/${requestId}/accept`);
      if (response.data.success) {
        setSuccess('Request accepted successfully!');
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept request.');
    }
  };

  const handleReject = async (requestId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      const response = await api.put(`/diagnostic-centers/${centerId}/home-service-requests/${requestId}/reject`, { rejectionReason: reason });
      if (response.data.success) {
        setSuccess('Request rejected.');
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject request.');
    }
  };

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Home Service Requests</h2>
      </div>
      <div className="requests-list">
        {requests.length === 0 ? (
          <div className="empty-state">
            <p>No service requests found.</p>
          </div>
        ) : (
          requests.map((request) => (
            <div key={request._id} className="request-card">
              <div className="request-header">
                <h3>Request #{request.requestNumber || request._id.slice(-8)}</h3>
                <span className={`status-badge ${request.status}`}>{request.status}</span>
              </div>
              <div className="request-details">
                <p><strong>Patient:</strong> {request.patientId?.name || 'N/A'}</p>
                <p><strong>Service:</strong> {request.homeServiceId?.serviceType || 'N/A'}</p>
                <p><strong>Price:</strong> {request.homeServiceId?.price || 0} tk</p>
                <p><strong>Date:</strong> {new Date(request.requestedDate || request.createdAt).toLocaleDateString()}</p>
              </div>
              {request.status === 'pending' && (
                <div className="request-actions">
                  <button onClick={() => handleAccept(request._id)} className="accept-btn">Accept</button>
                  <button onClick={() => handleReject(request._id)} className="reject-btn">Reject</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Doctors Tab Component with Add Doctor and Serial Management
const DoctorsTab = ({ centerId, doctors, onRefresh, setSuccess, setError }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [serialSettings, setSerialSettings] = useState(null);
  const [serialStats, setSerialStats] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState(null);
  const [loadingView, setLoadingView] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '+88',
    password: '',
    medicalLicenseNumber: '',
    specialization: '',
    qualifications: '',
    experienceYears: '',
    licenseDocumentUrl: '',
    profilePhotoUrl: '',
  });
  const [linkFormData, setLinkFormData] = useState({
    doctorId: '',
    designation: '',
    department: '',
  });
  const [serialFormData, setSerialFormData] = useState({
    totalSerialsPerDay: 20,
    startTime: '09:00',
    endTime: '17:00',
    appointmentPrice: '',
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingSerial, setLoadingSerial] = useState(false);

  const formatPhoneNumber = (value) => {
    if (!value || value.trim() === '') {
      return '+88';
    }
    let cleaned = value.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+88')) {
      if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
      }
      if (cleaned.startsWith('88')) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = '+88' + cleaned;
      }
    }
    if (cleaned.length < 3 || !cleaned.startsWith('+88')) {
      return '+88';
    }
    return cleaned;
  };

  const handlePhoneChange = (value) => {
    const formatted = formatPhoneNumber(value);
    setFormData({...formData, phone: formatted});
  };

  const resetForm = () => {
    setFormData({
      name: '', email: '', phone: '+88', password: '',
      medicalLicenseNumber: '', specialization: '', qualifications: '',
      experienceYears: '', licenseDocumentUrl: '', profilePhotoUrl: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const submitData = {
        ...formData,
        specialization: formData.specialization.split(',').map(s => s.trim()).filter(s => s),
        experienceYears: parseInt(formData.experienceYears),
      };
      
      const response = await api.post(`/diagnostic-centers/${centerId}/doctors`, submitData);
      if (response.data.success) {
        setSuccess('Doctor added successfully!');
        setShowAddForm(false);
        resetForm();
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add doctor.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post(`/diagnostic-centers/${centerId}/doctors/link`, linkFormData);
      if (response.data.success) {
        setSuccess('Doctor linked successfully!');
        setShowLinkForm(false);
        setLinkFormData({ doctorId: '', designation: '', department: '' });
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to link doctor.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManageSerial = async (doctor) => {
    setSelectedDoctor(doctor);
    setLoadingSerial(true);
    try {
      const response = await api.get(`/diagnostic-centers/${centerId}/doctors/${doctor._id}/serial-settings`);
      if (response.data.success && response.data.data.serialSettings) {
        const settings = response.data.data.serialSettings;
        setSerialFormData({
          totalSerialsPerDay: settings.totalSerialsPerDay || 20,
          startTime: settings.serialTimeRange?.startTime || '09:00',
          endTime: settings.serialTimeRange?.endTime || '17:00',
          appointmentPrice: settings.appointmentPrice || '',
          availableDays: settings.availableDays || [0, 1, 2, 3, 4, 5, 6],
          isActive: settings.isActive !== undefined ? settings.isActive : true,
        });
      }
      setShowSerialModal(true);
    } catch (err) {
      // If no settings exist, use defaults
      setShowSerialModal(true);
    } finally {
      setLoadingSerial(false);
    }
  };

  const handleSerialSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const submitData = {
        totalSerialsPerDay: parseInt(serialFormData.totalSerialsPerDay),
        serialTimeRange: {
          startTime: serialFormData.startTime,
          endTime: serialFormData.endTime,
        },
        appointmentPrice: parseFloat(serialFormData.appointmentPrice),
        availableDays: serialFormData.availableDays,
        isActive: serialFormData.isActive,
      };
      
      const response = await api.post(`/diagnostic-centers/${centerId}/doctors/${selectedDoctor._id}/serial-settings`, submitData);
      if (response.data.success) {
        setSuccess('Serial settings updated successfully!');
        setShowSerialModal(false);
        setSelectedDoctor(null);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update serial settings.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (doctor) => {
    setDoctorToDelete(doctor);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!doctorToDelete) return;
    
    setDeleting(true);
    try {
      const response = await api.delete(`/diagnostic-centers/${centerId}/doctors/${doctorToDelete._id}`);
      if (response.data.success) {
        setSuccess('Doctor removed successfully!');
        setShowDeleteModal(false);
        setDoctorToDelete(null);
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove doctor.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDoctorToDelete(null);
  };

  const handleView = async (doctor) => {
    setSelectedDoctor(doctor);
    setLoadingView(true);
    setShowViewModal(true);
    
    try {
      // Fetch serial settings
      try {
        const settingsResponse = await api.get(`/diagnostic-centers/${centerId}/doctors/${doctor._id}/serial-settings`);
        if (settingsResponse.data.success && settingsResponse.data.data.serialSettings) {
          setSerialSettings(settingsResponse.data.data.serialSettings);
        }
      } catch (err) {
        // Serial settings might not exist yet
        setSerialSettings(null);
      }

      // Fetch serial statistics
      try {
        const statsResponse = await api.get(`/diagnostic-centers/${centerId}/doctors/${doctor._id}/serial-stats`);
        if (statsResponse.data.success) {
          setSerialStats(statsResponse.data.data);
        }
      } catch (err) {
        // Stats might not be available
        setSerialStats(null);
      }
    } catch (err) {
      console.error('Error fetching doctor details:', err);
    } finally {
      setLoadingView(false);
    }
  };

  const toggleDay = (day) => {
    setSerialFormData(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter(d => d !== day)
        : [...prev.availableDays, day]
    }));
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Doctors Management</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => setShowLinkForm(!showLinkForm)} className="add-button" style={{ background: '#10b981' }}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Link Doctor
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="add-button">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Doctor
          </button>
        </div>
      </div>

      {/* Add Doctor Form */}
      {showAddForm && (
        <div className="add-form-card">
          <div className="form-header">
            <h3>Add New Doctor</h3>
            <button type="button" className="close-button" onClick={() => { setShowAddForm(false); resetForm(); }}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Phone *</label>
                <input 
                  type="tel" 
                  value={formData.phone} 
                  onChange={(e) => handlePhoneChange(e.target.value)} 
                  onBlur={(e) => handlePhoneChange(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required minLength={8} />
              </div>
              <div className="form-group">
                <label>Medical License Number *</label>
                <input type="text" value={formData.medicalLicenseNumber} onChange={(e) => setFormData({...formData, medicalLicenseNumber: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Specialization * (comma separated)</label>
                <input type="text" value={formData.specialization} onChange={(e) => setFormData({...formData, specialization: e.target.value})} placeholder="Cardiology, Neurology" required />
              </div>
              <div className="form-group">
                <label>Experience Years *</label>
                <input type="number" value={formData.experienceYears} onChange={(e) => setFormData({...formData, experienceYears: e.target.value})} required min="0" />
              </div>
              <div className="form-group">
                <label>Qualifications</label>
                <input type="text" value={formData.qualifications} onChange={(e) => setFormData({...formData, qualifications: e.target.value})} placeholder="MBBS, MD, etc." />
              </div>
              <div className="form-group">
                <label>License Document URL</label>
                <input type="url" value={formData.licenseDocumentUrl} onChange={(e) => setFormData({...formData, licenseDocumentUrl: e.target.value})} placeholder="https://example.com/license.pdf" />
              </div>
              <div className="form-group">
                <label>Profile Photo URL</label>
                <input type="url" value={formData.profilePhotoUrl} onChange={(e) => setFormData({...formData, profilePhotoUrl: e.target.value})} placeholder="https://example.com/photo.jpg" />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => { setShowAddForm(false); resetForm(); }}>Cancel</button>
              <button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Doctor'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Link Doctor Form */}
      {showLinkForm && (
        <div className="add-form-card">
          <div className="form-header">
            <h3>Link Existing Doctor</h3>
            <button type="button" className="close-button" onClick={() => { setShowLinkForm(false); setLinkFormData({ doctorId: '', designation: '', department: '' }); }}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleLinkSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Doctor ID *</label>
                <input type="text" value={linkFormData.doctorId} onChange={(e) => setLinkFormData({...linkFormData, doctorId: e.target.value})} placeholder="Enter doctor ID" required />
              </div>
              <div className="form-group">
                <label>Designation</label>
                <input type="text" value={linkFormData.designation} onChange={(e) => setLinkFormData({...linkFormData, designation: e.target.value})} placeholder="e.g., Senior Consultant" />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input type="text" value={linkFormData.department} onChange={(e) => setLinkFormData({...linkFormData, department: e.target.value})} placeholder="e.g., Cardiology" />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => { setShowLinkForm(false); setLinkFormData({ doctorId: '', designation: '', department: '' }); }}>Cancel</button>
              <button type="submit" disabled={submitting}>{submitting ? 'Linking...' : 'Link Doctor'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Serial Settings Modal */}
      {showSerialModal && selectedDoctor && (
        <div className="modal-overlay" onClick={() => setShowSerialModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Serial Settings - {selectedDoctor.name}</h2>
              <button className="close-button" onClick={() => setShowSerialModal(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSerialSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Total Serials Per Day *</label>
                    <input type="number" value={serialFormData.totalSerialsPerDay} onChange={(e) => setSerialFormData({...serialFormData, totalSerialsPerDay: e.target.value})} required min="1" />
                  </div>
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input type="time" value={serialFormData.startTime} onChange={(e) => setSerialFormData({...serialFormData, startTime: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>End Time *</label>
                    <input type="time" value={serialFormData.endTime} onChange={(e) => setSerialFormData({...serialFormData, endTime: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Appointment Price (tk) *</label>
                    <input type="number" step="0.01" value={serialFormData.appointmentPrice} onChange={(e) => setSerialFormData({...serialFormData, appointmentPrice: e.target.value})} required min="0" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Available Days *</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {dayNames.map((day, index) => (
                        <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={serialFormData.availableDays.includes(index)}
                            onChange={() => toggleDay(index)}
                          />
                          <span>{day}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={serialFormData.isActive ? 'active' : 'inactive'} onChange={(e) => setSerialFormData({...serialFormData, isActive: e.target.value === 'active'})}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowSerialModal(false)}>Cancel</button>
                  <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Settings'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Doctor Details Modal */}
      {showViewModal && selectedDoctor && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>Doctor Details - {selectedDoctor.name}</h2>
              <button className="close-button" onClick={() => setShowViewModal(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              {loadingView ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="spinner" style={{ margin: '0 auto' }}></div>
                  <p>Loading doctor details...</p>
                </div>
              ) : (
                <>
                  {/* Doctor Information Section */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e5e7eb' }}>
                      Doctor Information
                    </h3>
                    <div className="doctor-detail-grid">
                      <div className="detail-item">
                        <label>Name:</label>
                        <span>{selectedDoctor.name}</span>
                      </div>
                      <div className="detail-item">
                        <label>Email:</label>
                        <span>{selectedDoctor.email}</span>
                      </div>
                      <div className="detail-item">
                        <label>Phone:</label>
                        <span>{selectedDoctor.phone}</span>
                      </div>
                      <div className="detail-item">
                        <label>Medical License:</label>
                        <span>{selectedDoctor.medicalLicenseNumber || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Specialization:</label>
                        <span>{Array.isArray(selectedDoctor.specialization) ? selectedDoctor.specialization.join(', ') : selectedDoctor.specialization || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Experience:</label>
                        <span>{selectedDoctor.experienceYears ? `${selectedDoctor.experienceYears} years` : 'N/A'}</span>
                      </div>
                      {selectedDoctor.qualifications && (
                        <div className="detail-item">
                          <label>Qualifications:</label>
                          <span>{selectedDoctor.qualifications}</span>
                        </div>
                      )}
                      <div className="detail-item">
                        <label>Status:</label>
                        <span className={`status-badge ${selectedDoctor.status}`}>{selectedDoctor.status}</span>
                      </div>
                      {selectedDoctor.licenseDocumentUrl && (
                        <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                          <label>License Document:</label>
                          <a href={selectedDoctor.licenseDocumentUrl} target="_blank" rel="noopener noreferrer" className="report-link">
                            View Document
                          </a>
                        </div>
                      )}
                      {selectedDoctor.profilePhotoUrl && (
                        <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                          <label>Profile Photo:</label>
                          <a href={selectedDoctor.profilePhotoUrl} target="_blank" rel="noopener noreferrer" className="report-link">
                            View Photo
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Serial Settings Section */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e5e7eb' }}>
                      Serial Settings
                    </h3>
                    {serialSettings ? (
                      <div className="doctor-detail-grid">
                        <div className="detail-item">
                          <label>Total Serials Per Day:</label>
                          <span>{serialSettings.totalSerialsPerDay || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Time Range:</label>
                          <span>{serialSettings.serialTimeRange?.startTime || 'N/A'} - {serialSettings.serialTimeRange?.endTime || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Appointment Price:</label>
                          <span>{serialSettings.appointmentPrice ? `${serialSettings.appointmentPrice} tk` : 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Status:</label>
                          <span className={`status-badge ${serialSettings.isActive ? 'active' : 'inactive'}`}>
                            {serialSettings.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {serialSettings.availableDays && serialSettings.availableDays.length > 0 && (
                          <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                            <label>Available Days:</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                              {dayNames.map((day, index) => (
                                serialSettings.availableDays.includes(index) && (
                                  <span key={index} style={{ 
                                    padding: '0.25rem 0.75rem', 
                                    background: '#dbeafe', 
                                    color: '#1e40af', 
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    fontWeight: '500'
                                  }}>
                                    {day}
                                  </span>
                                )
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ color: '#6b7280', margin: 0 }}>No serial settings configured yet. Click "Manage Serial" to set up.</p>
                      </div>
                    )}
                  </div>

                  {/* Serial Statistics Section */}
                  {serialStats && (
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e5e7eb' }}>
                        Serial Statistics
                      </h3>
                      <div className="doctor-detail-grid">
                        <div className="detail-item">
                          <label>Date:</label>
                          <span>{serialStats.statistics?.date || 'Today'}</span>
                        </div>
                        <div className="detail-item">
                          <label>Total Booked:</label>
                          <span>{serialStats.statistics?.totalBooked || 0}</span>
                        </div>
                        <div className="detail-item">
                          <label>Booked Even Serials:</label>
                          <span>{serialStats.statistics?.bookedEvenSerials || 0}</span>
                        </div>
                        <div className="detail-item">
                          <label>Available Even Serials:</label>
                          <span>{serialStats.statistics?.availableEvenSerials || 0}</span>
                        </div>
                        {serialStats.statistics?.bookedPatients && serialStats.statistics.bookedPatients.length > 0 && (
                          <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                            <label>Booked Patients:</label>
                            <div style={{ marginTop: '0.5rem' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                  <tr style={{ background: '#f3f4f6' }}>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #e5e7eb' }}>Serial #</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #e5e7eb' }}>Patient</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #e5e7eb' }}>Time</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {serialStats.statistics.bookedPatients.map((booking, idx) => (
                                    <tr key={idx}>
                                      <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb' }}>{booking.serialNumber || '-'}</td>
                                      <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb' }}>{booking.patient?.name || 'N/A'}</td>
                                      <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb' }}>{booking.time || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowViewModal(false); handleManageSerial(selectedDoctor); }} className="edit-btn">
                Manage Serial
              </button>
              <button onClick={() => setShowViewModal(false)} className="close-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && doctorToDelete && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="close-button" onClick={handleDeleteCancel}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-confirmation-content">
                <div className="delete-confirmation-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3>Are you sure you want to remove this doctor?</h3>
                <p>
                  This will remove <strong>{doctorToDelete.name}</strong> from the diagnostic center. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={handleDeleteCancel} className="close-btn" disabled={deleting}>
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} className="delete-btn" disabled={deleting}>
                {deleting ? 'Deleting...' : 'Remove Doctor'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="data-table">
        {doctors.length === 0 ? (
          <div className="empty-state">
            <p>No doctors found. Add your first doctor to get started.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Specialization</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doctor) => (
                <tr key={doctor._id}>
                  <td>{doctor.name}</td>
                  <td>{doctor.email}</td>
                  <td>{Array.isArray(doctor.specialization) ? doctor.specialization.join(', ') : doctor.specialization}</td>
                  <td><span className={`status-badge ${doctor.status}`}>{doctor.status}</span></td>
                  <td>
                    <div className="action-buttons">
                      <button onClick={() => handleView(doctor)} className="action-btn view-btn">View</button>
                      <button onClick={() => handleManageSerial(doctor)} className="action-btn edit-btn">Manage Serial</button>
                      <button onClick={() => handleDeleteClick(doctor)} className="action-btn delete-btn" disabled={deleting}>
                        {deleting ? '...' : 'Remove'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const TabIcon = ({ type }) => {
  if (type === 'staff') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5 5 0 00-5-5H9a5 5 0 00-5 5v1h12z" />
      </svg>
    );
  }
  if (type === 'doctors') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
    );
  }
  if (type === 'home') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    );
  }
  if (type === 'requests') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    );
  }
  if (type === 'tests') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  }
  if (type === 'orders') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  );
};

const DiagnosticCenterStaffTab = ({
  centerId,
  staff,
  membership,
  canManage,
  onRefresh,
  setSuccess,
  setError
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'receptionist',
    jobTitle: '',
    permissions: []
  });

  const permissionGroups = useMemo(() => {
    const groups = {};
    DC_PERMISSIONS.forEach((p) => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });
    return groups;
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'receptionist',
      jobTitle: '',
      permissions: []
    });
    setEditing(null);
    setShowForm(false);
  };

  const openAddForm = () => {
    setEditing(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'receptionist',
      jobTitle: '',
      permissions: []
    });
    setShowForm(true);
  };

  const openEdit = (member) => {
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone,
      password: '',
      role: member.role,
      jobTitle: member.jobTitle || '',
      permissions: member.permissions || []
    });
    setShowForm(true);
  };

  useEffect(() => {
    if (!showForm) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') resetForm();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showForm]);

  const togglePermission = (key) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = editing
        ? {
            role: form.role,
            jobTitle: form.jobTitle,
            permissions: form.role === 'custom' ? form.permissions : undefined
          }
        : {
            name: form.name,
            email: form.email,
            phone: form.phone,
            password: form.password,
            role: form.role,
            jobTitle: form.jobTitle,
            permissions: form.role === 'custom' ? form.permissions : undefined
          };

      const response = editing
        ? await api.put(`/diagnostic-centers/${centerId}/staff/${editing._id}`, payload)
        : await api.post(`/diagnostic-centers/${centerId}/staff`, payload);

      if (response.data.success) {
        setSuccess(editing ? 'Staff member updated' : 'Staff member added');
        resetForm();
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save staff member');
      setTimeout(() => setError(''), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (member) => {
    try {
      const response = await api.put(`/diagnostic-centers/${centerId}/staff/${member._id}`, {
        isActive: !member.isActive
      });
      if (response.data.success) {
        setSuccess(member.isActive ? 'Staff member deactivated' : 'Staff member activated');
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleRemove = async (member) => {
    if (!window.confirm(`Remove ${member.name} from the diagnostic center team?`)) return;
    try {
      const response = await api.delete(`/diagnostic-centers/${centerId}/staff/${member._id}`);
      if (response.data.success) {
        setSuccess('Staff member removed');
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove staff');
      setTimeout(() => setError(''), 4000);
    }
  };

  return (
    <div className="staff-tab">
      <div className="home-services-header">
        <div>
          <h2>Team & Access Control</h2>
          <p className="staff-tab-desc">
            Add diagnostic center staff and assign roles with specific permissions.
            {membership?.roleLabel && ` Your role: ${membership.roleLabel}.`}
          </p>
        </div>
        {canManage && (
          <button type="button" className="btn-primary" onClick={openAddForm}>
            + Add Team Member
          </button>
        )}
      </div>

      <div className="staff-table-wrap">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Job title</th>
              <th>Status</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="empty-cell">No team members yet.</td>
              </tr>
            ) : (
              staff.map((member) => (
                <tr key={member._id} className={!member.isActive ? 'inactive-row' : ''}>
                  <td>
                    {member.name}
                    {member.isOwner && <span className="owner-tag">Owner</span>}
                  </td>
                  <td>{member.email}</td>
                  <td>{member.roleLabel}</td>
                  <td>{member.jobTitle || '—'}</td>
                  <td>
                    <span className={`status-pill ${member.isActive ? 'active' : 'inactive'}`}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="staff-actions-cell">
                      {!member.isOwner && (
                        <div className="action-buttons">
                          <button type="button" className="action-btn edit-btn" onClick={() => openEdit(member)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`action-btn ${member.isActive ? 'edit-btn' : 'view-btn'}`}
                            onClick={() => handleToggleActive(member)}
                          >
                            {member.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" className="action-btn delete-btn" onClick={() => handleRemove(member)}>
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && canManage && createPortal(
        <div className="modal-overlay staff-modal-overlay" onClick={resetForm} role="presentation">
          <div
            className="modal-content staff-modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dc-staff-modal-title"
          >
            <div className="modal-header">
              <h2 id="dc-staff-modal-title">{editing ? 'Edit Team Member' : 'Add Team Member'}</h2>
              <button type="button" className="close-button" onClick={resetForm} aria-label="Close">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {editing ? (
                  <p className="staff-edit-user">
                    Editing <strong>{editing.name}</strong> ({editing.email})
                  </p>
                ) : (
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Full name *</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="form-group">
                      <label>Job title</label>
                      <input
                        value={form.jobTitle}
                        onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                        placeholder="e.g. Lab technician"
                      />
                    </div>
                    <div className="form-group">
                      <label>Email *</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Phone *</label>
                      <input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Password *</label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        minLength={8}
                        required
                      />
                      <small>Minimum 8 characters</small>
                    </div>
                  </div>
                )}
                {editing && (
                  <div className="form-group">
                    <label>Job title</label>
                    <input
                      value={form.jobTitle}
                      onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                      placeholder="e.g. Lab technician"
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Role *</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                {form.role === 'custom' && (
                  <div className="permissions-grid">
                    <p className="permissions-hint">Select individual permissions:</p>
                    {Object.entries(permissionGroups).map(([group, perms]) => (
                      <div key={group} className="permission-group">
                        <strong>{group}</strong>
                        <div className="permission-checkboxes">
                          {perms.map((p) => (
                            <label key={p.key} className="permission-check">
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(p.key)}
                                onChange={() => togglePermission(p.key)}
                              />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={resetForm}>Cancel</button>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editing ? 'Update' : 'Add member'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DiagnosticCenterDashboard;

