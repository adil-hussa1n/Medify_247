import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import Navbar from '../components/Navbar';
import {
  canAccess,
  canAccessTab,
  ROLE_OPTIONS,
  DOCTOR_PERMISSIONS,
  ALL_PERMISSION_KEYS
} from '../utils/doctorPermissions';
import './DoctorDashboard.css';

const DASHBOARD_TABS = [
  { key: 'overview', label: 'Overview', icon: 'overview' },
  { key: 'appointments', label: 'Appointments', icon: 'appointments' },
  { key: 'serial-settings', label: 'Serial Settings', icon: 'serials' },
  { key: 'date-management', label: 'Date Management', icon: 'date' },
  { key: 'schedule', label: 'Schedule', icon: 'schedule' },
  { key: 'profile', label: 'Profile', icon: 'profile' },
  { key: 'staff', label: 'Team & Access', icon: 'staff' }
];

const DoctorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [doctorId, setDoctorId] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [membership, setMembership] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    filter: 'all',
    search: ''
  });
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [serialSettings, setSerialSettings] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [stats, setStats] = useState(null);

  const isIndividualPractice =
    user?.role === 'doctor_staff' ||
    (doctorProfile && !doctorProfile.hospitalId && !doctorProfile.diagnosticCenterId);

  const visibleTabs = useMemo(() => {
    return DASHBOARD_TABS.filter((tab) => {
      if (tab.key === 'staff' && !isIndividualPractice) return false;
      return canAccessTab(permissions, tab.key);
    });
  }, [permissions, isIndividualPractice]);

  useEffect(() => {
    if (!permissions.length || !visibleTabs.length) return;
    if (!canAccessTab(permissions, activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [permissions, visibleTabs, activeTab]);

  useEffect(() => {
    if (!user || !['doctor', 'doctor_staff'].includes(user.role)) {
      navigate('/doctor/login');
      return;
    }
    initPracticeContext();
  }, [user]);

  useEffect(() => {
    if (doctorId) {
      fetchDoctorAccess();
      if (activeTab === 'staff') fetchStaffMembers();
    }
  }, [doctorId, activeTab]);

  useEffect(() => {
    if (user && ['doctor', 'doctor_staff'].includes(user.role)) {
      if (activeTab === 'appointments') {
        fetchAppointments();
      } else if (activeTab === 'serial-settings') {
        fetchSerialSettings();
      } else if (activeTab === 'date-management') {
        fetchSerialSettings(); // Need base settings first
      } else if (activeTab === 'schedule') {
        fetchSchedules();
      } else if (activeTab === 'profile') {
        fetchDoctorProfile(); // Refresh profile data
      } else if (activeTab === 'overview') {
        fetchStats();
        fetchAppointments(); // For overview stats
      }
    }
  }, [user, activeTab, filters.filter, filters.search, pagination.page]);

  const applyDoctorAccess = (access) => {
    if (!access?.doctorId) return;
    setDoctorId(access.doctorId);
    if (access.permissions?.length) {
      setPermissions(access.permissions);
      setMembership(access);
    }
  };

  const initPracticeContext = async () => {
    const userId = user.id || user._id;

    if (user.role === 'doctor_staff') {
      try {
        const savedAccess = localStorage.getItem('doctorAccess');
        if (savedAccess) {
          applyDoctorAccess(JSON.parse(savedAccess));
        }

        const userResponse = await api.get(`/users/${userId}`);
        if (userResponse.data.success) {
          const access = userResponse.data.data.doctorAccess;
          applyDoctorAccess(access);
          if (access) {
            localStorage.setItem('doctorAccess', JSON.stringify(access));
          }
        }
      } catch (err) {
        console.error('Error loading practice context:', err);
        if (!localStorage.getItem('doctorAccess')) {
          setError('Failed to load practice access.');
        }
      }
    }
    await fetchDoctorProfile();
  };

  const fetchDoctorAccess = async () => {
    try {
      const response = await api.get(`/doctor-practice/${doctorId}/access`);
      if (response.data.success) {
        const perms = response.data.data.permissions || [];
        if (perms.length) {
          setPermissions(perms);
        }
        setMembership(response.data.data.membership);
      }
    } catch (err) {
      console.error('Error fetching doctor access:', err);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const response = await api.get(`/doctor-practice/${doctorId}/staff`);
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

  const fetchDoctorProfile = async () => {
    try {
      const response = await api.get('/doctor/profile');
      if (response.data.success) {
        const doctor = response.data.data.doctor;
        setDoctorProfile(doctor);
        if (user.role === 'doctor') {
          setDoctorId(doctor._id);
          if (!doctor.hospitalId && !doctor.diagnosticCenterId) {
            setPermissions(ALL_PERMISSION_KEYS);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching doctor profile:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/doctor/serial-stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      // Stats endpoint might not exist, that's okay
      console.log('Stats not available');
    }
  };

  const fetchSerialSettings = async () => {
    try {
      const response = await api.get('/doctor/serial-settings');
      if (response.data.success) {
        // Set serialSettings to null if the API returns null (no settings exist yet)
        setSerialSettings(response.data.data.serialSettings || null);
      } else {
        // No settings exist yet, set to null to show form with defaults
        setSerialSettings(null);
      }
    } catch (err) {
      console.error('Error fetching serial settings:', err);
      if (err.response?.status === 404) {
        // No settings exist yet, that's okay - form will show with defaults
        setSerialSettings(null);
      } else {
        setError('Failed to load serial settings. Please try again.');
        setTimeout(() => setError(''), 5000);
      }
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await api.get('/doctor/schedules');
      if (response.data.success) {
        setSchedules(response.data.data.schedules || []);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
    }
  };

  const fetchAppointments = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        filter: filters.filter,
        page: pagination.page,
        limit: pagination.limit
      };
      
      const response = await api.get('/doctor/appointments', { params });
      
      if (response.data.success) {
        let appointmentsData = response.data.data.appointments || [];
        
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          appointmentsData = appointmentsData.filter(apt => {
            const patientName = apt.patientId?.name?.toLowerCase() || '';
            const patientEmail = apt.patientId?.email?.toLowerCase() || '';
            const patientPhone = apt.patientId?.phone?.toLowerCase() || '';
            const appointmentNumber = apt.appointmentNumber?.toLowerCase() || '';
            return patientName.includes(searchLower) || 
                   patientEmail.includes(searchLower) || 
                   patientPhone.includes(searchLower) ||
                   appointmentNumber.includes(searchLower);
          });
        }
        
        setAppointments(appointmentsData);
        setPagination({
          ...pagination,
          total: response.data.data.total || appointmentsData.length,
          pages: Math.ceil((response.data.data.total || appointmentsData.length) / pagination.limit)
        });
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError(err.response?.data?.message || 'Failed to load appointments.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appointmentId, newStatus, notes = '') => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Updating appointment status:', { appointmentId, newStatus, notes });
      
      const response = await api.put(
        `/doctor/appointments/${appointmentId}/status`,
        { status: newStatus, notes: notes || '' }
      );
      
      console.log('Status update response:', response.data);
      
      if (response.data.success) {
        setSuccess(`Appointment status updated to ${newStatus} successfully!`);
        setTimeout(() => setSuccess(''), 3000);
        
        setAppointments(prevAppointments => 
          prevAppointments.map(apt => 
            apt._id === appointmentId 
              ? { ...apt, status: newStatus, ...response.data.data.appointment }
              : apt
          )
        );
        
        if (showViewModal && selectedAppointment?._id === appointmentId) {
          setSelectedAppointment({ ...selectedAppointment, status: newStatus, ...response.data.data.appointment });
        }
        
        setTimeout(() => {
          fetchAppointments();
        }, 500);
      }
    } catch (err) {
      console.error('Error updating appointment status:', err);
      console.error('Error details:', {
        status: err.response?.status,
        message: err.response?.data?.message,
        errors: err.response?.data?.errors,
        url: err.config?.url,
        data: err.config?.data
      });
      
      if (err.response?.status === 404) {
        setError('Appointment not found or you do not have permission to update it.');
      } else if (err.response?.status === 400) {
        const errorMsg = err.response?.data?.message || 'Invalid status or validation failed.';
        const validationErrors = err.response?.data?.errors;
        if (validationErrors && validationErrors.length > 0) {
          setError(`${errorMsg} ${validationErrors.map(e => e.msg).join(', ')}`);
        } else {
          setError(errorMsg);
        }
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Authentication failed. Please log in again.');
      } else {
        setError(err.response?.data?.message || 'Failed to update appointment status.');
      }
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowViewModal(true);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date, timeSlot) => {
    if (timeSlot?.startTime && timeSlot?.endTime) {
      return `${timeSlot.startTime} - ${timeSlot.endTime}`;
    }
    if (date) {
      const d = new Date(date);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return 'N/A';
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      pending: 'status-pending',
      accepted: 'status-accepted',
      rejected: 'status-rejected',
      cancelled: 'status-cancelled',
      no_show: 'status-no-show'
    };
    return statusMap[status] || 'status-default';
  };

  const getAvailableStatuses = (currentStatus) => {
    const statusOptions = {
      pending: ['pending', 'accepted', 'rejected'],
      accepted: ['accepted', 'cancelled'],
      rejected: ['rejected'],
      cancelled: ['cancelled'],
      no_show: ['no_show']
    };
    return statusOptions[currentStatus] || [currentStatus];
  };

  // Calculate overview stats
  const todayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.appointmentDate);
    const today = new Date();
    return aptDate.toDateString() === today.toDateString();
  }).length;

  const upcomingAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.appointmentDate);
    const today = new Date();
    return aptDate > today && apt.status !== 'cancelled';
  }).length;

  const pendingAppointments = appointments.filter(apt => apt.status === 'pending').length;

  return (
    <div className="doctor-dashboard">
      <Navbar />
      <div className="doctor-dashboard-container">
        <div className="dashboard-header">
          <div>
            <h1>Doctor Dashboard</h1>
            <p>Welcome back, {doctorProfile?.name || user?.name || 'Doctor'}!</p>
          </div>
          {doctorProfile && (
            <div className="doctor-info-card">
              <div className="info-item">
                <span className="info-label">Specialization:</span>
                <span className="info-value">
                  {Array.isArray(doctorProfile.specialization) 
                    ? doctorProfile.specialization.join(', ')
                    : doctorProfile.specialization || 'N/A'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Consultation Fee:</span>
                <span className="info-value">{doctorProfile.consultationFee || 0} BDT</span>
              </div>
            </div>
          )}
        </div>

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

        <div className="dashboard-tabs">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <DoctorTabIcon type={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <OverviewTab 
            todayAppointments={todayAppointments}
            upcomingAppointments={upcomingAppointments}
            pendingAppointments={pendingAppointments}
            stats={stats}
            doctorProfile={doctorProfile}
          />
        )}

        {activeTab === 'appointments' && (
          <AppointmentsTab
            appointments={appointments}
            loading={loading}
            filters={filters}
            setFilters={setFilters}
            pagination={pagination}
            setPagination={setPagination}
            handleViewAppointment={handleViewAppointment}
            handleStatusChange={handleStatusChange}
            getStatusBadgeClass={getStatusBadgeClass}
            getAvailableStatuses={getAvailableStatuses}
            formatDate={formatDate}
            formatTime={formatTime}
          />
        )}

        {activeTab === 'serial-settings' && (
          <SerialSettingsTab
            serialSettings={serialSettings}
            fetchSerialSettings={fetchSerialSettings}
            setSuccess={setSuccess}
            setError={setError}
          />
        )}

        {activeTab === 'date-management' && (
          <DateManagementTab
            serialSettings={serialSettings}
            setSuccess={setSuccess}
            setError={setError}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleTab
            schedules={schedules}
            fetchSchedules={fetchSchedules}
            setSuccess={setSuccess}
            setError={setError}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            doctorProfile={doctorProfile}
            fetchDoctorProfile={fetchDoctorProfile}
            setSuccess={setSuccess}
            setError={setError}
          />
        )}

        {activeTab === 'staff' && doctorId && (
          <DoctorStaffTab
            doctorId={doctorId}
            staff={staffMembers}
            membership={membership}
            canManage={canAccess(permissions, 'staff:manage')}
            onRefresh={fetchStaffMembers}
            setSuccess={setSuccess}
            setError={setError}
          />
        )}
      </div>

      {/* View Appointment Modal */}
      {showViewModal && selectedAppointment && (
        <AppointmentViewModal
          appointment={selectedAppointment}
          onClose={() => setShowViewModal(false)}
          handleStatusChange={handleStatusChange}
          getStatusBadgeClass={getStatusBadgeClass}
          getAvailableStatuses={getAvailableStatuses}
          formatDate={formatDate}
          formatTime={formatTime}
          loading={loading}
        />
      )}
    </div>
  );
};

