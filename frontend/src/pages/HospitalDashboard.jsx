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
  HOSPITAL_PERMISSIONS
} from '../utils/hospitalPermissions';
import './HospitalDashboard.css';

const DASHBOARD_TABS = [
  { key: 'overview', label: 'Overview', icon: 'overview' },
  { key: 'doctors', label: 'Doctors', icon: 'doctors' },
  { key: 'home-services', label: 'Home Services', icon: 'home' },
  { key: 'requests', label: 'Service Requests', icon: 'requests' },
  { key: 'home-serial-bookings', label: 'Home Serials', icon: 'serials' },
  { key: 'appointments', label: 'Appointments', icon: 'appointments' },
  { key: 'tests', label: 'Tests', icon: 'tests' },
  { key: 'test-serial-bookings', label: 'Test Serials', icon: 'serials' },
  { key: 'staff', label: 'Team & Access', icon: 'staff' }
];

const HospitalDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [hospitalId, setHospitalId] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [homeServices, setHomeServices] = useState([]);
  const [homeServiceRequests, setHomeServiceRequests] = useState([]);
  const [homeServiceSerialBookings, setHomeServiceSerialBookings] = useState([]);
  const [tests, setTests] = useState([]);
  const [testSerialBookings, setTestSerialBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [membership, setMembership] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);

  useEffect(() => {
    if (!user || user.role !== 'hospital_admin') {
      navigate('/hospital/login');
      return;
    }
    fetchHospitalId();
  }, [user]);

  useEffect(() => {
    if (hospitalId) {
      fetchHospitalAccess();
      fetchDashboardData();
      if (activeTab === 'doctors') fetchDoctors();
      if (activeTab === 'home-services') fetchHomeServices();
      if (activeTab === 'requests') fetchHomeServiceRequests();
      if (activeTab === 'home-serial-bookings') fetchHomeServiceSerialBookings();
      if (activeTab === 'tests') fetchTests();
      if (activeTab === 'test-serial-bookings') fetchTestSerialBookings();
      if (activeTab === 'staff') fetchStaffMembers();
    }
  }, [hospitalId, activeTab]);

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

  const fetchHospitalId = async () => {
    try {
      const userResponse = await api.get(`/users/${user.id}`);
      if (userResponse.data.success && userResponse.data.data.roleData) {
        setHospitalId(userResponse.data.data.roleData._id);
        const access = userResponse.data.data.hospitalAccess;
        if (access?.permissions) {
          setPermissions(access.permissions);
          setMembership(access);
        }
      }
    } catch (err) {
      console.error('Error fetching hospital ID:', err);
      setError('Failed to load hospital data.');
    }
  };

  const fetchHospitalAccess = async () => {
    try {
      const response = await api.get(`/hospitals/${hospitalId}/access`);
      if (response.data.success) {
        setPermissions(response.data.data.permissions || []);
        setMembership(response.data.data.membership);
      }
    } catch (err) {
      console.error('Error fetching hospital access:', err);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const response = await api.get(`/hospitals/${hospitalId}/staff`);
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
    try {
      setLoading(true);
      const response = await api.get(`/hospitals/${hospitalId}/dashboard`);
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      if (err.response?.status === 403) {
        setError('Hospital must be approved to view dashboard.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await api.get(`/hospitals/${hospitalId}/doctors`);
      if (response.data.success) {
        setDoctors(response.data.data.doctors || []);
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const fetchHomeServices = async () => {
    try {
      const response = await api.get(`/hospitals/${hospitalId}/home-services`);
      if (response.data.success) {
        setHomeServices(response.data.data.homeServices || []);
      }
    } catch (err) {
      console.error('Error fetching home services:', err);
    }
  };

  const fetchHomeServiceRequests = async () => {
    try {
      const response = await api.get(`/hospitals/${hospitalId}/home-service-requests`);
      if (response.data.success) {
        setHomeServiceRequests(response.data.data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  const fetchHomeServiceSerialBookings = async () => {
    try {
      const response = await api.get(`/hospitals/${hospitalId}/home-service-serial-bookings`);
      if (response.data.success) {
        setHomeServiceSerialBookings(response.data.data.bookings || []);
      }
    } catch (err) {
      console.error('Error fetching home service serial bookings:', err);
    }
  };

  const fetchAppointments = async (filters = {}, page = 1) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...filters
      });
      const response = await api.get(`/hospitals/${hospitalId}/appointments?${params}`);
      if (response.data.success) {
        return {
          appointments: response.data.data.appointments || [],
          pagination: response.data.data.pagination || { page: 1, limit: 20, total: 0, pages: 0 }
        };
      }
      return { appointments: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    } catch (err) {
      console.error('Error fetching appointments:', err);
      return { appointments: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    }
  };

  const fetchTests = async () => {
    try {
      const response = await api.get(`/hospitals/${hospitalId}/tests`);
      if (response.data.success) {
        setTests(response.data.data.tests || []);
      }
    } catch (err) {
      console.error('Error fetching tests:', err);
    }
  };

  const fetchTestSerialBookings = async () => {
    try {
      const response = await api.get(`/hospitals/${hospitalId}/test-serial-bookings`);
      if (response.data.success) {
        setTestSerialBookings(response.data.data.bookings || []);
      }
    } catch (err) {
      console.error('Error fetching test serial bookings:', err);
    }
  };

  if (loading && !dashboardData) {
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

  const { metrics, hospital } = dashboardData || {};

  return (
    <div className="dashboard-container">
      <Navbar />
      
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Hospital Dashboard</h1>
            <p className="dashboard-subtitle">
              Welcome back, {hospital?.name || 'Hospital Admin'}
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
              hospital={hospital}
              navigate={navigate}
            />
          )}
          {activeTab === 'doctors' && (
            <DoctorsTab 
              hospitalId={hospitalId}
              doctors={doctors}
              onRefresh={fetchDoctors}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'home-services' && (
            <HomeServicesTab 
              hospitalId={hospitalId}
              services={homeServices}
              onRefresh={fetchHomeServices}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'requests' && (
            <RequestsTab 
              hospitalId={hospitalId}
              requests={homeServiceRequests}
              onRefresh={fetchHomeServiceRequests}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'home-serial-bookings' && (
            <HomeServiceSerialBookingsTab
              hospitalId={hospitalId}
              bookings={homeServiceSerialBookings}
              onRefresh={fetchHomeServiceSerialBookings}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'appointments' && (
            <AppointmentsTab 
              hospitalId={hospitalId}
              fetchAppointments={fetchAppointments}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'tests' && (
            <TestsTab 
              hospitalId={hospitalId}
              tests={tests}
              onRefresh={fetchTests}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'test-serial-bookings' && (
            <TestSerialBookingsTab
              hospitalId={hospitalId}
              bookings={testSerialBookings}
              onRefresh={fetchTestSerialBookings}
              setSuccess={setSuccess}
              setError={setError}
            />
          )}
          {activeTab === 'staff' && (
            <HospitalStaffTab
              hospitalId={hospitalId}
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
const OverviewTab = ({ metrics, hospital, navigate }) => {
  return (
    <>
      <div className="dashboard-metrics">
        <div className="metric-card">
          <div className="metric-icon doctors">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{metrics?.totalDoctorsLinked || 0}</h3>
            <p className="metric-label">Total Doctors</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon appointments">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{metrics?.todayAppointments || 0}</h3>
            <p className="metric-label">Today's Appointments</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon upcoming">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{metrics?.upcomingAppointments || 0}</h3>
            <p className="metric-label">Upcoming Appointments</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2 className="section-title">Quick Actions</h2>
        <div className="action-cards">
          <div className="action-card" onClick={() => navigate('/hospital/profile')}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <h3>Hospital Profile</h3>
            <p>View and edit hospital information</p>
          </div>
        </div>
      </div>
    </>
  );
};

// Doctors Tab Component
const DoctorsTab = ({ hospitalId, doctors, onRefresh, setSuccess, setError }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showManageSerialModal, setShowManageSerialModal] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState(null);
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
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Helper function to ensure phone number starts with +88
  const formatPhoneNumber = (value) => {
    // If value is empty or just whitespace, return +88
    if (!value || value.trim() === '') {
      return '+88';
    }
    
    // Remove all non-digit characters except +
    let cleaned = value.replace(/[^\d+]/g, '');
    
    // Always ensure it starts with +88
    if (!cleaned.startsWith('+88')) {
      // If it starts with +, remove it
      if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
      }
      // If it starts with 88, add +
      if (cleaned.startsWith('88')) {
        cleaned = '+' + cleaned;
      } else {
        // Otherwise, add +88
        cleaned = '+88' + cleaned;
      }
    }
    
    // Prevent deletion of +88 prefix - if someone tries to delete it, keep it
    if (cleaned.length < 3 || !cleaned.startsWith('+88')) {
      return '+88';
    }
    
    return cleaned;
  };

  // Handle phone number change
  const handlePhoneChange = (value) => {
    const formatted = formatPhoneNumber(value);
    setFormData({...formData, phone: formatted});
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
      
      const response = await api.post(`/hospitals/${hospitalId}/doctors`, submitData);
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

  const resetForm = () => {
    setFormData({
      name: '', email: '', phone: '+88', password: '',
      medicalLicenseNumber: '', specialization: '', qualifications: '',
      experienceYears: '', licenseDocumentUrl: '', profilePhotoUrl: '',
    });
  };

  const handleView = (doctor) => {
    setSelectedDoctor(doctor);
    setShowViewModal(true);
  };

  const handleEdit = (doctor) => {
    setSelectedDoctor(doctor);
    // Ensure phone number starts with +88
    let phone = doctor.phone || '+88';
    if (!phone.startsWith('+88')) {
      phone = formatPhoneNumber(phone);
    }
    setFormData({
      name: doctor.name || '',
      email: doctor.email || '',
      phone: phone,
      password: '', // Don't pre-fill password
      medicalLicenseNumber: doctor.medicalLicenseNumber || '',
      specialization: Array.isArray(doctor.specialization) ? doctor.specialization.join(', ') : doctor.specialization || '',
      qualifications: doctor.qualifications || '',
      experienceYears: doctor.experienceYears || '',
      licenseDocumentUrl: doctor.licenseDocumentUrl || '',
      profilePhotoUrl: doctor.profilePhotoUrl || '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const updateData = {
        name: formData.name,
        phone: formData.phone,
        specialization: formData.specialization.split(',').map(s => s.trim()).filter(s => s),
        qualifications: formData.qualifications,
        experienceYears: parseInt(formData.experienceYears),
        licenseDocumentUrl: formData.licenseDocumentUrl,
        profilePhotoUrl: formData.profilePhotoUrl,
      };

      // Only include password if it's provided
      if (formData.password && formData.password.trim() !== '') {
        updateData.password = formData.password;
      }

      const response = await api.put(`/hospitals/${hospitalId}/doctors/${selectedDoctor._id}`, updateData);
      if (response.data.success) {
        setSuccess('Doctor updated successfully!');
        setShowEditModal(false);
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update doctor.');
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
      const response = await api.delete(`/hospitals/${hospitalId}/doctors/${doctorToDelete._id}`);
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

  const handleManageSerial = (doctor) => {
    setSelectedDoctor(doctor);
    setShowManageSerialModal(true);
  };

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Doctors Management</h2>
        <button onClick={() => setShowAddForm(!showAddForm)} className="add-button">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Doctor
        </button>
      </div>

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

      {/* View Doctor Modal */}
      {showViewModal && selectedDoctor && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Doctor Details</h2>
              <button className="close-button" onClick={() => setShowViewModal(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
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
                  <span>{selectedDoctor.medicalLicenseNumber}</span>
                </div>
                <div className="detail-item">
                  <label>Specialization:</label>
                  <span>{Array.isArray(selectedDoctor.specialization) ? selectedDoctor.specialization.join(', ') : selectedDoctor.specialization}</span>
                </div>
                <div className="detail-item">
                  <label>Experience:</label>
                  <span>{selectedDoctor.experienceYears} years</span>
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
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowViewModal(false); handleEdit(selectedDoctor); }} className="edit-btn">Edit</button>
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
                  This will remove <strong>{doctorToDelete.name}</strong> from the hospital. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={handleDeleteCancel} className="close-btn" disabled={deleting}>
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} className="delete-btn" disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Doctor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Serial Modal */}
      {showManageSerialModal && selectedDoctor && (
        <ManageSerialModal
          hospitalId={hospitalId}
          doctor={selectedDoctor}
          onClose={() => {
            setShowManageSerialModal(false);
            setSelectedDoctor(null);
          }}
          setSuccess={setSuccess}
          setError={setError}
        />
      )}

      {/* Edit Doctor Modal */}
      {showEditModal && selectedDoctor && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Doctor</h2>
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
                    <label>Name *</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required disabled />
                    <small>Email cannot be changed</small>
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
                    <label>New Password (leave blank to keep current)</label>
                    <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} minLength={8} />
                  </div>
                  <div className="form-group">
                    <label>Medical License Number *</label>
                    <input type="text" value={formData.medicalLicenseNumber} onChange={(e) => setFormData({...formData, medicalLicenseNumber: e.target.value})} required disabled />
                    <small>License number cannot be changed</small>
                  </div>
                  <div className="form-group">
                    <label>Specialization *</label>
                    <input type="text" value={formData.specialization} onChange={(e) => setFormData({...formData, specialization: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Experience Years *</label>
                    <input type="number" value={formData.experienceYears} onChange={(e) => setFormData({...formData, experienceYears: e.target.value})} required min="0" />
                  </div>
                  <div className="form-group">
                    <label>Qualifications</label>
                    <input type="text" value={formData.qualifications} onChange={(e) => setFormData({...formData, qualifications: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>License Document URL</label>
                    <input type="url" value={formData.licenseDocumentUrl} onChange={(e) => setFormData({...formData, licenseDocumentUrl: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Profile Photo URL</label>
                    <input type="url" value={formData.profilePhotoUrl} onChange={(e) => setFormData({...formData, profilePhotoUrl: e.target.value})} />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" disabled={submitting}>{submitting ? 'Updating...' : 'Update Doctor'}</button>
                </div>
              </form>
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
                      <button onClick={() => handleEdit(doctor)} className="action-btn edit-btn">Edit</button>
                      <button onClick={() => handleManageSerial(doctor)} className="action-btn serial-btn">Manage Serial</button>
                      <button onClick={() => handleDeleteClick(doctor)} className="action-btn delete-btn" disabled={deleting}>
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

// Home Services Tab Component
const HomeServicesTab = ({ hospitalId, services, onRefresh, setSuccess, setError }) => {
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
      const response = await api.post(`/hospitals/${hospitalId}/home-services`, {
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
      const response = await api.put(`/hospitals/${hospitalId}/home-services/${selectedService._id}`, {
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
      const response = await api.delete(`/hospitals/${hospitalId}/home-services/${serviceToDelete._id}`);
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
                <label>Price *</label>
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
                    <label>Price *</label>
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
              <h3 className="service-card-title">{service.serviceType}</h3>
              <div className="service-actions">
                <button
                  type="button"
                  onClick={() => { setSelectedService(service); setShowDetailsModal(true); }}
                  className="action-btn view-btn"
                  title="View Details"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedService(service); setShowSerialModal(true); }}
                  className="action-btn serial-btn"
                  title="Serial Settings"
                >
                  Serial
                </button>
                <button type="button" onClick={() => handleEdit(service)} className="action-btn edit-btn" title="Edit">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <button type="button" onClick={() => handleDeleteClick(service)} className="action-btn delete-btn" title="Delete">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
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

      {/* View Home Service Details Modal */}
      {showDetailsModal && selectedService && (
        <div className="modal-overlay" onClick={() => { setShowDetailsModal(false); setSelectedService(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2>Home Service Details</h2>
              <button className="close-button" onClick={() => { setShowDetailsModal(false); setSelectedService(null); }}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="doctor-detail-grid">
                <div className="detail-item">
                  <label>Service Type:</label>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{selectedService.serviceType}</span>
                </div>
                <div className="detail-item">
                  <label>Price:</label>
                  <span style={{ fontWeight: 700, color: '#6366f1' }}>{selectedService.price} tk</span>
                </div>
                <div className="detail-item">
                  <label>Operating Hours:</label>
                  <span>{selectedService.availableTime?.startTime || '09:00'} – {selectedService.availableTime?.endTime || '17:00'}</span>
                </div>
                <div className="detail-item">
                  <label>Status:</label>
                  <span className={`status-badge ${selectedService.isActive ? 'active' : 'inactive'}`}>
                    {selectedService.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {selectedService.note && (
                  <div className="detail-item full-width" style={{ gridColumn: '1 / -1' }}>
                    <label>Notes / Details:</label>
                    <p style={{ margin: '4px 0 0 0', color: '#475569' }}>{selectedService.note}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="action-btn edit-btn"
                style={{ padding: '8px 16px', borderRadius: '8px' }}
                onClick={() => {
                  const s = selectedService;
                  setShowDetailsModal(false);
                  handleEdit(s);
                }}
              >
                Edit Service
              </button>
              <button
                type="button"
                className="close-btn"
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#e2e8f0', color: '#334155', border: 'none', cursor: 'pointer' }}
                onClick={() => { setShowDetailsModal(false); setSelectedService(null); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showSerialModal && selectedService && (
        <HomeServiceSerialSettingsModal
          hospitalId={hospitalId}
          service={selectedService}
          onClose={() => { setShowSerialModal(false); setSelectedService(null); }}
          setSuccess={setSuccess}
          setError={setError}
        />
      )}
    </div>
  );
};

const HomeServiceSerialSettingsModal = ({ hospitalId, service, onClose, setSuccess, setError }) => {
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
      const response = await api.get(`/hospitals/${hospitalId}/home-services/${service._id}/serial-settings`);
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
        `/hospitals/${hospitalId}/home-services/${service._id}/serial-stats?date=${statsDate}`
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
      const response = await api.post(`/hospitals/${hospitalId}/home-services/${service._id}/serial-settings`, {
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
                <h3>Today&apos;s Serial Stats</h3>
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

const HomeServiceSerialBookingsTab = ({ hospitalId, bookings, onRefresh, setSuccess, setError }) => {
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [updateBooking, setUpdateBooking] = useState(null);

  const handleStatusUpdate = async (bookingId, status) => {
    try {
      const response = await api.put(
        `/hospitals/${hospitalId}/home-service-serial-bookings/${bookingId}/status`,
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
                  <button onClick={() => handleStatusUpdate(booking._id, 'completed')} className="accept-btn">Complete</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {updateBooking && (
        <HomeServiceSerialUpdateModal
          booking={updateBooking}
          mode="hospital"
          providerId={hospitalId}
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
const RequestsTab = ({ hospitalId, requests, onRefresh, setSuccess, setError }) => {
  const handleAccept = async (requestId) => {
    try {
      const response = await api.put(`/hospitals/${hospitalId}/home-service-requests/${requestId}/accept`);
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
      const response = await api.put(`/hospitals/${hospitalId}/home-service-requests/${requestId}/reject`, { rejectionReason: reason });
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
                <h3>Request #{request.requestNumber}</h3>
                <span className={`status-badge ${request.status}`}>{request.status}</span>
              </div>
              <div className="request-details">
                <p><strong>Patient:</strong> {request.patientId?.name}</p>
                <p><strong>Service:</strong> {request.homeServiceId?.serviceType}</p>
                <p><strong>Price:</strong> {request.homeServiceId?.price} tk</p>
                <p><strong>Date:</strong> {new Date(request.requestedDate).toLocaleDateString()}</p>
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

// Appointments Tab Component
const AppointmentsTab = ({ hospitalId, fetchAppointments, setSuccess, setError }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    date: '',
    doctorId: '',
    status: '',
    search: ''
  });
  const [doctors, setDoctors] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    if (hospitalId) {
      loadDoctors();
    }
  }, [hospitalId]);

  useEffect(() => {
    if (hospitalId) {
      loadAppointments();
    }
  }, [hospitalId, filters.date, filters.doctorId, filters.status, filters.search, pagination.page]);

  const loadDoctors = async () => {
    try {
      const response = await api.get(`/hospitals/${hospitalId}/doctors`);
      if (response.data.success) {
        setDoctors(response.data.data.doctors || []);
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const filterParams = {};
      if (filters.date) filterParams.date = filters.date;
      if (filters.doctorId) filterParams.doctorId = filters.doctorId;
      if (filters.status) filterParams.status = filters.status;

      const result = await fetchAppointments(filterParams, pagination.page);
      let filteredAppointments = result.appointments;

      // Client-side search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredAppointments = filteredAppointments.filter(apt => 
          apt.patientId?.name?.toLowerCase().includes(searchLower) ||
          apt.doctorId?.name?.toLowerCase().includes(searchLower) ||
          apt.appointmentNumber?.toLowerCase().includes(searchLower) ||
          apt.chamberId?.name?.toLowerCase().includes(searchLower)
        );
      }

      setAppointments(filteredAppointments);
      setPagination(result.pagination);
    } catch (err) {
      setError('Failed to load appointments.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, page: 1 }); // Reset to first page on filter change
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
  };

  const handleView = (appointment) => {
    setSelectedAppointment(appointment);
    setShowViewModal(true);
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      setLoading(true);
      const response = await api.put(
        `/hospitals/${hospitalId}/appointments/${appointmentId}/status`,
        { status: newStatus }
      );
      if (response.data.success) {
        setSuccess(`Appointment status updated to ${newStatus} successfully!`);
        setTimeout(() => setSuccess(''), 3000);
        
        // Update the appointment in the list
        setAppointments(prevAppointments => 
          prevAppointments.map(apt => 
            apt._id === appointmentId 
              ? { ...apt, status: newStatus, ...response.data.data.appointment }
              : apt
          )
        );
        
        // Update selected appointment if modal is open
        if (showViewModal && selectedAppointment?._id === appointmentId) {
          setSelectedAppointment({ ...selectedAppointment, status: newStatus, ...response.data.data.appointment });
        }
        
        // Reload appointments to get fresh data
        setTimeout(() => {
          loadAppointments();
        }, 500);
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to update appointment status.`);
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStatuses = (currentStatus) => {
    const statusOptions = {
      pending: ['pending', 'accepted', 'rejected'],
      accepted: ['accepted', 'completed', 'cancelled'],
      rejected: ['rejected'],
      completed: ['completed'],
      cancelled: ['cancelled'],
      no_show: ['no_show']
    };
    return statusOptions[currentStatus] || [currentStatus];
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date, timeSlot) => {
    if (timeSlot?.startTime) {
      return timeSlot.startTime;
    }
    if (date) {
      return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return 'N/A';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      accepted: '#10b981',
      rejected: '#ef4444',
      completed: '#3b82f6',
      cancelled: '#6b7280',
      no_show: '#dc2626'
    };
    return colors[status] || '#6b7280';
  };

  const exportToCSV = () => {
    const headers = ['Appointment Number', 'Patient', 'Doctor', 'Chamber', 'Date', 'Time', 'Status', 'Fee', 'Payment Status'];
    const rows = appointments.map(apt => [
      apt.appointmentNumber || 'N/A',
      apt.patientId?.name || 'N/A',
      apt.doctorId?.name || 'N/A',
      apt.chamberId?.name || 'N/A',
      formatDate(apt.appointmentDate),
      formatTime(apt.appointmentDate, apt.timeSlot),
      apt.status || 'N/A',
      apt.fee || 'N/A',
      apt.paymentStatus || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `appointments_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Appointments</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {appointments.length > 0 && (
            <button onClick={exportToCSV} className="add-button" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: '16px', height: '16px', marginRight: '0.25rem' }}>
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="appointments-filters-section">
        <div className="appointments-filters-grid">
          <div className="appointments-filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search by patient, doctor, appointment #..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="appointments-filter-input"
            />
          </div>
          <div className="appointments-filter-group">
            <label>Date</label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
              className="appointments-filter-input"
            />
          </div>
          <div className="appointments-filter-group">
            <label>Doctor</label>
            <select
              value={filters.doctorId}
              onChange={(e) => handleFilterChange('doctorId', e.target.value)}
              className="appointments-filter-select"
            >
              <option value="">All Doctors</option>
              {doctors.map(doctor => (
                <option key={doctor._id} value={doctor._id}>{doctor.name}</option>
              ))}
            </select>
          </div>
          <div className="appointments-filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="appointments-filter-select"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>
        </div>
        <div className="appointments-filters-actions">
          <button
            onClick={() => {
              setFilters({ date: '', doctorId: '', status: '', search: '' });
              setPagination({ ...pagination, page: 1 });
            }}
            className="btn-clear-filters"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Appointments Table */}
      <div className="data-table">
        {loading ? (
          <div className="empty-state">
            <div className="spinner"></div>
            <p>Loading appointments...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="empty-state">
            <p>No appointments found.</p>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Appointment #</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Chamber</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Fee</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr key={apt._id}>
                    <td>
                      <strong style={{ color: '#667eea' }}>{apt.appointmentNumber || 'N/A'}</strong>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: '500' }}>{apt.patientId?.name || 'N/A'}</div>
                        {apt.patientId?.phone && (
                          <small style={{ color: '#6b7280' }}>{apt.patientId.phone}</small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: '500' }}>{apt.doctorId?.name || 'N/A'}</div>
                        {apt.doctorId?.specialization && (
                          <small style={{ color: '#6b7280' }}>
                            {Array.isArray(apt.doctorId.specialization) 
                              ? apt.doctorId.specialization.join(', ') 
                              : apt.doctorId.specialization}
                          </small>
                        )}
                      </div>
                    </td>
                    <td>{apt.chamberId?.name || 'N/A'}</td>
                    <td>{formatDate(apt.appointmentDate)}</td>
                    <td>{formatTime(apt.appointmentDate, apt.timeSlot)}</td>
                    <td>{apt.fee ? `${apt.fee} tk` : 'N/A'}</td>
                    <td>
                      <span className={`status-badge ${apt.paymentStatus || 'pending'}`}>
                        {apt.paymentStatus || 'pending'}
                      </span>
                    </td>
                    <td>
                      {['completed', 'cancelled'].includes(apt.status) ? (
                        <span 
                          className={`status-badge ${apt.status}`}
                          style={{ backgroundColor: getStatusColor(apt.status) + '20', color: getStatusColor(apt.status) }}
                        >
                          {apt.status}
                        </span>
                      ) : (
                        <select
                          value={apt.status}
                          onChange={(e) => {
                            const newStatus = e.target.value;
                            const oldStatus = apt.status;
                            
                            if (newStatus !== oldStatus) {
                              if (window.confirm(`Are you sure you want to change status from ${oldStatus} to ${newStatus}?`)) {
                                handleStatusChange(apt._id, newStatus);
                              }
                              // If cancelled, the select will revert to original value since it's controlled by apt.status
                            }
                          }}
                          disabled={loading}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            border: `1px solid ${getStatusColor(apt.status)}`,
                            backgroundColor: getStatusColor(apt.status) + '20',
                            color: getStatusColor(apt.status),
                            fontWeight: '500',
                            fontSize: '0.875rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            minWidth: '120px'
                          }}
                        >
                          {getAvailableStatuses(apt.status).map(status => (
                            <option key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleView(apt)}
                        className="action-btn view-btn"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '0.5rem',
                marginTop: '1.5rem',
                padding: '1rem'
              }}>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    background: pagination.page === 1 ? '#f3f4f6' : '#fff',
                    cursor: pagination.page === 1 ? 'not-allowed' : 'pointer',
                    opacity: pagination.page === 1 ? 0.5 : 1
                  }}
                >
                  Previous
                </button>
                <span style={{ padding: '0 1rem' }}>
                  Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    background: pagination.page === pagination.pages ? '#f3f4f6' : '#fff',
                    cursor: pagination.page === pagination.pages ? 'not-allowed' : 'pointer',
                    opacity: pagination.page === pagination.pages ? 0.5 : 1
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* View Appointment Modal */}
      {showViewModal && selectedAppointment && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Appointment Details</h2>
              <button className="close-button" onClick={() => setShowViewModal(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="doctor-detail-grid">
                <div className="detail-item">
                  <label>Appointment Number:</label>
                  <span><strong>{selectedAppointment.appointmentNumber || 'N/A'}</strong></span>
                </div>
                <div className="detail-item">
                  <label>Status:</label>
                  <span>
                    <span 
                      className={`status-badge ${selectedAppointment.status}`}
                      style={{ backgroundColor: getStatusColor(selectedAppointment.status) + '20', color: getStatusColor(selectedAppointment.status) }}
                    >
                      {selectedAppointment.status}
                    </span>
                  </span>
                </div>
                <div className="detail-item">
                  <label>Patient Name:</label>
                  <span>{selectedAppointment.patientId?.name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Patient Email:</label>
                  <span>{selectedAppointment.patientId?.email || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Patient Phone:</label>
                  <span>{selectedAppointment.patientId?.phone || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Doctor Name:</label>
                  <span>{selectedAppointment.doctorId?.name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Doctor Email:</label>
                  <span>{selectedAppointment.doctorId?.email || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Specialization:</label>
                  <span>
                    {selectedAppointment.doctorId?.specialization 
                      ? (Array.isArray(selectedAppointment.doctorId.specialization)
                          ? selectedAppointment.doctorId.specialization.join(', ')
                          : selectedAppointment.doctorId.specialization)
                      : 'N/A'}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Chamber:</label>
                  <span>{selectedAppointment.chamberId?.name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Chamber Address:</label>
                  <span>{selectedAppointment.chamberId?.address || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Appointment Date:</label>
                  <span>{formatDate(selectedAppointment.appointmentDate)}</span>
                </div>
                <div className="detail-item">
                  <label>Time Slot:</label>
                  <span>
                    {selectedAppointment.timeSlot?.startTime 
                      ? `${selectedAppointment.timeSlot.startTime}${selectedAppointment.timeSlot.endTime ? ' - ' + selectedAppointment.timeSlot.endTime : ''}`
                      : formatTime(selectedAppointment.appointmentDate, selectedAppointment.timeSlot)}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Consultation Type:</label>
                  <span style={{ textTransform: 'capitalize' }}>{selectedAppointment.consultationType || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Fee:</label>
                  <span><strong>{selectedAppointment.fee ? `${selectedAppointment.fee} tk` : 'N/A'}</strong></span>
                </div>
                <div className="detail-item">
                  <label>Payment Status:</label>
                  <span>
                    <span className={`status-badge ${selectedAppointment.paymentStatus || 'pending'}`}>
                      {selectedAppointment.paymentStatus || 'pending'}
                    </span>
                  </span>
                </div>
                <div className="detail-item">
                  <label>Payment Method:</label>
                  <span style={{ textTransform: 'capitalize' }}>{selectedAppointment.paymentMethod || 'N/A'}</span>
                </div>
                {selectedAppointment.reason && (
                  <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                    <label>Reason for Visit:</label>
                    <span>{selectedAppointment.reason}</span>
                  </div>
                )}
                {selectedAppointment.notes && (
                  <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                    <label>Notes:</label>
                    <span>{selectedAppointment.notes}</span>
                  </div>
                )}
                {selectedAppointment.cancelledBy && (
                  <>
                    <div className="detail-item">
                      <label>Cancelled By:</label>
                      <span style={{ textTransform: 'capitalize' }}>{selectedAppointment.cancelledBy}</span>
                    </div>
                    {selectedAppointment.cancellationReason && (
                      <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                        <label>Cancellation Reason:</label>
                        <span>{selectedAppointment.cancellationReason}</span>
                      </div>
                    )}
                    {selectedAppointment.cancelledAt && (
                      <div className="detail-item">
                        <label>Cancelled At:</label>
                        <span>{formatDate(selectedAppointment.cancelledAt)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="detail-item">
                  <label>Created At:</label>
                  <span>{formatDate(selectedAppointment.createdAt)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowViewModal(false)} className="close-btn">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Tests Tab Component
const TestsTab = ({ hospitalId, tests, onRefresh, setSuccess, setError }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [testToDelete, setTestToDelete] = useState(null);
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
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      const response = await api.post(`/hospitals/${hospitalId}/tests`, {
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

  const handleView = (test) => {
    setSelectedTest(test);
    setShowViewModal(true);
  };

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
      const response = await api.put(`/hospitals/${hospitalId}/tests/${selectedTest._id}`, {
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
      const response = await api.delete(`/hospitals/${hospitalId}/tests/${testToDelete._id}`);
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Test Details</h2>
              <button className="close-button" onClick={() => setShowViewModal(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
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
                  <span>{selectedTest.category}</span>
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
                    <label>Preparation:</label>
                    <span>{selectedTest.preparation}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setShowViewModal(false); handleEdit(selectedTest); }} className="edit-btn">Edit</button>
              <button onClick={() => setShowViewModal(false)} className="close-btn">Close</button>
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
                      <button
                        onClick={() => { setSelectedTest(test); setShowSerialModal(true); }}
                        className="action-btn"
                        title="Serial Settings"
                      >
                        Serial
                      </button>
                      <button onClick={() => handleView(test)} className="action-btn view-btn">View</button>
                      <button onClick={() => handleEdit(test)} className="action-btn edit-btn">Edit</button>
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

      {showSerialModal && selectedTest && (
        <TestSerialSettingsModal
          hospitalId={hospitalId}
          test={selectedTest}
          onClose={() => { setShowSerialModal(false); setSelectedTest(null); }}
          setSuccess={setSuccess}
          setError={setError}
        />
      )}
    </div>
  );
};

const TestSerialSettingsModal = ({ hospitalId, test, onClose, setSuccess, setError }) => {
  const [formData, setFormData] = useState({
    totalSerialsPerDay: 20,
    startTime: '09:00',
    endTime: '17:00',
    testPrice: test.price || 0,
    isActive: true,
    availableDays: [1, 2, 3, 4, 5]
  });
  const [statsDate, setStatsDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [test._id]);

  useEffect(() => {
    if (formData.totalSerialsPerDay) loadStats();
  }, [statsDate, test._id]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/hospitals/${hospitalId}/tests/${test._id}/serial-settings`);
      if (response.data.success) {
        const s = response.data.data.serialSettings;
        setFormData({
          totalSerialsPerDay: s.totalSerialsPerDay,
          startTime: s.serialTimeRange?.startTime || '09:00',
          endTime: s.serialTimeRange?.endTime || '17:00',
          testPrice: s.testPrice,
          isActive: s.isActive,
          availableDays: s.availableDays?.length ? s.availableDays : [1, 2, 3, 4, 5]
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
        `/hospitals/${hospitalId}/tests/${test._id}/serial-stats?date=${statsDate}`
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
      const response = await api.post(`/hospitals/${hospitalId}/tests/${test._id}/serial-settings`, {
        totalSerialsPerDay: parseInt(formData.totalSerialsPerDay, 10),
        serialTimeRange: { startTime: formData.startTime, endTime: formData.endTime },
        testPrice: parseFloat(formData.testPrice),
        availableDays: formData.availableDays,
        isActive: formData.isActive
      });
      if (response.data.success) {
        setSuccess('Test serial settings saved successfully!');
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

  const toggleDay = (day) => {
    setFormData((prev) => {
      const days = prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day].sort();
      return { ...prev, availableDays: days };
    });
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h2>Test Serial Settings — {test.name}</h2>
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
                    <label>Test Price (tk) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.testPrice}
                      onChange={(e) => setFormData({ ...formData, testPrice: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>End Time *</label>
                    <input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} required />
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
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Available Days</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {dayLabels.map((label, i) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleDay(i)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            border: formData.availableDays.includes(i) ? '2px solid #667eea' : '1px solid #ddd',
                            background: formData.availableDays.includes(i) ? '#eef2ff' : '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={onClose}>Cancel</button>
                  <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Settings'}</button>
                </div>
              </form>
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <h3>Daily Stats</h3>
                <input type="date" value={statsDate} onChange={(e) => setStatsDate(e.target.value)} />
                {stats ? (
                  <div className="serial-stats-summary" style={{ marginTop: '0.5rem' }}>
                    <p>Booked: {stats.statistics?.bookedEvenSerials ?? 0} / Available: {stats.statistics?.availableEvenSerials ?? 0}</p>
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
                  <p style={{ marginTop: '0.5rem' }}>Save settings to view stats.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const TestSerialBookingsTab = ({ hospitalId, bookings, onRefresh, setSuccess, setError }) => {
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTestName, setFilterTestName] = useState('');

  const handleStatusUpdate = async (bookingId, status) => {
    try {
      const response = await api.put(
        `/hospitals/${hospitalId}/test-serial-bookings/${bookingId}/status`,
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
    if (filterTestName && !(b.testName || b.testId?.name || '').toLowerCase().includes(filterTestName.toLowerCase())) return false;
    if (filterDate) {
      const d = new Date(b.appointmentDate).toISOString().split('T')[0];
      if (d !== filterDate) return false;
    }
    return true;
  });

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <h2>Test Serial Bookings</h2>
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
        <div className="form-group">
          <label>Filter by test name</label>
          <input type="text" value={filterTestName} onChange={(e) => setFilterTestName(e.target.value)} placeholder="Test name..." />
        </div>
      </div>
      <div className="requests-list">
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No test serial bookings found.</p></div>
        ) : (
          filtered.map((booking) => (
            <div key={booking._id} className="request-card">
              <div className="request-header">
                <h3>{booking.bookingNumber} — Serial #{booking.serialNumber}</h3>
                <span className={`status-badge ${booking.status}`}>{booking.status}</span>
              </div>
              <div className="request-details">
                <p><strong>Test:</strong> {booking.testName || booking.testId?.name}</p>
                <p><strong>Patient:</strong> {booking.patientName} ({booking.patientPhone})</p>
                <p><strong>Date:</strong> {new Date(booking.appointmentDate).toLocaleDateString()}</p>
                <p><strong>Time:</strong> {booking.timeSlot?.startTime} - {booking.timeSlot?.endTime}</p>
                <p><strong>Price:</strong> {booking.testPrice} tk</p>
              </div>
              {booking.status === 'pending' && (
                <div className="request-actions">
                  <button onClick={() => handleStatusUpdate(booking._id, 'confirmed')} className="accept-btn">Confirm</button>
                  <button onClick={() => handleStatusUpdate(booking._id, 'cancelled')} className="reject-btn">Cancel</button>
                </div>
              )}
              {booking.status === 'confirmed' && (
                <div className="request-actions">
                  <button onClick={() => handleStatusUpdate(booking._id, 'completed')} className="accept-btn">Complete</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Manage Serial Modal Component
const ManageSerialModal = ({ hospitalId, doctor, onClose, setSuccess, setError }) => {
  const [activeTab, setActiveTab] = useState('settings'); // 'settings', 'dateManagement', or 'statistics'
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [serialSettings, setSerialSettings] = useState(null);
  const [serialStats, setSerialStats] = useState(null);
  const [dateSerialSettings, setDateSerialSettings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateFormData, setDateFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    totalSerialsPerDay: 20,
    adminNote: '',
    isEnabled: true
  });
  const [editingDate, setEditingDate] = useState(null);
  const [formData, setFormData] = useState({
    totalSerialsPerDay: 20,
    serialTimeRange: {
      startTime: '09:00',
      endTime: '17:00'
    },
    appointmentPrice: 500,
    availableDays: [1, 2, 3, 4, 5], // Monday to Friday
    isActive: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSerialSettings();
    if (activeTab === 'statistics') {
      fetchSerialStats();
    }
    if (activeTab === 'dateManagement') {
      fetchDateSerialSettings();
    }
  }, [hospitalId, doctor, activeTab, selectedDate]);

  const fetchSerialSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/hospitals/${hospitalId}/doctors/${doctor._id}/serial-settings`);
      if (response.data.success) {
        const settings = response.data.data.serialSettings;
        setSerialSettings(settings);
        setFormData({
          totalSerialsPerDay: settings.totalSerialsPerDay || 20,
          serialTimeRange: settings.serialTimeRange || { startTime: '09:00', endTime: '17:00' },
          appointmentPrice: settings.appointmentPrice || 500,
          availableDays: settings.availableDays || [1, 2, 3, 4, 5],
          isActive: settings.isActive !== undefined ? settings.isActive : true
        });
      } else {
        // Settings don't exist yet, use defaults
        setSerialSettings(null);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // Settings don't exist yet, use defaults
        setSerialSettings(null);
      } else {
        setError(err.response?.data?.message || 'Failed to load serial settings.');
        setTimeout(() => setError(''), 5000);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSerialStats = async () => {
    setLoadingStats(true);
    try {
      const response = await api.get(`/hospitals/${hospitalId}/doctors/${doctor._id}/serial-stats?date=${selectedDate}`);
      if (response.data.success) {
        setSerialStats(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load serial statistics.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDayToggle = (day) => {
    const days = formData.availableDays;
    if (days.includes(day)) {
      setFormData({ ...formData, availableDays: days.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, availableDays: [...days, day].sort() });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post(`/hospitals/${hospitalId}/doctors/${doctor._id}/serial-settings`, formData);
      if (response.data.success) {
        setSuccess('Serial settings saved successfully!');
        setSerialSettings(response.data.data.serialSettings);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save serial settings.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchDateSerialSettings = async () => {
    setLoadingDates(true);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 60); // Next 60 days
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const response = await api.get(
        `/hospitals/${hospitalId}/doctors/${doctor._id}/date-serial-settings?startDate=${startDateStr}&endDate=${endDateStr}`
      );
      if (response.data.success) {
        setDateSerialSettings(response.data.data.dateSerialSettings || []);
      }
    } catch (err) {
      console.error('Error fetching date serial settings:', err);
      if (err.code === 'ERR_NETWORK' || err.message?.includes('ERR_CONNECTION_REFUSED')) {
        setError('Cannot connect to server. Please make sure the backend server is running.');
      } else {
        setError(err.response?.data?.message || 'Failed to load date serial settings.');
      }
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoadingDates(false);
    }
  };

  const handleDateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post(
        `/hospitals/${hospitalId}/doctors/${doctor._id}/date-serial-settings`,
        dateFormData
      );
      if (response.data.success) {
        setSuccess('Date serial settings saved successfully!');
        setEditingDate(null);
        setDateFormData({
          date: new Date().toISOString().split('T')[0],
          totalSerialsPerDay: serialSettings?.totalSerialsPerDay || 20,
          adminNote: '',
          isEnabled: true
        });
        fetchDateSerialSettings();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save date serial settings.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditDate = (dateSetting) => {
    setEditingDate(dateSetting._id);
    setDateFormData({
      date: new Date(dateSetting.date).toISOString().split('T')[0],
      totalSerialsPerDay: dateSetting.totalSerialsPerDay,
      adminNote: dateSetting.adminNote || '',
      isEnabled: dateSetting.isEnabled
    });
  };

  const handleDeleteDate = async (dateSettingsId) => {
    if (!window.confirm('Are you sure you want to remove this date from serial booking?')) {
      return;
    }
    try {
      const response = await api.delete(
        `/hospitals/${hospitalId}/doctors/${doctor._id}/date-serial-settings/${dateSettingsId}`
      );
      if (response.data.success) {
        setSuccess('Date removed successfully!');
        fetchDateSerialSettings();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete date serial settings.');
      setTimeout(() => setError(''), 5000);
    }
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content serial-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Serial - {doctor.name}</h2>
          <button className="close-button" onClick={onClose}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="serial-modal-tabs">
          <button
            className={`serial-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Serial Settings
          </button>
          <button
            className={`serial-tab ${activeTab === 'dateManagement' ? 'active' : ''}`}
            onClick={() => setActiveTab('dateManagement')}
          >
            Date Management
          </button>
          <button
            className={`serial-tab ${activeTab === 'statistics' ? 'active' : ''}`}
            onClick={() => setActiveTab('statistics')}
          >
            Statistics & Bookings
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'settings' && (
            <div className="serial-settings-form">
              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading settings...</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Total Serials Per Day *</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.totalSerialsPerDay}
                        onChange={(e) => setFormData({ ...formData, totalSerialsPerDay: parseInt(e.target.value) || 1 })}
                        required
                      />
                      <small>Only even-numbered serials (2, 4, 6...) will be available for online booking</small>
                    </div>

                    <div className="form-group">
                      <label>Appointment Price (tk) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.appointmentPrice}
                        onChange={(e) => setFormData({ ...formData, appointmentPrice: parseFloat(e.target.value) || 0 })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Start Time *</label>
                      <input
                        type="time"
                        value={formData.serialTimeRange.startTime}
                        onChange={(e) => setFormData({
                          ...formData,
                          serialTimeRange: { ...formData.serialTimeRange, startTime: e.target.value }
                        })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>End Time *</label>
                      <input
                        type="time"
                        value={formData.serialTimeRange.endTime}
                        onChange={(e) => setFormData({
                          ...formData,
                          serialTimeRange: { ...formData.serialTimeRange, endTime: e.target.value }
                        })}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Available Days *</label>
                      <div className="days-selector">
                        {dayNames.map((day, index) => (
                          <label key={index} className="day-checkbox">
                            <input
                              type="checkbox"
                              checked={formData.availableDays.includes(index)}
                              onChange={() => handleDayToggle(index)}
                            />
                            <span>{day.substring(0, 3)}</span>
                          </label>
                        ))}
                      </div>
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
                      {submitting ? 'Saving...' : serialSettings ? 'Update Settings' : 'Create Settings'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'dateManagement' && (
            <div className="date-management-form">
              {!serialSettings ? (
                <div className="empty-state">
                  <p>Please configure base serial settings first before managing dates.</p>
                </div>
              ) : (
                <>
                  <div className="date-form-section">
                    <h3>{editingDate ? 'Edit Date Settings' : 'Add New Date'}</h3>
                    <form onSubmit={handleDateSubmit}>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Select Date *</label>
                          <input
                            type="date"
                            value={dateFormData.date}
                            onChange={(e) => setDateFormData({ ...dateFormData, date: e.target.value })}
                            min={new Date().toISOString().split('T')[0]}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Total Serials for This Date *</label>
                          <input
                            type="number"
                            min="1"
                            value={dateFormData.totalSerialsPerDay}
                            onChange={(e) => setDateFormData({ ...dateFormData, totalSerialsPerDay: parseInt(e.target.value) || 1 })}
                            required
                          />
                          <small>Default: {serialSettings.totalSerialsPerDay}</small>
                        </div>

                        <div className="form-group">
                          <label>Enable Booking</label>
                          <select
                            value={dateFormData.isEnabled ? 'enabled' : 'disabled'}
                            onChange={(e) => setDateFormData({ ...dateFormData, isEnabled: e.target.value === 'enabled' })}
                          >
                            <option value="enabled">Enabled</option>
                            <option value="disabled">Disabled</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label>Admin Note/Message (Optional)</label>
                          <textarea
                            value={dateFormData.adminNote}
                            onChange={(e) => setDateFormData({ ...dateFormData, adminNote: e.target.value })}
                            placeholder="e.g., 'Doctor will come late', 'Limited serial today', etc."
                            rows="3"
                            maxLength={500}
                          />
                          <small>{dateFormData.adminNote.length}/500 characters</small>
                        </div>
                      </div>

                      <div className="form-actions">
                        {editingDate && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDate(null);
                              setDateFormData({
                                date: new Date().toISOString().split('T')[0],
                                totalSerialsPerDay: serialSettings.totalSerialsPerDay || 20,
                                adminNote: '',
                                isEnabled: true
                              });
                            }}
                          >
                            Cancel
                          </button>
                        )}
                        <button type="submit" disabled={submitting}>
                          {submitting ? 'Saving...' : editingDate ? 'Update Date' : 'Add Date'}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="date-list-section">
                    <h3>Configured Dates ({dateSerialSettings.length})</h3>
                    {loadingDates ? (
                      <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading dates...</p>
                      </div>
                    ) : dateSerialSettings.length === 0 ? (
                      <div className="empty-state">
                        <p>No dates configured yet. Add dates above to enable serial booking for specific dates.</p>
                      </div>
                    ) : (
                      <div className="date-settings-list">
                        {dateSerialSettings.map((dateSetting) => {
                          const date = new Date(dateSetting.date);
                          const isPast = date < new Date().setHours(0, 0, 0, 0);
                          
                          return (
                            <div key={dateSetting._id} className={`date-setting-card ${isPast ? 'past' : ''} ${!dateSetting.isEnabled ? 'disabled' : ''}`}>
                              <div className="date-setting-header">
                                <div className="date-info">
                                  <span className="date-display">
                                    {date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                  </span>
                                  {dateSetting.isEnabled ? (
                                    <span className="status-badge active">Enabled</span>
                                  ) : (
                                    <span className="status-badge inactive">Disabled</span>
                                  )}
                                </div>
                                <div className="date-actions">
                                  <button
                                    onClick={() => handleEditDate(dateSetting)}
                                    className="action-btn edit-btn"
                                    title="Edit"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDate(dateSetting._id)}
                                    className="action-btn delete-btn"
                                    title="Delete"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              <div className="date-setting-details">
                                <div className="detail-item">
                                  <strong>Total Serials:</strong> {dateSetting.totalSerialsPerDay}
                                </div>
                                {dateSetting.adminNote && (
                                  <div className="detail-item note">
                                    <strong>Note:</strong> {dateSetting.adminNote}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'statistics' && (
            <div className="serial-statistics">
              <div className="stats-date-selector">
                <label>Select Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                <button onClick={fetchSerialStats} disabled={loadingStats}>
                  {loadingStats ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {loadingStats ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading statistics...</p>
                </div>
              ) : serialStats ? (
                <>
                  <div className="stats-summary">
                    <div className="stat-card">
                      <h3>Total Serials</h3>
                      <p className="stat-value">{serialStats.serialSettings?.totalSerialsPerDay || 0}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Even Serials Available</h3>
                      <p className="stat-value">{serialStats.serialSettings?.evenNumberedSerialsAvailable || 0}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Booked Serials</h3>
                      <p className="stat-value">{serialStats.statistics?.totalBooked || 0}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Available Now</h3>
                      <p className="stat-value">{serialStats.statistics?.availableEvenSerials || 0}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Price</h3>
                      <p className="stat-value">{serialStats.serialSettings?.appointmentPrice || 0} tk</p>
                    </div>
                    <div className="stat-card">
                      <h3>Time Range</h3>
                      <p className="stat-value">
                        {serialStats.serialSettings?.timeRange?.startTime || 'N/A'} - {serialStats.serialSettings?.timeRange?.endTime || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="booked-patients-section">
                    <h3>Booked Patients ({serialStats.statistics?.bookedPatients?.length || 0})</h3>
                    {serialStats.statistics?.bookedPatients && serialStats.statistics.bookedPatients.length > 0 ? (
                      <div className="booked-patients-list">
                        {serialStats.statistics.bookedPatients.map((booking, index) => (
                          <div key={index} className="patient-booking-card">
                            <div className="booking-header">
                              <span className="serial-badge">Serial #{booking.serialNumber}</span>
                              <span className="appointment-number">{booking.appointmentNumber}</span>
                            </div>
                            <div className="booking-details">
                              <div className="detail-row">
                                <strong>Patient:</strong> {booking.patient?.name || 'N/A'}
                              </div>
                              <div className="detail-row">
                                <strong>Email:</strong> {booking.patient?.email || 'N/A'}
                              </div>
                              <div className="detail-row">
                                <strong>Phone:</strong> {booking.patient?.phone || 'N/A'}
                              </div>
                              <div className="detail-row">
                                <strong>Time:</strong> {booking.time || 'N/A'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <p>No bookings found for this date.</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <p>No serial settings found. Please configure serial settings first.</p>
                </div>
              )}
            </div>
          )}
        </div>
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
  return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  );
};

const HospitalStaffTab = ({
  hospitalId,
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
    HOSPITAL_PERMISSIONS.forEach((p) => {
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
        ? await api.put(`/hospitals/${hospitalId}/staff/${editing._id}`, payload)
        : await api.post(`/hospitals/${hospitalId}/staff`, payload);

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
      const response = await api.put(`/hospitals/${hospitalId}/staff/${member._id}`, {
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
    if (!window.confirm(`Remove ${member.name} from the hospital team?`)) return;
    try {
      const response = await api.delete(`/hospitals/${hospitalId}/staff/${member._id}`);
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
            Add hospital staff and assign roles with specific permissions.
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
            aria-labelledby="staff-modal-title"
          >
            <div className="modal-header">
              <h2 id="staff-modal-title">{editing ? 'Edit Team Member' : 'Add Team Member'}</h2>
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
                        placeholder="e.g. Front desk"
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
                      placeholder="e.g. Front desk"
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

export default HospitalDashboard;