const DoctorTabIcon = ({ type }) => {
  if (type === 'staff') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5 5 0 00-5-5H9a5 5 0 00-5 5v1h12z" />
      </svg>
    );
  }
  if (type === 'appointments' || type === 'date') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
      </svg>
    );
  }
  if (type === 'serials') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    );
  }
  if (type === 'schedule') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
    );
  }
  if (type === 'profile') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  );
};

const DoctorStaffTab = ({
  doctorId,
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
    DOCTOR_PERMISSIONS.forEach((p) => {
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
        ? await api.put(`/doctor-practice/${doctorId}/staff/${editing._id}`, payload)
        : await api.post(`/doctor-practice/${doctorId}/staff`, payload);

      if (response.data.success) {
        setSuccess(editing ? 'Team member updated' : 'Team member added');
        resetForm();
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save team member');
      setTimeout(() => setError(''), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (member) => {
    try {
      const response = await api.put(`/doctor-practice/${doctorId}/staff/${member._id}`, {
        isActive: !member.isActive
      });
      if (response.data.success) {
        setSuccess(member.isActive ? 'Team member deactivated' : 'Team member activated');
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleRemove = async (member) => {
    if (!window.confirm(`Remove ${member.name} from the practice team?`)) return;
    try {
      const response = await api.delete(`/doctor-practice/${doctorId}/staff/${member._id}`);
      if (response.data.success) {
        setSuccess('Team member removed');
        onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove team member');
      setTimeout(() => setError(''), 4000);
    }
  };

  return (
    <div className="staff-tab">
      <div className="home-services-header">
        <div>
          <h2>Team & Access Control</h2>
          <p className="staff-tab-desc">
            Add practice staff and assign roles with specific permissions.
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
                    <td className="staff-actions">
                      {!member.isOwner && (
                        <>
                          <button type="button" className="btn-link" onClick={() => openEdit(member)}>Edit</button>
                          <button type="button" className="btn-link" onClick={() => handleToggleActive(member)}>
                            {member.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" className="btn-link danger" onClick={() => handleRemove(member)}>Remove</button>
                        </>
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
          >
            <div className="modal-header">
              <h2>{editing ? 'Edit Team Member' : 'Add Team Member'}</h2>
              <button type="button" className="close-button" onClick={resetForm} aria-label="Close">×</button>
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
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Job title</label>
                      <input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Email *</label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Phone *</label>
                      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Password *</label>
                      <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required />
                    </div>
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

// Overview Tab Component
const OverviewTab = ({ todayAppointments, upcomingAppointments, pendingAppointments, stats, doctorProfile }) => {
  return (
    <div className="overview-section">
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon today">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{todayAppointments}</h3>
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
            <h3 className="metric-value">{upcomingAppointments}</h3>
            <p className="metric-label">Upcoming Appointments</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon pending">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="metric-content">
            <h3 className="metric-value">{pendingAppointments}</h3>
            <p className="metric-label">Pending Appointments</p>
          </div>
        </div>

        {stats && (
          <div className="metric-card">
            <div className="metric-icon stats">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div className="metric-content">
              <h3 className="metric-value">{stats.totalBooked || 0}</h3>
              <p className="metric-label">Total Booked Serials</p>
            </div>
          </div>
        )}
      </div>

      {doctorProfile && (
        <div className="profile-summary-card">
          <h3>Profile Summary</h3>
          <div className="profile-details">
            <div className="profile-detail-item">
              <span className="detail-label">Name:</span>
              <span className="detail-value">{doctorProfile.name || 'N/A'}</span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">Email:</span>
              <span className="detail-value">{doctorProfile.email || 'N/A'}</span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">Phone:</span>
              <span className="detail-value">{doctorProfile.phone || 'N/A'}</span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">Specialization:</span>
              <span className="detail-value">
                {Array.isArray(doctorProfile.specialization) 
                  ? doctorProfile.specialization.join(', ')
                  : doctorProfile.specialization || 'N/A'}
              </span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">Consultation Fee:</span>
              <span className="detail-value">{doctorProfile.consultationFee || 0} BDT</span>
            </div>
            <div className="profile-detail-item">
              <span className="detail-label">Status:</span>
              <span className={`status-badge ${doctorProfile.status === 'approved' ? 'status-accepted' : 'status-pending'}`}>
                {doctorProfile.status || 'pending'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Appointments Tab Component (keeping existing implementation)
const AppointmentsTab = ({
  appointments,
  loading,
  filters,
  setFilters,
  pagination,
  setPagination,
  handleViewAppointment,
  handleStatusChange,
  getStatusBadgeClass,
  getAvailableStatuses,
  formatDate,
  formatTime
}) => {
  const exportToCSV = () => {
    if (appointments.length === 0) {
      alert('No appointments to export');
      return;
    }

    // Prepare CSV headers
    const headers = [
      'Appointment Number',
      'Patient Name',
      'Patient Email',
      'Patient Phone',
      'Date',
      'Time',
      'Serial Number',
      'Fee (BDT)',
      'Status',
      'Notes',
      'Created At'
    ];

    // Prepare CSV rows
    const rows = appointments.map(apt => {
      const serialMatch = apt.notes?.match(/Serial #(\d+)/);
      const serialNumber = serialMatch ? serialMatch[1] : 'N/A';
      
      return [
        apt.appointmentNumber || 'N/A',
        apt.patientId?.name || 'N/A',
        apt.patientId?.email || 'N/A',
        apt.patientId?.phone || 'N/A',
        formatDate(apt.appointmentDate),
        formatTime(apt.appointmentDate, apt.timeSlot),
        serialNumber,
        apt.fee || 'N/A',
        apt.status || 'pending',
        apt.notes || '',
        apt.createdAt ? new Date(apt.createdAt).toLocaleString() : 'N/A'
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape commas and quotes in cell values
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
    ].join('\n');

    // Create blob and download
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
    <div className="appointments-section">
      <div className="section-header">
        <h2>Appointment Management</h2>
        <div className="filters">
          <input
            type="text"
            placeholder="Search by patient name, email, phone, or appointment number..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="search-input"
          />
          <button
            onClick={exportToCSV}
            className="btn-export-csv"
            disabled={loading || appointments.length === 0}
            title="Export appointments to CSV"
          >
            📥 Export to CSV
          </button>
        </div>
      </div>

      {loading && appointments.length === 0 ? (
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
          <div className="appointments-table-container">
            <table className="appointments-table">
              <thead>
                <tr>
                  <th>Appointment #</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Serial</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...appointments]
                  .sort((a, b) => {
                    // Extract serial numbers from notes
                    const serialMatchA = a.notes?.match(/Serial #(\d+)/);
                    const serialMatchB = b.notes?.match(/Serial #(\d+)/);
                    const serialA = serialMatchA ? parseInt(serialMatchA[1]) : 0;
                    const serialB = serialMatchB ? parseInt(serialMatchB[1]) : 0;
                    
                    // Sort by serial number descending (higher/newer serials first)
                    // If no serial, put at the end
                    if (serialA === 0 && serialB === 0) return 0;
                    if (serialA === 0) return 1; // No serial goes to bottom
                    if (serialB === 0) return -1; // No serial goes to bottom
                    return serialB - serialA; // Higher serial numbers first
                  })
                  .map((apt) => {
                  const serialMatch = apt.notes?.match(/Serial #(\d+)/);
                  const serialNumber = serialMatch ? serialMatch[1] : null;
                  
                  return (
                    <tr key={apt._id}>
                      <td>
                        <strong style={{ color: '#667eea' }}>
                          {apt.appointmentNumber || 'N/A'}
                        </strong>
                      </td>
                      <td>
                        <div>
                          <div style={{ fontWeight: '500' }}>
                            {apt.patientId?.name || 'N/A'}
                          </div>
                          {apt.patientId?.phone && (
                            <small style={{ color: '#6b7280' }}>
                              {apt.patientId.phone}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>{formatDate(apt.appointmentDate)}</td>
                      <td>{formatTime(apt.appointmentDate, apt.timeSlot)}</td>
                      <td>{serialNumber || 'N/A'}</td>
                      <td>{apt.fee ? `${apt.fee} BDT` : 'N/A'}</td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(apt.status)}`}>
                          {apt.status || 'pending'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleViewAppointment(apt)}
                            className="btn-view"
                            title="View Details"
                          >
                            View
                          </button>
                          {getAvailableStatuses(apt.status).length > 1 && (
                            <select
                              value={apt.status}
                              onChange={(e) => handleStatusChange(apt._id, e.target.value)}
                              className="status-select"
                              disabled={loading}
                            >
                              {getAvailableStatuses(apt.status).map(status => (
                                <option key={status} value={status}>
                                  {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1 || loading}
                className="pagination-button"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.pages || loading}
                className="pagination-button"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Serial Settings Tab Component
const SerialSettingsTab = ({ serialSettings, fetchSerialSettings, setSuccess, setError }) => {
  const [formData, setFormData] = useState({
    totalSerialsPerDay: 20,
    serialTimeRange: {
      startTime: '09:00',
      endTime: '17:00'
    },
    appointmentPrice: 500,
    availableDays: [1, 2, 3, 4, 5],
    isActive: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (serialSettings) {
      setFormData({
        totalSerialsPerDay: serialSettings.totalSerialsPerDay || 20,
        serialTimeRange: serialSettings.serialTimeRange || { startTime: '09:00', endTime: '17:00' },
        appointmentPrice: serialSettings.appointmentPrice || 500,
        availableDays: serialSettings.availableDays || [1, 2, 3, 4, 5],
        isActive: serialSettings.isActive !== undefined ? serialSettings.isActive : true
      });
    } else {
      // Reset to defaults when serialSettings is null (no settings exist yet)
      setFormData({
        totalSerialsPerDay: 20,
        serialTimeRange: { startTime: '09:00', endTime: '17:00' },
        appointmentPrice: 500,
        availableDays: [1, 2, 3, 4, 5],
        isActive: true
      });
    }
  }, [serialSettings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post('/doctor/serial-settings', formData);
      if (response.data.success) {
        setSuccess('Serial settings saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
        fetchSerialSettings();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save serial settings.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDay = (day) => {
    const days = formData.availableDays || [];
    if (days.includes(day)) {
      setFormData({ ...formData, availableDays: days.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, availableDays: [...days, day] });
    }
  };

  const daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  return (
    <div className="serial-settings-section">
      <div className="section-header">
        <h2>Serial Settings</h2>
        <p>Configure your base serial settings for appointments</p>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="form-group">
          <label htmlFor="totalSerialsPerDay">Total Serials Per Day *</label>
          <input
            type="number"
            id="totalSerialsPerDay"
            min="1"
            value={formData.totalSerialsPerDay}
            onChange={(e) => setFormData({ ...formData, totalSerialsPerDay: parseInt(e.target.value) || 1 })}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="startTime">Start Time *</label>
            <input
              type="time"
              id="startTime"
              value={formData.serialTimeRange.startTime}
              onChange={(e) => setFormData({
                ...formData,
                serialTimeRange: { ...formData.serialTimeRange, startTime: e.target.value }
              })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="endTime">End Time *</label>
            <input
              type="time"
              id="endTime"
              value={formData.serialTimeRange.endTime}
              onChange={(e) => setFormData({
                ...formData,
                serialTimeRange: { ...formData.serialTimeRange, endTime: e.target.value }
              })}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="appointmentPrice">Appointment Price (BDT) *</label>
          <input
            type="number"
            id="appointmentPrice"
            min="0"
            step="0.01"
            value={formData.appointmentPrice}
            onChange={(e) => setFormData({ ...formData, appointmentPrice: parseFloat(e.target.value) || 0 })}
            required
          />
        </div>

        <div className="form-group">
          <label>Available Days *</label>
          <div className="days-selector">
            {daysOfWeek.map(day => (
              <label key={day.value} className="day-checkbox">
                <input
                  type="checkbox"
                  checked={formData.availableDays?.includes(day.value)}
                  onChange={() => toggleDay(day.value)}
                />
                <span>{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            />
            <span>Active (Enable serial booking)</span>
          </label>
        </div>

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
};

// Date Management Tab Component
const DateManagementTab = ({ serialSettings, setSuccess, setError }) => {
  const [dateSerialSettings, setDateSerialSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFormData, setDateFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    totalSerialsPerDay: serialSettings?.totalSerialsPerDay || 20,
    startTime: serialSettings?.serialTimeRange?.startTime || '09:00',
    endTime: serialSettings?.serialTimeRange?.endTime || '17:00',
    adminNote: '',
    isEnabled: true
  });
  const [editingDate, setEditingDate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingDateSettings, setFetchingDateSettings] = useState(false);

  useEffect(() => {
    if (serialSettings) {
      setDateFormData(prev => ({
        ...prev,
        totalSerialsPerDay: serialSettings.totalSerialsPerDay || 20,
        startTime: serialSettings.serialTimeRange?.startTime || '09:00',
        endTime: serialSettings.serialTimeRange?.endTime || '17:00'
      }));
      fetchDateSerialSettings();
    }
  }, [serialSettings]);

  // Fetch settings for selected date when date changes
  const handleDateChange = async (selectedDate) => {
    setDateFormData(prev => ({ ...prev, date: selectedDate }));
    
    // Check if there are existing settings for this date
    const existingSetting = dateSerialSettings.find(
      setting => setting.date === selectedDate
    );
    
    if (existingSetting) {
      // Load existing settings into form
      setEditingDate(existingSetting);
      setDateFormData({
        date: existingSetting.date,
        totalSerialsPerDay: existingSetting.totalSerialsPerDay,
        startTime: existingSetting.serialTimeRange?.startTime || serialSettings?.serialTimeRange?.startTime || '09:00',
        endTime: existingSetting.serialTimeRange?.endTime || serialSettings?.serialTimeRange?.endTime || '17:00',
        adminNote: existingSetting.adminNote || '',
        isEnabled: existingSetting.isEnabled
      });
    } else {
      // Reset form for new date
      setEditingDate(null);
      setDateFormData(prev => ({
        ...prev,
        date: selectedDate,
        totalSerialsPerDay: serialSettings?.totalSerialsPerDay || 20,
        startTime: serialSettings?.serialTimeRange?.startTime || '09:00',
        endTime: serialSettings?.serialTimeRange?.endTime || '17:00',
        adminNote: '',
        isEnabled: true
      }));
    }
  };

  const fetchDateSerialSettings = async () => {
    if (!serialSettings) return;
    
    setLoading(true);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 60);
      
      const response = await api.get('/doctor/date-serial-settings', {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }
      });
      
      if (response.data.success) {
        setDateSerialSettings(response.data.data.dateSerialSettings || []);
      }
    } catch (err) {
      console.error('Error fetching date serial settings:', err);
      if (err.response?.status === 404) {
        setDateSerialSettings([]);
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Authentication failed. Please log in again.');
      } else {
        setError(err.response?.data?.message || 'Failed to load date serial settings.');
      }
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSubmit = async (e) => {
    e.preventDefault();
    if (!serialSettings) {
      setError('Please configure base serial settings first.');
      setTimeout(() => setError(''), 5000);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        date: dateFormData.date,
        totalSerialsPerDay: dateFormData.totalSerialsPerDay,
        adminNote: dateFormData.adminNote || null,
        isEnabled: dateFormData.isEnabled
      };

      if (dateFormData.startTime && dateFormData.endTime) {
        payload.serialTimeRange = {
          startTime: dateFormData.startTime,
          endTime: dateFormData.endTime
        };
      }

      const response = await api.post('/doctor/date-serial-settings', payload);
      
      if (response.data.success) {
        setSuccess('Date serial settings saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
        fetchDateSerialSettings();
        // Reset form
        setDateFormData({
          date: new Date().toISOString().split('T')[0],
          totalSerialsPerDay: serialSettings?.totalSerialsPerDay || 20,
          startTime: serialSettings?.serialTimeRange?.startTime || '09:00',
          endTime: serialSettings?.serialTimeRange?.endTime || '17:00',
          adminNote: '',
          isEnabled: true
        });
        setEditingDate(null);
      }
    } catch (err) {
      console.error('Error saving date serial settings:', err);
      setError(err.response?.data?.message || 'Failed to save date serial settings.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  if (!serialSettings) {
    return (
      <div className="date-management-section">
        <div className="empty-state">
          <p>Please configure base serial settings first before managing dates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="date-management-section">
      <div className="section-header">
        <h2>Date Management</h2>
        <p>Manage serial settings for specific dates</p>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading date settings...</p>
        </div>
      )}

      {dateSerialSettings.length > 0 && (
        <div className="date-settings-list">
          <h3>Configured Dates</h3>
          <div className="settings-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total Serials</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dateSerialSettings.map((setting, index) => (
                  <tr key={index}>
                    <td>{new Date(setting.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td>{setting.totalSerialsPerDay}</td>
                    <td>
                      <span className={`status-badge ${setting.isEnabled ? 'status-active' : 'status-inactive'}`}>
                        {setting.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>{setting.adminNote || '-'}</td>
                    <td>
                      <button
                        onClick={() => {
                          setEditingDate(setting);
                          setDateFormData({
                            date: setting.date,
                            totalSerialsPerDay: setting.totalSerialsPerDay,
                            adminNote: setting.adminNote || '',
                            isEnabled: setting.isEnabled
                          });
                        }}
                        className="btn-edit"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <form onSubmit={handleDateSubmit} className="date-form">
        <div className="form-row">
          <div className="form-group">
            <label>Select Date *</label>
            <input
              type="date"
              value={dateFormData.date}
              onChange={(e) => handleDateChange(e.target.value)}
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
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Start Time (Time Slot)</label>
            <input
              type="time"
              value={dateFormData.startTime}
              onChange={(e) => setDateFormData({ ...dateFormData, startTime: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>End Time (Time Slot)</label>
            <input
              type="time"
              value={dateFormData.endTime}
              onChange={(e) => setDateFormData({ ...dateFormData, endTime: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Admin Note</label>
          <textarea
            value={dateFormData.adminNote}
            onChange={(e) => setDateFormData({ ...dateFormData, adminNote: e.target.value })}
            rows="3"
            placeholder="Optional note for this date..."
            maxLength={500}
          />
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={dateFormData.isEnabled}
              onChange={(e) => setDateFormData({ ...dateFormData, isEnabled: e.target.checked })}
            />
            <span>Enable booking for this date</span>
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : editingDate ? 'Update Date Settings' : 'Add Date'}
          </button>
          {editingDate && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEditingDate(null);
                setDateFormData({
                  date: new Date().toISOString().split('T')[0],
                  totalSerialsPerDay: serialSettings?.totalSerialsPerDay || 20,
                  startTime: serialSettings?.serialTimeRange?.startTime || '09:00',
                  endTime: serialSettings?.serialTimeRange?.endTime || '17:00',
                  adminNote: '',
                  isEnabled: true
                });
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

// Schedule Tab Component
const ScheduleTab = ({ schedules, fetchSchedules, setSuccess, setError }) => {
  const [loading, setLoading] = useState(false);

  const daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  return (
    <div className="schedule-section">
      <div className="section-header">
        <h2>Weekly Schedule</h2>
        <p>Manage your weekly availability schedule</p>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner"></div>
          <p>Loading schedule...</p>
        </div>
      ) : schedules.length === 0 ? (
        <div className="empty-state">
          <p>No schedule configured. Please set up your weekly schedule.</p>
        </div>
      ) : (
        <div className="schedule-list">
          {schedules.map((schedule) => (
            <div key={schedule._id} className="schedule-item">
              <div className="schedule-day">
                <strong>{daysOfWeek.find(d => d.value === schedule.dayOfWeek)?.label || 'Unknown'}</strong>
              </div>
              <div className="schedule-times">
                {schedule.timeSlots?.map((slot, idx) => (
                  <span key={idx} className="time-slot">
                    {slot.startTime} - {slot.endTime}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Profile Tab Component
const ProfileTab = ({ doctorProfile, fetchDoctorProfile, setSuccess, setError }) => {
  const [formData, setFormData] = useState({
    description: '',
    qualifications: '',
    followUpFee: '',
    reportFee: '',
    profilePhotoUrl: '',
    emergencyAvailability: {
      available: false,
      contactNumber: '',
      notes: ''
    },
    socialLinks: {
      facebook: '',
      twitter: '',
      linkedin: '',
      instagram: '',
      website: ''
    },
    holidays: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: '', reason: '' });

  useEffect(() => {
    if (doctorProfile) {
      setFormData({
        description: doctorProfile.description || doctorProfile.bio || '',
        qualifications: doctorProfile.qualifications || '',
        followUpFee: doctorProfile.followUpFee || '',
        reportFee: doctorProfile.reportFee || '',
        profilePhotoUrl: doctorProfile.profilePhotoUrl || '',
        emergencyAvailability: doctorProfile.emergencyAvailability || {
          available: false,
          contactNumber: '',
          notes: ''
        },
        socialLinks: doctorProfile.socialLinks || {
          facebook: '',
          twitter: '',
          linkedin: '',
          instagram: '',
          website: ''
        },
        holidays: doctorProfile.holidays || []
      });
    }
  }, [doctorProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.put('/doctor/profile', formData);
      if (response.data.success) {
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
        fetchDoctorProfile();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEmergencyChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      emergencyAvailability: {
        ...prev.emergencyAvailability,
        [field]: value
      }
    }));
  };

  const handleSocialLinkChange = (platform, value) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [platform]: value
      }
    }));
  };

  const addHoliday = () => {
    if (newHoliday.date) {
      setFormData(prev => ({
        ...prev,
        holidays: [...prev.holidays, {
          date: newHoliday.date,
          reason: newHoliday.reason || ''
        }]
      }));
      setNewHoliday({ date: '', reason: '' });
      setAddingHoliday(false);
    }
  };

  const removeHoliday = (index) => {
    setFormData(prev => ({
      ...prev,
      holidays: prev.holidays.filter((_, i) => i !== index)
    }));
  };

  if (!doctorProfile) {
    return (
      <div className="profile-section">
        <div className="empty-state">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-section">
      <div className="section-header">
        <h2>Profile Management</h2>
        <p>Update your profile information</p>
      </div>

      {doctorProfile.status !== 'approved' && (
        <div className="info-banner" style={{ background: '#fef3c7', borderColor: '#fbbf24', color: '#92400e' }}>
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p>Your profile can only be updated after admin approval. Current status: {doctorProfile.status}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-section">
          <h3>Basic Information</h3>
          <div className="form-group">
            <label htmlFor="description">Description / Bio</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="5"
              placeholder="Tell patients about yourself, your experience, and expertise..."
              maxLength={2000}
              disabled={doctorProfile.status !== 'approved'}
            />
            <small>{formData.description.length}/2000 characters</small>
          </div>

          <div className="form-group">
            <label htmlFor="qualifications">Qualifications</label>
            <textarea
              id="qualifications"
              name="qualifications"
              value={formData.qualifications}
              onChange={handleChange}
              rows="3"
              placeholder="MBBS, MD, PhD, etc."
              disabled={doctorProfile.status !== 'approved'}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Fees</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="followUpFee">Follow-up Fee (BDT)</label>
              <input
                type="number"
                id="followUpFee"
                name="followUpFee"
                value={formData.followUpFee}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0"
                disabled={doctorProfile.status !== 'approved'}
              />
            </div>
            <div className="form-group">
              <label htmlFor="reportFee">Report Fee (BDT)</label>
              <input
                type="number"
                id="reportFee"
                name="reportFee"
                value={formData.reportFee}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0"
                disabled={doctorProfile.status !== 'approved'}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Profile Photo</h3>
          <div className="form-group">
            <label htmlFor="profilePhotoUrl">Profile Photo URL</label>
            <input
              type="url"
              id="profilePhotoUrl"
              name="profilePhotoUrl"
              value={formData.profilePhotoUrl}
              onChange={handleChange}
              placeholder="https://example.com/photo.jpg"
              disabled={doctorProfile.status !== 'approved'}
            />
            {formData.profilePhotoUrl && (
              <div className="profile-photo-preview">
                <img src={formData.profilePhotoUrl} alt="Profile" onError={(e) => e.target.style.display = 'none'} />
              </div>
            )}
          </div>
        </div>

        <div className="form-section">
          <h3>Emergency Availability</h3>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.emergencyAvailability.available}
                onChange={(e) => handleEmergencyChange('available', e.target.checked)}
                disabled={doctorProfile.status !== 'approved'}
              />
              <span>Available for emergency consultations</span>
            </label>
          </div>
          {formData.emergencyAvailability.available && (
            <>
              <div className="form-group">
                <label htmlFor="emergencyContact">Emergency Contact Number</label>
                <input
                  type="tel"
                  id="emergencyContact"
                  value={formData.emergencyAvailability.contactNumber}
                  onChange={(e) => handleEmergencyChange('contactNumber', e.target.value)}
                  placeholder="+1234567890"
                  disabled={doctorProfile.status !== 'approved'}
                />
              </div>
              <div className="form-group">
                <label htmlFor="emergencyNotes">Emergency Notes</label>
                <textarea
                  id="emergencyNotes"
                  value={formData.emergencyAvailability.notes}
                  onChange={(e) => handleEmergencyChange('notes', e.target.value)}
                  rows="3"
                  placeholder="Additional information about emergency availability..."
                  disabled={doctorProfile.status !== 'approved'}
                />
              </div>
            </>
          )}
        </div>

        <div className="form-section">
          <h3>Social Links</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="facebook">Facebook</label>
              <input
                type="url"
                id="facebook"
                value={formData.socialLinks.facebook}
                onChange={(e) => handleSocialLinkChange('facebook', e.target.value)}
                placeholder="https://facebook.com/yourprofile"
                disabled={doctorProfile.status !== 'approved'}
              />
            </div>
            <div className="form-group">
              <label htmlFor="twitter">Twitter</label>
              <input
                type="url"
                id="twitter"
                value={formData.socialLinks.twitter}
                onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
                placeholder="https://twitter.com/yourprofile"
                disabled={doctorProfile.status !== 'approved'}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="linkedin">LinkedIn</label>
              <input
                type="url"
                id="linkedin"
                value={formData.socialLinks.linkedin}
                onChange={(e) => handleSocialLinkChange('linkedin', e.target.value)}
                placeholder="https://linkedin.com/in/yourprofile"
                disabled={doctorProfile.status !== 'approved'}
              />
            </div>
            <div className="form-group">
              <label htmlFor="instagram">Instagram</label>
              <input
                type="url"
                id="instagram"
                value={formData.socialLinks.instagram}
                onChange={(e) => handleSocialLinkChange('instagram', e.target.value)}
                placeholder="https://instagram.com/yourprofile"
                disabled={doctorProfile.status !== 'approved'}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="website">Website</label>
            <input
              type="url"
              id="website"
              value={formData.socialLinks.website}
              onChange={(e) => handleSocialLinkChange('website', e.target.value)}
              placeholder="https://yourwebsite.com"
              disabled={doctorProfile.status !== 'approved'}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Holidays</h3>
          <div className="holidays-list">
            {formData.holidays.map((holiday, index) => (
              <div key={index} className="holiday-item">
                <div className="holiday-date">
                  {new Date(holiday.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                <div className="holiday-reason">{holiday.reason || 'No reason specified'}</div>
                {doctorProfile.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => removeHoliday(index)}
                    className="btn-remove"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {doctorProfile.status === 'approved' && (
            <div className="add-holiday-section">
              {!addingHoliday ? (
                <button
                  type="button"
                  onClick={() => setAddingHoliday(true)}
                  className="btn-add-holiday"
                >
                  + Add Holiday
                </button>
              ) : (
                <div className="add-holiday-form">
                  <input
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <input
                    type="text"
                    value={newHoliday.reason}
                    onChange={(e) => setNewHoliday({ ...newHoliday, reason: e.target.value })}
                    placeholder="Reason (optional)"
                  />
                  <button type="button" onClick={addHoliday} className="btn-add">Add</button>
                  <button type="button" onClick={() => { setAddingHoliday(false); setNewHoliday({ date: '', reason: '' }); }} className="btn-cancel">Cancel</button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={submitting || doctorProfile.status !== 'approved'}
        >
          {submitting ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
};

// Appointment View Modal Component
const AppointmentViewModal = ({
  appointment,
  onClose,
  handleStatusChange,
  getStatusBadgeClass,
  getAvailableStatuses,
  formatDate,
  formatTime,
  loading
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Appointment Details</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="detail-section">
            <h3>Appointment Information</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Appointment Number:</span>
                <span className="detail-value">{appointment.appointmentNumber || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Date:</span>
                <span className="detail-value">{formatDate(appointment.appointmentDate)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Time:</span>
                <span className="detail-value">{formatTime(appointment.appointmentDate, appointment.timeSlot)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Status:</span>
                <span className={`status-badge ${getStatusBadgeClass(appointment.status)}`}>
                  {appointment.status || 'pending'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Fee:</span>
                <span className="detail-value">{appointment.fee ? `${appointment.fee} BDT` : 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h3>Patient Information</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{appointment.patientId?.name || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{appointment.patientId?.email || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Phone:</span>
                <span className="detail-value">{appointment.patientId?.phone || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Gender:</span>
                <span className="detail-value">{appointment.patientId?.gender || 'N/A'}</span>
              </div>
              {appointment.patientId?.dateOfBirth && (
                <div className="detail-item">
                  <span className="detail-label">Date of Birth:</span>
                  <span className="detail-value">{formatDate(appointment.patientId.dateOfBirth)}</span>
                </div>
              )}
            </div>
          </div>

          {appointment.notes && (
            <div className="detail-section">
              <h3>Notes</h3>
              <p className="notes-text">{appointment.notes}</p>
            </div>
          )}

          <div className="detail-section">
            <h3>Change Status</h3>
            <select
              value={appointment.status}
              onChange={(e) => handleStatusChange(appointment._id, e.target.value)}
              className="status-select-full"
              disabled={loading}
            >
              {getAvailableStatuses(appointment.status).map(status => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
