import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import Navbar from '../components/Navbar';
import AdminTeamTab from '../components/AdminTeamTab';
import {
  canAccess,
  canAccessTab,
  isPlatformAdmin
} from '../utils/superAdminPermissions';
import './SuperAdminDashboard.css';

const DASHBOARD_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'pending', label: 'Pending Approvals' },
  { key: 'banners', label: 'Banners' },
  { key: 'notifications', label: 'Broadcast' },
  { key: 'users', label: 'Users' },
  { key: 'doctors', label: 'Doctors' },
  { key: 'hospitals', label: 'Hospitals' },
  { key: 'diagnostic-centers', label: 'Diagnostic Centers' },
  { key: 'activity-logs', label: 'Activity Logs' },
  { key: 'export', label: 'Export Data' },
  { key: 'team', label: 'Admin Team' }
];

const SuperAdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [pendingItems, setPendingItems] = useState(null);
  const [banners, setBanners] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPagination, setUsersPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0, activeUsers: 0, inactiveUsers: 0 });
  const [usersFilters, setUsersFilters] = useState({ search: '', isActive: 'true', sortBy: 'createdAt', sortOrder: 'desc' });
  const [viewingUser, setViewingUser] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [doctorsPagination, setDoctorsPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [doctorsFilters, setDoctorsFilters] = useState({ search: '', status: '', specialization: '', sortBy: 'createdAt', sortOrder: 'desc' });
  const [doctorSpecializations, setDoctorSpecializations] = useState([]);
  const [individualDoctors, setIndividualDoctors] = useState([]);
  const [individualDoctorsLoading, setIndividualDoctorsLoading] = useState(false);
  const [individualDoctorsPagination, setIndividualDoctorsPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [individualDoctorsFilters, setIndividualDoctorsFilters] = useState({ search: '', status: '', specialization: '', sortBy: 'createdAt', sortOrder: 'desc' });
  const [diagnosticCenters, setDiagnosticCenters] = useState([]);
  const [diagnosticCentersLoading, setDiagnosticCentersLoading] = useState(false);
  const [diagnosticCentersPagination, setDiagnosticCentersPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [diagnosticCentersFilters, setDiagnosticCentersFilters] = useState({ search: '', status: '', sortBy: 'createdAt', sortOrder: 'desc' });
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);
  const [activityLogsPagination, setActivityLogsPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [activityLogsFilters, setActivityLogsFilters] = useState({ action: '', targetType: '', startDate: '', endDate: '' });
  const [userGrowth, setUserGrowth] = useState([]);
  const [recentRegistrations, setRecentRegistrations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [adminMembership, setAdminMembership] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const visibleTabs = useMemo(
    () => DASHBOARD_TABS.filter((tab) => canAccessTab(permissions, tab.key)),
    [permissions]
  );

  // Notification form
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    targetRoles: []
  });

  // Banner form
  const [bannerForm, setBannerForm] = useState({
    title: '',
    link: '',
    order: 0,
    startDate: '',
    endDate: '',
    isActive: true
  });
  const [bannerImage, setBannerImage] = useState(null);
  const [editingBanner, setEditingBanner] = useState(null);

  // Hospital form
  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    registrationNumber: '',
    contactInfo: {
      phone: '',
      email: '',
      website: ''
    },
    departments: [],
    facilities: [],
    services: []
  });
  const [editingHospital, setEditingHospital] = useState(null);

  // User form
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'patient',
    isActive: true,
    isVerified: false
  });
  const [editingUser, setEditingUser] = useState(null);

  // Doctor form
  const [doctorForm, setDoctorForm] = useState({
    name: '',
    email: '',
    phone: '',
    medicalLicenseNumber: '',
    specialization: '',
    experienceYears: 0,
    status: 'approved'
  });
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [viewingDoctor, setViewingDoctor] = useState(null);

  // Diagnostic Center form
  const [diagnosticCenterForm, setDiagnosticCenterForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    ownerName: '',
    ownerPhone: '',
    tradeLicenseNumber: ''
  });
  const [editingDiagnosticCenter, setEditingDiagnosticCenter] = useState(null);

  useEffect(() => {
    if (!user || !isPlatformAdmin(user.role)) {
      navigate('/super-admin/login');
      return;
    }
    initAdminContext();
  }, [user]);

  useEffect(() => {
    if (!permissions.length || !visibleTabs.length) return;
    if (!canAccessTab(permissions, activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [permissions, visibleTabs, activeTab]);

  useEffect(() => {
    if (user && isPlatformAdmin(user.role) && canAccessTab(permissions, 'overview')) {
      fetchDashboardStats();
    }
  }, [user, permissions]);

  const initAdminContext = async () => {
    try {
      const saved = localStorage.getItem('adminAccess');
      if (saved) {
        const access = JSON.parse(saved);
        if (access.permissions?.length) {
          setPermissions(access.permissions);
          setAdminMembership(access);
        }
      }
      const response = await api.get('/admin/team/access');
      if (response.data.success) {
        const { permissions: perms, membership } = response.data.data;
        setPermissions(perms || []);
        setAdminMembership(membership);
        localStorage.setItem('adminAccess', JSON.stringify({
          role: membership?.role || 'owner',
          roleLabel: membership?.roleLabel,
          permissions: perms,
          isOwner: response.data.data.isOwner
        }));
      }
    } catch (err) {
      console.error('Failed to load admin access:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isPlatformAdmin(user.role)) {
      if (activeTab === 'pending') fetchPendingItems();
      if (activeTab === 'banners') fetchBanners();
      if (activeTab === 'hospitals') fetchHospitals();
      if (activeTab === 'users') fetchUsers();
      if (activeTab === 'doctors') fetchDoctors();
      if (activeTab === 'diagnostic-centers') fetchDiagnosticCenters();
      if (activeTab === 'activity-logs') fetchActivityLogs();
    }
  }, [activeTab, user, permissions, usersFilters, doctorsFilters, diagnosticCentersFilters, activityLogsFilters, usersPagination.page, doctorsPagination.page, diagnosticCentersPagination.page, activityLogsPagination.page]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/dashboard/stats');
      if (response.data.success) {
        setDashboardStats(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError('Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingItems = async () => {
    try {
      const response = await api.get('/admin/pending');
      if (response.data.success) {
        setPendingItems(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching pending items:', err);
      setError('Failed to load pending items.');
    }
  };

  const fetchBanners = async () => {
    try {
      const response = await api.get('/admin/banners');
      if (response.data.success) {
        setBanners(response.data.data.banners || []);
      }
    } catch (err) {
      console.error('Error fetching banners:', err);
    }
  };

  const fetchHospitals = async () => {
    try {
      setHospitalsLoading(true);
      setError(''); // Clear previous errors
      const response = await api.get('/admin/hospitals');
      console.log('Hospitals API response:', response.data);
      if (response.data.success) {
        setHospitals(response.data.data.hospitals || []);
      } else {
        setError(response.data.message || 'Failed to load hospitals.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error('Error fetching hospitals:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load hospitals. Please check your connection.';
      setError(errorMessage);
      setTimeout(() => setError(''), 5000);
    } finally {
      setHospitalsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      setError('');
      // Build params - ensure role is always 'patient' and not overridden
      const params = {
        page: usersPagination.page,
        limit: usersPagination.limit,
        ...usersFilters,
        role: 'patient' // Ensure role is always patient
      };
      // If isActive is empty string (All Status), remove it from params to show all
      if (params.isActive === '') {
        delete params.isActive;
      }
      const response = await api.get('/admin/users', { params });
      if (response.data.success) {
        const fetchedUsers = response.data.data.users || [];
        setUsers(fetchedUsers);
        setUsersPagination(prev => ({ ...prev, ...response.data.data.pagination }));
      } else {
        setError(response.data.message || 'Failed to load users.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.response?.data?.message || 'Failed to load users.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      setDoctorsLoading(true);
      setError('');
      const params = {
        page: doctorsPagination.page,
        limit: doctorsPagination.limit,
        ...doctorsFilters
      };
      const response = await api.get('/admin/doctors', { params });
      if (response.data.success) {
        setDoctors(response.data.data.doctors || []);
        setDoctorsPagination(prev => ({ ...prev, ...response.data.data.pagination }));
        if (response.data.data.specializations) {
          setDoctorSpecializations(response.data.data.specializations);
        }
      } else {
        setError(response.data.message || 'Failed to load doctors.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
      setError(err.response?.data?.message || 'Failed to load doctors.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setDoctorsLoading(false);
    }
  };

  const fetchDiagnosticCenters = async () => {
    try {
      setDiagnosticCentersLoading(true);
      setError('');
      const params = {
        page: diagnosticCentersPagination.page,
        limit: diagnosticCentersPagination.limit,
        ...diagnosticCentersFilters
      };
      const response = await api.get('/admin/diagnostic-centers', { params });
      if (response.data.success) {
        setDiagnosticCenters(response.data.data.diagnosticCenters || []);
        setDiagnosticCentersPagination(prev => ({ ...prev, ...response.data.data.pagination }));
      } else {
        setError(response.data.message || 'Failed to load diagnostic centers.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error('Error fetching diagnostic centers:', err);
      setError(err.response?.data?.message || 'Failed to load diagnostic centers.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setDiagnosticCentersLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      setActivityLogsLoading(true);
      setError('');
      const params = {
        page: activityLogsPagination.page,
        limit: activityLogsPagination.limit,
        ...activityLogsFilters
      };
      const response = await api.get('/admin/activity-logs', { params });
      if (response.data.success) {
        setActivityLogs(response.data.data.logs || []);
        setActivityLogsPagination(prev => ({ ...prev, ...response.data.data.pagination }));
      } else {
        setError(response.data.message || 'Failed to load activity logs.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError(err.response?.data?.message || 'Failed to load activity logs.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setActivityLogsLoading(false);
    }
  };

  const handleApprove = async (type, id, reason = '') => {
    try {
      const response = await api.post(`/admin/approve/${type}/${id}`, { reason });
      if (response.data.success) {
        setSuccess(`${type} approved successfully.`);
        fetchPendingItems();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to approve ${type}.`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleReject = async (type, id, reason) => {
    if (!reason || reason.trim() === '') {
      setError('Rejection reason is required.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    try {
      const response = await api.post(`/admin/reject/${type}/${id}`, { reason });
      if (response.data.success) {
        setSuccess(`${type} rejected successfully.`);
        fetchPendingItems();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to reject ${type}.`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleBroadcastNotification = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/admin/notifications/broadcast', notificationForm);
      if (response.data.success) {
        setSuccess(`Notification broadcasted to ${response.data.data.count} users.`);
        setNotificationForm({ title: '', message: '', targetRoles: [] });
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to broadcast notification.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleExportData = async (type, format = 'csv') => {
    try {
      const response = await api.get(`/admin/export?type=${type}&format=${format}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSuccess(`Data exported successfully as ${format.toUpperCase()}.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to export data.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleCreateBanner = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('title', bannerForm.title);
      formData.append('link', bannerForm.link || '');
      formData.append('order', bannerForm.order.toString());
      if (bannerForm.startDate) formData.append('startDate', bannerForm.startDate);
      if (bannerForm.endDate) formData.append('endDate', bannerForm.endDate);
      if (bannerImage) formData.append('banner', bannerImage);

      const response = await api.post('/admin/banners', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setSuccess('Banner created successfully.');
        setBannerForm({ title: '', link: '', order: 0, startDate: '', endDate: '', isActive: true });
        setBannerImage(null);
        fetchBanners();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create banner.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleUpdateBanner = async (bannerId) => {
    try {
      const formData = new FormData();
      Object.keys(bannerForm).forEach(key => {
        if (bannerForm[key] !== null && bannerForm[key] !== undefined) {
          formData.append(key, bannerForm[key]);
        }
      });
      if (bannerImage) formData.append('banner', bannerImage);

      const response = await api.put(`/admin/banners/${bannerId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setSuccess('Banner updated successfully.');
        setEditingBanner(null);
        setBannerForm({ title: '', link: '', order: 0, startDate: '', endDate: '', isActive: true });
        setBannerImage(null);
        fetchBanners();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update banner.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteBanner = async (bannerId) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return;
    try {
      // Note: Delete endpoint might need to be added to backend
      setSuccess('Banner deletion feature - backend endpoint needed.');
      fetchBanners();
    } catch (err) {
      setError('Failed to delete banner.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const startEditBanner = (banner) => {
    setEditingBanner(banner._id);
    setBannerForm({
      title: banner.title || '',
      link: banner.link || '',
      order: banner.order || 0,
      startDate: banner.startDate ? new Date(banner.startDate).toISOString().split('T')[0] : '',
      endDate: banner.endDate ? new Date(banner.endDate).toISOString().split('T')[0] : '',
      isActive: banner.isActive !== undefined ? banner.isActive : true
    });
    setBannerImage(null);
  };

  const handleCreateHospital = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/admin/hospitals', hospitalForm);
      if (response.data.success) {
        setSuccess('Hospital created successfully.');
        setHospitalForm({
          name: '',
          email: '',
          phone: '',
          password: '',
          address: '',
          registrationNumber: '',
          contactInfo: { phone: '', email: '', website: '' },
          departments: [],
          facilities: [],
          services: []
        });
        fetchHospitals();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create hospital.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleUpdateHospital = async (hospitalId) => {
    try {
      const response = await api.put(`/admin/hospitals/${hospitalId}`, hospitalForm);
      if (response.data.success) {
        setSuccess('Hospital updated successfully.');
        setEditingHospital(null);
        setHospitalForm({
          name: '',
          email: '',
          phone: '',
          password: '',
          address: '',
          registrationNumber: '',
          contactInfo: { phone: '', email: '', website: '' },
          departments: [],
          facilities: [],
          services: []
        });
        fetchHospitals();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update hospital.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteHospital = async (hospitalId) => {
    if (!window.confirm('Are you sure you want to delete this hospital? This action cannot be undone.')) return;
    try {
      const response = await api.delete(`/admin/hospitals/${hospitalId}`);
      if (response.data.success) {
        setSuccess('Hospital deleted successfully.');
        fetchHospitals();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete hospital.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const startEditHospital = (hospital) => {
    setEditingHospital(hospital._id);
    setHospitalForm({
      name: hospital.name || '',
      email: hospital.userId?.email || '',
      phone: hospital.userId?.phone || '',
      password: '',
      address: hospital.address || '',
      registrationNumber: hospital.registrationNumber || '',
      contactInfo: hospital.contactInfo || { phone: '', email: '', website: '' },
      departments: hospital.departments || [],
      facilities: hospital.facilities || [],
      services: hospital.services || []
    });
  };

  const handleUpdateDoctor = async (doctorId) => {
    try {
      const response = await api.put(`/admin/doctors/${doctorId}`, doctorForm);
      if (response.data.success) {
        setSuccess('Doctor updated successfully.');
        setEditingDoctor(null);
        setDoctorForm({ name: '', email: '', phone: '', medicalLicenseNumber: '', specialization: '', experienceYears: 0, status: 'approved' });
        fetchDoctors();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update doctor.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteDoctor = async (doctorId) => {
    if (!window.confirm('Are you sure you want to delete this doctor? This action cannot be undone.')) return;
    try {
      const response = await api.delete(`/admin/doctors/${doctorId}`);
      if (response.data.success) {
        setSuccess('Doctor deleted successfully.');
        fetchDoctors();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete doctor.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const startEditDoctor = (doctor) => {
    setEditingDoctor(doctor._id);
    setDoctorForm({
      name: doctor.name || '',
      email: doctor.email || '',
      phone: doctor.phone || '',
      medicalLicenseNumber: doctor.medicalLicenseNumber || '',
      specialization: Array.isArray(doctor.specialization) ? doctor.specialization.join(', ') : (doctor.specialization || ''),
      experienceYears: doctor.experienceYears || 0,
      status: doctor.status || 'approved'
    });
  };

  const handleUpdateUser = async (userId) => {
    try {
      const response = await api.put(`/admin/users/${userId}`, userForm);
      if (response.data.success) {
        setSuccess('Patient updated successfully.');
        setEditingUser(null);
        setUserForm({ name: '', email: '', phone: '', role: 'patient', isActive: true, isVerified: false });
        fetchUsers();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update patient.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this patient? This action cannot be undone.')) return;
    try {
      const response = await api.delete(`/admin/users/${userId}`);
      if (response.data.success) {
        setSuccess('Patient deleted successfully.');
        fetchUsers();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete patient.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleBlockUser = async (userId, isActive) => {
    try {
      const response = await api.put(`/admin/users/${userId}`, { isActive: !isActive });
      if (response.data.success) {
        setSuccess(`Patient ${isActive ? 'blocked' : 'activated'} successfully.`);
        fetchUsers();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update patient status.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const startEditUser = (user) => {
    setEditingUser(user._id);
    setUserForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'patient',
      isActive: user.isActive !== undefined ? user.isActive : true,
      isVerified: user.isVerified !== undefined ? user.isVerified : false
    });
  };

  const handleCreateDiagnosticCenter = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/admin/diagnostic-centers', diagnosticCenterForm);
      if (response.data.success) {
        setSuccess('Diagnostic center created successfully.');
        setDiagnosticCenterForm({ name: '', email: '', phone: '', password: '', address: '', ownerName: '', ownerPhone: '', tradeLicenseNumber: '' });
        fetchDiagnosticCenters();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create diagnostic center.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleUpdateDiagnosticCenter = async (centerId) => {
    try {
      const response = await api.put(`/admin/diagnostic-centers/${centerId}`, diagnosticCenterForm);
      if (response.data.success) {
        setSuccess('Diagnostic center updated successfully.');
        setEditingDiagnosticCenter(null);
        setDiagnosticCenterForm({ name: '', email: '', phone: '', password: '', address: '', ownerName: '', ownerPhone: '', tradeLicenseNumber: '' });
        fetchDiagnosticCenters();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update diagnostic center.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteDiagnosticCenter = async (centerId) => {
    if (!window.confirm('Are you sure you want to delete this diagnostic center? This action cannot be undone.')) return;
    try {
      const response = await api.delete(`/admin/diagnostic-centers/${centerId}`);
      if (response.data.success) {
        setSuccess('Diagnostic center deleted successfully.');
        fetchDiagnosticCenters();
        fetchDashboardStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete diagnostic center.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const startEditDiagnosticCenter = (center) => {
    setEditingDiagnosticCenter(center._id);
    setDiagnosticCenterForm({
      name: center.name || '',
      email: center.userId?.email || center.email || '',
      phone: center.userId?.phone || center.phone || '',
      password: '',
      address: center.address || '',
      ownerName: center.ownerName || '',
      ownerPhone: center.ownerPhone || '',
      tradeLicenseNumber: center.tradeLicenseNumber || ''
    });
  };

  if (loading && !dashboardStats) {
    return (
      <div className="super-admin-dashboard-container">
        <Navbar />
        <div className="dashboard-loading">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = dashboardStats || {};

  return (
    <div className="super-admin-dashboard-container">
      <Navbar />
      
      <div className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Super Admin Dashboard</h1>
            <p className="dashboard-subtitle">
              Welcome back, {user?.name || 'Admin'}
              {adminMembership?.roleLabel && (
                <span className="admin-role-badge"> · {adminMembership.roleLabel}</span>
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
              {tab.label}
              {tab.key === 'pending' && pendingItems && (
                pendingItems.counts?.doctors + pendingItems.counts?.hospitals + pendingItems.counts?.diagnosticCenters > 0
              ) && (
                <span className="badge">
                  {pendingItems.counts.doctors + pendingItems.counts.hospitals + pendingItems.counts.diagnosticCenters}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                  </div>
                  <div className="stat-content">
                    <h3>Total Users</h3>
                    <p className="stat-value">{stats.users?.total || 0}</p>
                    <p className="stat-label">Patients: {stats.users?.patients || 0}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="stat-content">
                    <h3>Doctors</h3>
                    <p className="stat-value">{stats.users?.doctors || 0}</p>
                    <p className="stat-label">Pending: {stats.users?.pendingDoctors || 0}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                  </div>
                  <div className="stat-content">
                    <h3>Hospitals</h3>
                    <p className="stat-value">{stats.users?.hospitals || 0}</p>
                    <p className="stat-label">Pending: {stats.users?.pendingHospitals || 0}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm8 8v2h1v-2h-1zm-2-2H7v6h6v-6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="stat-content">
                    <h3>Diagnostic Centers</h3>
                    <p className="stat-value">{stats.users?.diagnosticCenters || 0}</p>
                    <p className="stat-label">Pending: {stats.users?.pendingDiagnosticCenters || 0}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="stat-content">
                    <h3>Appointments</h3>
                    <p className="stat-value">{stats.appointments?.total || 0}</p>
                    <p className="stat-label">This Month: {stats.appointments?.thisMonth || 0}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                    </svg>
                  </div>
                  <div className="stat-content">
                    <h3>Orders</h3>
                    <p className="stat-value">{stats.orders?.total || 0}</p>
                    <p className="stat-label">This Month: {stats.orders?.thisMonth || 0}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="stat-content">
                    <h3>Revenue</h3>
                    <p className="stat-value">${(stats.revenue?.thisMonth || 0).toLocaleString()}</p>
                    <p className="stat-label">This Month</p>
                  </div>
                </div>

                {/* Active vs Inactive Users */}
                <div className="overview-section">
                  <h2>User Status Overview</h2>
                  <div className="status-overview-grid">
                    <div className="status-card status-active">
                      <h3>Active Users</h3>
                      <p className="status-value">{usersPagination.activeUsers || 0}</p>
                    </div>
                    <div className="status-card status-inactive">
                      <h3>Inactive Users</h3>
                      <p className="status-value">{usersPagination.inactiveUsers || 0}</p>
                    </div>
                  </div>
                </div>

                {/* User Growth Chart */}
                {userGrowth.length > 0 && (
                  <div className="overview-section">
                    <h2>User Growth (Last 12 Months)</h2>
                    <div className="growth-chart-container">
                      <div className="growth-chart">
                        {userGrowth.map((data, index) => {
                          const maxValue = Math.max(...userGrowth.map(d => d.users + d.doctors + d.hospitals + d.diagnosticCenters));
                          const height = maxValue > 0 ? (data.users + data.doctors + data.hospitals + data.diagnosticCenters) / maxValue * 200 : 0;
                          return (
                            <div key={index} className="chart-bar-container">
                              <div className="chart-bar" style={{ height: `${height}px` }}>
                                <div className="chart-bar-segment" style={{ height: `${(data.users / (data.users + data.doctors + data.hospitals + data.diagnosticCenters || 1)) * 100}%`, background: '#667eea' }}></div>
                                <div className="chart-bar-segment" style={{ height: `${(data.doctors / (data.users + data.doctors + data.hospitals + data.diagnosticCenters || 1)) * 100}%`, background: '#f5576c' }}></div>
                                <div className="chart-bar-segment" style={{ height: `${(data.hospitals / (data.users + data.doctors + data.hospitals + data.diagnosticCenters || 1)) * 100}%`, background: '#4facfe' }}></div>
                                <div className="chart-bar-segment" style={{ height: `${(data.diagnosticCenters / (data.users + data.doctors + data.hospitals + data.diagnosticCenters || 1)) * 100}%`, background: '#a8edea' }}></div>
                              </div>
                              <span className="chart-label">{data.month}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="chart-legend">
                        <div className="legend-item"><span className="legend-color" style={{ background: '#667eea' }}></span> Users</div>
                        <div className="legend-item"><span className="legend-color" style={{ background: '#f5576c' }}></span> Doctors</div>
                        <div className="legend-item"><span className="legend-color" style={{ background: '#4facfe' }}></span> Hospitals</div>
                        <div className="legend-item"><span className="legend-color" style={{ background: '#a8edea' }}></span> Diagnostic Centers</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Registrations */}
                {recentRegistrations && (
                  <div className="overview-section">
                    <h2>Recent Registrations</h2>
                    <div className="recent-registrations-grid">
                      <div className="recent-card">
                        <h3>Recent Users ({recentRegistrations.users?.length || 0})</h3>
                        <div className="recent-list">
                          {recentRegistrations.users?.slice(0, 5).map((user) => (
                            <div key={user._id} className="recent-item">
                              <span>{user.name}</span>
                              <span className="recent-date">{new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="recent-card">
                        <h3>Recent Doctors ({recentRegistrations.doctors?.length || 0})</h3>
                        <div className="recent-list">
                          {recentRegistrations.doctors?.slice(0, 5).map((doctor) => (
                            <div key={doctor._id} className="recent-item">
                              <span>{doctor.name}</span>
                              <span className="recent-date">{new Date(doctor.createdAt).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="recent-card">
                        <h3>Recent Hospitals ({recentRegistrations.hospitals?.length || 0})</h3>
                        <div className="recent-list">
                          {recentRegistrations.hospitals?.slice(0, 5).map((hospital) => (
                            <div key={hospital._id} className="recent-item">
                              <span>{hospital.name}</span>
                              <span className="recent-date">{new Date(hospital.createdAt).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="recent-card">
                        <h3>Recent Diagnostic Centers ({recentRegistrations.diagnosticCenters?.length || 0})</h3>
                        <div className="recent-list">
                          {recentRegistrations.diagnosticCenters?.slice(0, 5).map((center) => (
                            <div key={center._id} className="recent-item">
                              <span>{center.name}</span>
                              <span className="recent-date">{new Date(center.createdAt).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'pending' && (
            <div className="pending-tab">
              {pendingItems ? (
                <>
                  <div className="pending-section">
                    <h2>Pending Doctors ({pendingItems.counts?.doctors || 0})</h2>
                    {pendingItems.pendingDoctors?.length > 0 ? (
                      <div className="pending-list">
                        {pendingItems.pendingDoctors.map((doctor) => (
                          <div key={doctor._id} className="pending-item">
                            <div className="pending-item-info">
                              <h3>{doctor.name}</h3>
                              <p>Email: {doctor.email}</p>
                              <p>Specialization: {doctor.specialization || 'N/A'}</p>
                              <p>Status: {doctor.status}</p>
                            </div>
                            <div className="pending-item-actions">
                              <button 
                                className="btn-approve"
                                onClick={() => handleApprove('doctor', doctor._id)}
                              >
                                Approve
                              </button>
                              <button 
                                className="btn-reject"
                                onClick={() => {
                                  const reason = prompt('Enter rejection reason:');
                                  if (reason) handleReject('doctor', doctor._id, reason);
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-items">No pending doctors</p>
                    )}
                  </div>

                  <div className="pending-section">
                    <h2>Pending Hospitals ({pendingItems.counts?.hospitals || 0})</h2>
                    {pendingItems.pendingHospitals?.length > 0 ? (
                      <div className="pending-list">
                        {pendingItems.pendingHospitals.map((hospital) => (
                          <div key={hospital._id} className="pending-item">
                            <div className="pending-item-info">
                              <h3>{hospital.name || hospital.facilityName}</h3>
                              <p>Email: {hospital.userId?.email || 'N/A'}</p>
                              <p>Phone: {hospital.userId?.phone || 'N/A'}</p>
                              <p>Status: {hospital.status}</p>
                            </div>
                            <div className="pending-item-actions">
                              <button 
                                className="btn-approve"
                                onClick={() => handleApprove('hospital', hospital._id)}
                              >
                                Approve
                              </button>
                              <button 
                                className="btn-reject"
                                onClick={() => {
                                  const reason = prompt('Enter rejection reason:');
                                  if (reason) handleReject('hospital', hospital._id, reason);
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-items">No pending hospitals</p>
                    )}
                  </div>

                  <div className="pending-section">
                    <h2>Pending Diagnostic Centers ({pendingItems.counts?.diagnosticCenters || 0})</h2>
                    {pendingItems.pendingDiagnosticCenters?.length > 0 ? (
                      <div className="pending-list">
                        {pendingItems.pendingDiagnosticCenters.map((center) => (
                          <div key={center._id} className="pending-item">
                            <div className="pending-item-info">
                              <h3>{center.name}</h3>
                              <p>Email: {center.userId?.email || 'N/A'}</p>
                              <p>Phone: {center.userId?.phone || 'N/A'}</p>
                              <p>Status: {center.status}</p>
                            </div>
                            <div className="pending-item-actions">
                              <button 
                                className="btn-approve"
                                onClick={() => handleApprove('diagnostic-center', center._id)}
                              >
                                Approve
                              </button>
                              <button 
                                className="btn-reject"
                                onClick={() => {
                                  const reason = prompt('Enter rejection reason:');
                                  if (reason) handleReject('diagnostic-center', center._id, reason);
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-items">No pending diagnostic centers</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading pending items...</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'banners' && (
            <div className="banners-tab">
              <div className="banners-header">
                <h2>Banner Management</h2>
                <button 
                  className="btn-primary"
                  onClick={() => {
                    setEditingBanner(null);
                    setBannerForm({ title: '', link: '', order: 0, startDate: '', endDate: '', isActive: true });
                    setBannerImage(null);
                  }}
                >
                  + Create New Banner
                </button>
              </div>

              <form onSubmit={editingBanner ? (e) => { e.preventDefault(); handleUpdateBanner(editingBanner); } : handleCreateBanner} className="banner-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Title *</label>
                    <input
                      type="text"
                      value={bannerForm.title}
                      onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                      required
                      placeholder="Banner title"
                    />
                  </div>
                  <div className="form-group">
                    <label>Link URL</label>
                    <input
                      type="url"
                      value={bannerForm.link}
                      onChange={(e) => setBannerForm({ ...bannerForm, link: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Order</label>
                    <input
                      type="number"
                      value={bannerForm.order}
                      onChange={(e) => setBannerForm({ ...bannerForm, order: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={bannerForm.startDate}
                      onChange={(e) => setBannerForm({ ...bannerForm, startDate: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input
                      type="date"
                      value={bannerForm.endDate}
                      onChange={(e) => setBannerForm({ ...bannerForm, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Banner Image {!editingBanner && '*'}</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setBannerImage(e.target.files[0])}
                    required={!editingBanner}
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary">
                    {editingBanner ? 'Update Banner' : 'Create Banner'}
                  </button>
                  {editingBanner && (
                    <button 
                      type="button" 
                      className="btn-secondary"
                      onClick={() => {
                        setEditingBanner(null);
                        setBannerForm({ title: '', link: '', order: 0, startDate: '', endDate: '', isActive: true });
                        setBannerImage(null);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="banners-list">
                <h3>Existing Banners ({banners.length})</h3>
                {banners.length > 0 ? (
                  <div className="banners-grid">
                    {banners.map((banner) => (
                      <div key={banner._id} className="banner-card">
                        <div className="banner-image">
                          {banner.image ? (
                            <img src={banner.image} alt={banner.title} />
                          ) : (
                            <div className="no-image">No Image</div>
                          )}
                        </div>
                        <div className="banner-info">
                          <h4>{banner.title}</h4>
                          {banner.link && <p>Link: <a href={banner.link} target="_blank" rel="noopener noreferrer">{banner.link}</a></p>}
                          <p>Order: {banner.order}</p>
                          <p>Status: <span className={banner.isActive ? 'status-active' : 'status-inactive'}>
                            {banner.isActive ? 'Active' : 'Inactive'}
                          </span></p>
                        </div>
                        <div className="banner-actions">
                          <button 
                            className="btn-edit"
                            onClick={() => startEditBanner(banner)}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn-delete"
                            onClick={() => handleDeleteBanner(banner._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-items">No banners created yet</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="notifications-tab">
              <h2>Broadcast Notification</h2>
              <form onSubmit={handleBroadcastNotification} className="notification-form">
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={notificationForm.title}
                    onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Message</label>
                  <textarea
                    value={notificationForm.message}
                    onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                    rows="5"
                    required
                  />
                </div>
                <button type="submit" className="btn-primary">Broadcast Notification</button>
              </form>
            </div>
          )}

          {activeTab === 'hospitals' && (
            <div className="hospitals-tab">
              <div className="hospitals-header">
                <h2>Hospital Management</h2>
                <button 
                  className="btn-primary"
                  onClick={() => {
                    setEditingHospital(null);
                    setHospitalForm({
                      name: '',
                      email: '',
                      phone: '',
                      password: '',
                      address: '',
                      registrationNumber: '',
                      contactInfo: { phone: '', email: '', website: '' },
                      departments: [],
                      facilities: [],
                      services: []
                    });
                  }}
                >
                  + Add New Hospital
                </button>
              </div>

              <form onSubmit={editingHospital ? (e) => { e.preventDefault(); handleUpdateHospital(editingHospital); } : handleCreateHospital} className="hospital-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Hospital Name *</label>
                    <input
                      type="text"
                      value={hospitalForm.name}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                      required
                      placeholder="Hospital name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Registration Number *</label>
                    <input
                      type="text"
                      value={hospitalForm.registrationNumber}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, registrationNumber: e.target.value })}
                      required
                      placeholder="Registration number"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={hospitalForm.email}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, email: e.target.value })}
                      required
                      disabled={!!editingHospital}
                      placeholder="admin@hospital.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      value={hospitalForm.phone}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, phone: e.target.value })}
                      required
                      disabled={!!editingHospital}
                      placeholder="+1234567890"
                    />
                  </div>
                  {!editingHospital && (
                    <div className="form-group">
                      <label>Password *</label>
                      <input
                        type="password"
                        value={hospitalForm.password}
                        onChange={(e) => setHospitalForm({ ...hospitalForm, password: e.target.value })}
                        required={!editingHospital}
                        placeholder="Min 8 characters"
                      />
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Address *</label>
                  <textarea
                    value={hospitalForm.address}
                    onChange={(e) => setHospitalForm({ ...hospitalForm, address: e.target.value })}
                    required
                    rows="3"
                    placeholder="Full address"
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary">
                    {editingHospital ? 'Update Hospital' : 'Create Hospital'}
                  </button>
                  {editingHospital && (
                    <button 
                      type="button" 
                      className="btn-secondary"
                      onClick={() => {
                        setEditingHospital(null);
                        setHospitalForm({
                          name: '',
                          email: '',
                          phone: '',
                          password: '',
                          address: '',
                          registrationNumber: '',
                          contactInfo: { phone: '', email: '', website: '' },
                          departments: [],
                          facilities: [],
                          services: []
                        });
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="hospitals-list">
                <h3>All Hospitals ({hospitals.length})</h3>
                {hospitalsLoading ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading hospitals...</p>
                  </div>
                ) : hospitals.length > 0 ? (
                  <div className="hospitals-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Registration #</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hospitals.map((hospital) => (
                          <tr key={hospital._id}>
                            <td>{hospital.name}</td>
                            <td>{hospital.userId?.email || 'N/A'}</td>
                            <td>{hospital.userId?.phone || 'N/A'}</td>
                            <td>{hospital.registrationNumber}</td>
                            <td>
                              <span className={`status-badge ${hospital.status === 'approved' ? 'status-approved' : hospital.status === 'pending_super_admin' ? 'status-pending' : 'status-rejected'}`}>
                                {hospital.status}
                              </span>
                            </td>
                            <td>
                              <div className="action-buttons">
                                <button 
                                  className="btn-edit-small"
                                  onClick={() => startEditHospital(hospital)}
                                >
                                  Edit
                                </button>
                                <button 
                                  className="btn-delete-small"
                                  onClick={() => handleDeleteHospital(hospital._id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="no-items">No hospitals found</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="users-tab">
              <div className="users-header">
                <h2>User Management</h2>
                <div className="users-stats">
                  <span>Total: {usersPagination.total || 0}</span>
                  <span>Active: {usersPagination.activeUsers || 0}</span>
                  <span>Inactive: {usersPagination.inactiveUsers || 0}</span>
                </div>
              </div>

              <div className="filters-section">
                <div className="filter-group">
                  <input
                    type="text"
                    placeholder="Search by name, email, or phone..."
                    value={usersFilters.search}
                    onChange={(e) => {
                      setUsersFilters({ ...usersFilters, search: e.target.value });
                      setUsersPagination({ ...usersPagination, page: 1 });
                    }}
                    className="filter-input"
                  />
                </div>
                <div className="filter-group">
                  <select
                    value={usersFilters.isActive}
                    onChange={(e) => {
                      setUsersFilters({ ...usersFilters, isActive: e.target.value });
                      setUsersPagination({ ...usersPagination, page: 1 });
                    }}
                    className="filter-select"
                  >
                    <option value="">All Status</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="filter-group">
                  <select
                    value={usersFilters.sortBy}
                    onChange={(e) => {
                      setUsersFilters({ ...usersFilters, sortBy: e.target.value });
                    }}
                    className="filter-select"
                  >
                    <option value="createdAt">Sort by Date</option>
                    <option value="name">Sort by Name</option>
                    <option value="email">Sort by Email</option>
                  </select>
                </div>
                <div className="filter-group">
                  <select
                    value={usersFilters.sortOrder}
                    onChange={(e) => {
                      setUsersFilters({ ...usersFilters, sortOrder: e.target.value });
                    }}
                    className="filter-select"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>

              <div className="users-list">
                {usersLoading ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading users...</p>
                  </div>
                ) : users.length > 0 ? (
                  <>
                    <div className="users-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th>Verified</th>
                            <th>Registered</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user._id}>
                              <td>{user.name}</td>
                              <td>{user.email}</td>
                              <td>{user.phone}</td>
                              <td>
                                <span className={`status-badge ${user.isActive ? 'status-active' : 'status-inactive'}`}>
                                  {user.isActive ? 'Active' : 'Blocked'}
                                </span>
                              </td>
                              <td>
                                <span className={`status-badge ${user.isVerified ? 'status-verified' : 'status-unverified'}`}>
                                  {user.isVerified ? 'Verified' : 'Unverified'}
                                </span>
                              </td>
                              <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                              <td>
                                <div className="action-buttons">
                                  <button 
                                    className="btn-view-small"
                                    onClick={() => setViewingUser(user)}
                                  >
                                    View
                                  </button>
                                  <button 
                                    className="btn-edit-small"
                                    onClick={() => startEditUser(user)}
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    className={user.isActive ? 'btn-block-small' : 'btn-activate-small'}
                                    onClick={() => handleBlockUser(user._id, user.isActive)}
                                  >
                                    {user.isActive ? 'Block' : 'Activate'}
                                  </button>
                                  <button 
                                    className="btn-delete-small"
                                    onClick={() => handleDeleteUser(user._id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="pagination">
                      <button
                        disabled={usersPagination.page === 1}
                        onClick={() => setUsersPagination({ ...usersPagination, page: usersPagination.page - 1 })}
                        className="pagination-btn"
                      >
                        Previous
                      </button>
                      <span>Page {usersPagination.page} of {usersPagination.pages || 1}</span>
                      <button
                        disabled={usersPagination.page >= usersPagination.pages}
                        onClick={() => setUsersPagination({ ...usersPagination, page: usersPagination.page + 1 })}
                        className="pagination-btn"
                      >
                        Next
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="no-items">No users found</p>
                )}
              </div>

              {viewingUser && (
                <div className="edit-modal">
                  <div className="modal-content">
                    <h3>Patient Details</h3>
                    <div className="doctor-profile-view">
                      <div className="profile-section">
                        <h4>Basic Information</h4>
                        <p><strong>Name:</strong> {viewingUser.name || 'N/A'}</p>
                        <p><strong>Email:</strong> {viewingUser.email || 'N/A'}</p>
                        <p><strong>Phone:</strong> {viewingUser.phone || 'N/A'}</p>
                        <p><strong>Role:</strong> {viewingUser.role || 'N/A'}</p>
                        <p><strong>Status:</strong> 
                          <span className={`status-badge ${viewingUser.isActive ? 'status-active' : 'status-inactive'}`} style={{ marginLeft: '8px' }}>
                            {viewingUser.isActive ? 'Active' : 'Blocked'}
                          </span>
                        </p>
                        <p><strong>Verified:</strong> 
                          <span className={`status-badge ${viewingUser.isVerified ? 'status-verified' : 'status-unverified'}`} style={{ marginLeft: '8px' }}>
                            {viewingUser.isVerified ? 'Verified' : 'Unverified'}
                          </span>
                        </p>
                        <p><strong>Registered:</strong> {viewingUser.createdAt ? new Date(viewingUser.createdAt).toLocaleString() : 'N/A'}</p>
                        <p><strong>Last Updated:</strong> {viewingUser.updatedAt ? new Date(viewingUser.updatedAt).toLocaleString() : 'N/A'}</p>
                      </div>
                      {viewingUser.dateOfBirth && (
                        <div className="profile-section">
                          <h4>Personal Information</h4>
                          <p><strong>Date of Birth:</strong> {new Date(viewingUser.dateOfBirth).toLocaleDateString()}</p>
                          {viewingUser.gender && <p><strong>Gender:</strong> {viewingUser.gender}</p>}
                          {viewingUser.address && <p><strong>Address:</strong> {viewingUser.address}</p>}
                        </div>
                      )}
                      {viewingUser.emergencyContact && (
                        <div className="profile-section">
                          <h4>Emergency Contact</h4>
                          <p><strong>Name:</strong> {viewingUser.emergencyContact.name || 'N/A'}</p>
                          <p><strong>Phone:</strong> {viewingUser.emergencyContact.phone || 'N/A'}</p>
                          <p><strong>Relationship:</strong> {viewingUser.emergencyContact.relationship || 'N/A'}</p>
                        </div>
                      )}
                    </div>
                    <div className="form-actions">
                      <button 
                        type="button" 
                        className="btn-secondary"
                        onClick={() => setViewingUser(null)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {editingUser && (
                <div className="edit-modal">
                  <div className="modal-content">
                    <h3>Edit Patient</h3>
                    <form onSubmit={(e) => { e.preventDefault(); handleUpdateUser(editingUser); }} className="user-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Name *</label>
                          <input
                            type="text"
                            value={userForm.name}
                            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Email *</label>
                          <input
                            type="email"
                            value={userForm.email}
                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                            required
                            disabled
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Phone *</label>
                          <input
                            type="tel"
                            value={userForm.phone}
                            onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                            required
                            disabled
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={userForm.isActive}
                              onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
                            />
                            Active
                          </label>
                        </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={userForm.isVerified}
                              onChange={(e) => setUserForm({ ...userForm, isVerified: e.target.checked })}
                            />
                            Verified
                          </label>
                        </div>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn-primary">Update Patient</button>
                        <button 
                          type="button" 
                          className="btn-secondary"
                          onClick={() => {
                            setEditingUser(null);
                            setUserForm({ name: '', email: '', phone: '', role: 'patient', isActive: true, isVerified: false });
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'doctors' && (
            <div className="doctors-tab">
              <div className="doctors-header">
                <h2>Individual Doctor Management</h2>
                <div className="doctors-stats">
                  <span>Total: {doctorsPagination.total || 0}</span>
                </div>
              </div>

              <div className="filters-section">
                <div className="filter-group">
                  <input
                    type="text"
                    placeholder="Search by name, email, phone, or license..."
                    value={doctorsFilters.search}
                    onChange={(e) => {
                      setDoctorsFilters({ ...doctorsFilters, search: e.target.value });
                      setDoctorsPagination({ ...doctorsPagination, page: 1 });
                    }}
                    className="filter-input"
                  />
                </div>
                <div className="filter-group">
                  <select
                    value={doctorsFilters.status}
                    onChange={(e) => {
                      setDoctorsFilters({ ...doctorsFilters, status: e.target.value });
                      setDoctorsPagination({ ...doctorsPagination, page: 1 });
                    }}
                    className="filter-select"
                  >
                    <option value="">All Status</option>
                    <option value="approved">Approved</option>
                    <option value="pending_super_admin">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="filter-group">
                  <select
                    value={doctorsFilters.specialization}
                    onChange={(e) => {
                      setDoctorsFilters({ ...doctorsFilters, specialization: e.target.value });
                      setDoctorsPagination({ ...doctorsPagination, page: 1 });
                    }}
                    className="filter-select"
                  >
                    <option value="">All Specializations</option>
                    {doctorSpecializations.map((spec) => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="doctors-list">
                {doctorsLoading ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading doctors...</p>
                  </div>
                ) : doctors.length > 0 ? (
                  <>
                    <div className="doctors-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Specialization</th>
                            <th>License #</th>
                            <th>Hospital</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {doctors.map((doctor) => (
                            <tr key={doctor._id}>
                              <td>{doctor.name}</td>
                              <td>{doctor.email}</td>
                              <td>{doctor.phone}</td>
                              <td>{doctor.specialization || 'N/A'}</td>
                              <td>{doctor.medicalLicenseNumber || 'N/A'}</td>
                              <td>{doctor.hospitalId?.name || 'N/A'}</td>
                              <td>
                                <span className={`status-badge ${doctor.status === 'approved' ? 'status-approved' : doctor.status === 'pending_super_admin' ? 'status-pending' : 'status-rejected'}`}>
                                  {doctor.status}
                                </span>
                              </td>
                              <td>
                                <div className="action-buttons">
                                  <button 
                                    className="btn-view-small"
                                    onClick={() => setViewingDoctor(doctor)}
                                  >
                                    View
                                  </button>
                                  <button 
                                    className="btn-edit-small"
                                    onClick={() => startEditDoctor(doctor)}
                                  >
                                    Edit
                                  </button>
                                  {doctor.status === 'pending_super_admin' && (
                                    <>
                                      <button 
                                        className="btn-approve-small"
                                        onClick={() => handleApprove('doctor', doctor._id)}
                                      >
                                        Approve
                                      </button>
                                      <button 
                                        className="btn-reject-small"
                                        onClick={() => {
                                          const reason = prompt('Enter rejection reason:');
                                          if (reason) handleReject('doctor', doctor._id, reason);
                                        }}
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                  <button 
                                    className="btn-delete-small"
                                    onClick={() => handleDeleteDoctor(doctor._id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="pagination">
                      <button
                        disabled={doctorsPagination.page === 1}
                        onClick={() => setDoctorsPagination({ ...doctorsPagination, page: doctorsPagination.page - 1 })}
                        className="pagination-btn"
                      >
                        Previous
                      </button>
                      <span>Page {doctorsPagination.page} of {doctorsPagination.pages || 1}</span>
                      <button
                        disabled={doctorsPagination.page >= doctorsPagination.pages}
                        onClick={() => setDoctorsPagination({ ...doctorsPagination, page: doctorsPagination.page + 1 })}
                        className="pagination-btn"
                      >
                        Next
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="no-items">No doctors found</p>
                )}
              </div>

              {viewingDoctor && (
                <div className="edit-modal">
                  <div className="modal-content">
                    <h3>Doctor Profile</h3>
                    <div className="doctor-profile-view">
                      <div className="profile-section">
                        <h4>Basic Information</h4>
                        <p><strong>Name:</strong> {viewingDoctor.name}</p>
                        <p><strong>Email:</strong> {viewingDoctor.email}</p>
                        <p><strong>Phone:</strong> {viewingDoctor.phone}</p>
                        <p><strong>Specialization:</strong> {viewingDoctor.specialization || 'N/A'}</p>
                        <p><strong>License Number:</strong> {viewingDoctor.medicalLicenseNumber || 'N/A'}</p>
                        <p><strong>Experience:</strong> {viewingDoctor.experienceYears || 0} years</p>
                        <p><strong>Status:</strong> {viewingDoctor.status}</p>
                      </div>
                      {viewingDoctor.bio && (
                        <div className="profile-section">
                          <h4>Bio</h4>
                          <p>{viewingDoctor.bio}</p>
                        </div>
                      )}
                    </div>
                    <div className="form-actions">
                      <button 
                        type="button" 
                        className="btn-secondary"
                        onClick={() => setViewingDoctor(null)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {editingDoctor && (
                <div className="edit-modal">
                  <div className="modal-content">
                    <h3>Edit Doctor</h3>
                    <form onSubmit={(e) => { e.preventDefault(); handleUpdateDoctor(editingDoctor); }} className="doctor-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Name *</label>
                          <input
                            type="text"
                            value={doctorForm.name}
                            onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Email *</label>
                          <input
                            type="email"
                            value={doctorForm.email}
                            onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                            required
                            disabled
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Phone *</label>
                          <input
                            type="tel"
                            value={doctorForm.phone}
                            onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })}
                            required
                            disabled
                          />
                        </div>
                        <div className="form-group">
                          <label>Medical License #</label>
                          <input
                            type="text"
                            value={doctorForm.medicalLicenseNumber}
                            onChange={(e) => setDoctorForm({ ...doctorForm, medicalLicenseNumber: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Specialization</label>
                          <input
                            type="text"
                            value={doctorForm.specialization}
                            onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Experience (Years)</label>
                          <input
                            type="number"
                            value={doctorForm.experienceYears}
                            onChange={(e) => setDoctorForm({ ...doctorForm, experienceYears: parseInt(e.target.value) || 0 })}
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Status</label>
                        <select
                          value={doctorForm.status}
                          onChange={(e) => setDoctorForm({ ...doctorForm, status: e.target.value })}
                        >
                          <option value="approved">Approved</option>
                          <option value="pending_super_admin">Pending</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn-primary">Update Doctor</button>
                        <button 
                          type="button" 
                          className="btn-secondary"
                          onClick={() => {
                            setEditingDoctor(null);
                            setDoctorForm({ name: '', email: '', phone: '', password: '', medicalLicenseNumber: '', specialization: '', experienceYears: 0, status: 'approved' });
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'diagnostic-centers' && (
            <div className="diagnostic-centers-tab">
              <div className="diagnostic-centers-header">
                <h2>Diagnostic Center Management</h2>
                <button 
                  className="btn-primary"
                  onClick={() => {
                    setEditingDiagnosticCenter(null);
                    setDiagnosticCenterForm({ name: '', email: '', phone: '', password: '', address: '', ownerName: '', ownerPhone: '', tradeLicenseNumber: '' });
                  }}
                >
                  + Add New Diagnostic Center
                </button>
              </div>

              <div className="filters-section">
                <div className="filter-group">
                  <input
                    type="text"
                    placeholder="Search by name, email, phone, or license..."
                    value={diagnosticCentersFilters.search}
                    onChange={(e) => {
                      setDiagnosticCentersFilters({ ...diagnosticCentersFilters, search: e.target.value });
                      setDiagnosticCentersPagination({ ...diagnosticCentersPagination, page: 1 });
                    }}
                    className="filter-input"
                  />
                </div>
                <div className="filter-group">
                  <select
                    value={diagnosticCentersFilters.status}
                    onChange={(e) => {
                      setDiagnosticCentersFilters({ ...diagnosticCentersFilters, status: e.target.value });
                      setDiagnosticCentersPagination({ ...diagnosticCentersPagination, page: 1 });
                    }}
                    className="filter-select"
                  >
                    <option value="">All Status</option>
                    <option value="approved">Approved</option>
                    <option value="pending_super_admin">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <form onSubmit={editingDiagnosticCenter ? (e) => { e.preventDefault(); handleUpdateDiagnosticCenter(editingDiagnosticCenter); } : handleCreateDiagnosticCenter} className="diagnostic-center-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Center Name *</label>
                    <input
                      type="text"
                      value={diagnosticCenterForm.name}
                      onChange={(e) => setDiagnosticCenterForm({ ...diagnosticCenterForm, name: e.target.value })}
                      required
                      placeholder="Diagnostic center name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Trade License Number *</label>
                    <input
                      type="text"
                      value={diagnosticCenterForm.tradeLicenseNumber}
                      onChange={(e) => setDiagnosticCenterForm({ ...diagnosticCenterForm, tradeLicenseNumber: e.target.value })}
                      required
                      placeholder="Trade license number"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={diagnosticCenterForm.email}
                      onChange={(e) => setDiagnosticCenterForm({ ...diagnosticCenterForm, email: e.target.value })}
                      required
                      disabled={!!editingDiagnosticCenter}
                      placeholder="admin@center.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      value={diagnosticCenterForm.phone}
                      onChange={(e) => setDiagnosticCenterForm({ ...diagnosticCenterForm, phone: e.target.value })}
                      required
                      disabled={!!editingDiagnosticCenter}
                      placeholder="+1234567890"
                    />
                  </div>
                  {!editingDiagnosticCenter && (
                    <div className="form-group">
                      <label>Password *</label>
                      <input
                        type="password"
                        value={diagnosticCenterForm.password}
                        onChange={(e) => setDiagnosticCenterForm({ ...diagnosticCenterForm, password: e.target.value })}
                        required={!editingDiagnosticCenter}
                        placeholder="Min 8 characters"
                      />
                    </div>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Owner Name *</label>
                    <input
                      type="text"
                      value={diagnosticCenterForm.ownerName}
                      onChange={(e) => setDiagnosticCenterForm({ ...diagnosticCenterForm, ownerName: e.target.value })}
                      required
                      placeholder="Owner name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Owner Phone *</label>
                    <input
                      type="tel"
                      value={diagnosticCenterForm.ownerPhone}
                      onChange={(e) => setDiagnosticCenterForm({ ...diagnosticCenterForm, ownerPhone: e.target.value })}
                      required
                      placeholder="Owner phone"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Address *</label>
                  <textarea
                    value={diagnosticCenterForm.address}
                    onChange={(e) => setDiagnosticCenterForm({ ...diagnosticCenterForm, address: e.target.value })}
                    required
                    rows="3"
                    placeholder="Full address"
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary">
                    {editingDiagnosticCenter ? 'Update Diagnostic Center' : 'Create Diagnostic Center'}
                  </button>
                  {editingDiagnosticCenter && (
                    <button 
                      type="button" 
                      className="btn-secondary"
                      onClick={() => {
                        setEditingDiagnosticCenter(null);
                        setDiagnosticCenterForm({ name: '', email: '', phone: '', password: '', address: '', ownerName: '', ownerPhone: '', tradeLicenseNumber: '' });
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="diagnostic-centers-list">
                <h3>All Diagnostic Centers ({diagnosticCentersPagination.total || 0})</h3>
                {diagnosticCentersLoading ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading diagnostic centers...</p>
                  </div>
                ) : diagnosticCenters.length > 0 ? (
                  <>
                    <div className="diagnostic-centers-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Owner</th>
                            <th>License #</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diagnosticCenters.map((center) => (
                            <tr key={center._id}>
                              <td>{center.name}</td>
                              <td>{center.userId?.email || center.email || 'N/A'}</td>
                              <td>{center.userId?.phone || center.phone || 'N/A'}</td>
                              <td>{center.ownerName || 'N/A'}</td>
                              <td>{center.tradeLicenseNumber}</td>
                              <td>
                                <span className={`status-badge ${center.status === 'approved' ? 'status-approved' : center.status === 'pending_super_admin' ? 'status-pending' : 'status-rejected'}`}>
                                  {center.status}
                                </span>
                              </td>
                              <td>
                                <div className="action-buttons">
                                  <button 
                                    className="btn-edit-small"
                                    onClick={() => startEditDiagnosticCenter(center)}
                                  >
                                    Edit
                                  </button>
                                  {center.status === 'pending_super_admin' && (
                                    <>
                                      <button 
                                        className="btn-approve-small"
                                        onClick={() => handleApprove('diagnostic-center', center._id)}
                                      >
                                        Approve
                                      </button>
                                      <button 
                                        className="btn-reject-small"
                                        onClick={() => {
                                          const reason = prompt('Enter rejection reason:');
                                          if (reason) handleReject('diagnostic-center', center._id, reason);
                                        }}
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                  <button 
                                    className="btn-delete-small"
                                    onClick={() => handleDeleteDiagnosticCenter(center._id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="pagination">
                      <button
                        disabled={diagnosticCentersPagination.page === 1}
                        onClick={() => setDiagnosticCentersPagination({ ...diagnosticCentersPagination, page: diagnosticCentersPagination.page - 1 })}
                        className="pagination-btn"
                      >
                        Previous
                      </button>
                      <span>Page {diagnosticCentersPagination.page} of {diagnosticCentersPagination.pages || 1}</span>
                      <button
                        disabled={diagnosticCentersPagination.page >= diagnosticCentersPagination.pages}
                        onClick={() => setDiagnosticCentersPagination({ ...diagnosticCentersPagination, page: diagnosticCentersPagination.page + 1 })}
                        className="pagination-btn"
                      >
                        Next
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="no-items">No diagnostic centers found</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity-logs' && (
            <div className="activity-logs-tab">
              <div className="activity-logs-header">
                <h2>Activity Logs & History</h2>
                <p>Track all system activities and admin actions</p>
              </div>

              <div className="filters-section">
                <div className="filter-group">
                  <select
                    value={activityLogsFilters.action}
                    onChange={(e) => {
                      setActivityLogsFilters({ ...activityLogsFilters, action: e.target.value });
                      setActivityLogsPagination({ ...activityLogsPagination, page: 1 });
                    }}
                    className="filter-select"
                  >
                    <option value="">All Actions</option>
                    <option value="approve">Approve</option>
                    <option value="reject">Reject</option>
                    <option value="suspend">Suspend</option>
                    <option value="create">Create</option>
                    <option value="update">Update</option>
                    <option value="delete">Delete</option>
                    <option value="block">Block</option>
                    <option value="activate">Activate</option>
                  </select>
                </div>
                <div className="filter-group">
                  <select
                    value={activityLogsFilters.targetType}
                    onChange={(e) => {
                      setActivityLogsFilters({ ...activityLogsFilters, targetType: e.target.value });
                      setActivityLogsPagination({ ...activityLogsPagination, page: 1 });
                    }}
                    className="filter-select"
                  >
                    <option value="">All Types</option>
                    <option value="user">User</option>
                    <option value="doctor">Doctor</option>
                    <option value="hospital">Hospital</option>
                    <option value="diagnostic_center">Diagnostic Center</option>
                  </select>
                </div>
                <div className="filter-group">
                  <input
                    type="date"
                    value={activityLogsFilters.startDate}
                    onChange={(e) => {
                      setActivityLogsFilters({ ...activityLogsFilters, startDate: e.target.value });
                      setActivityLogsPagination({ ...activityLogsPagination, page: 1 });
                    }}
                    className="filter-input"
                    placeholder="Start Date"
                  />
                </div>
                <div className="filter-group">
                  <input
                    type="date"
                    value={activityLogsFilters.endDate}
                    onChange={(e) => {
                      setActivityLogsFilters({ ...activityLogsFilters, endDate: e.target.value });
                      setActivityLogsPagination({ ...activityLogsPagination, page: 1 });
                    }}
                    className="filter-input"
                    placeholder="End Date"
                  />
                </div>
              </div>

              <div className="activity-logs-list">
                {activityLogsLoading ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading activity logs...</p>
                  </div>
                ) : activityLogs.length > 0 ? (
                  <>
                    <div className="activity-logs-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Timestamp</th>
                            <th>Actor</th>
                            <th>Action</th>
                            <th>Target Type</th>
                            <th>Previous Status</th>
                            <th>New Status</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityLogs.map((log) => (
                            <tr key={log._id}>
                              <td>{new Date(log.timestamp).toLocaleString()}</td>
                              <td>{log.actorId?.name || 'System'}</td>
                              <td>
                                <span className={`action-badge action-${log.action}`}>
                                  {log.action}
                                </span>
                              </td>
                              <td>{log.targetType}</td>
                              <td>{log.previousStatus || 'N/A'}</td>
                              <td>{log.newStatus || 'N/A'}</td>
                              <td>{log.reason || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="pagination">
                      <button
                        disabled={activityLogsPagination.page === 1}
                        onClick={() => setActivityLogsPagination({ ...activityLogsPagination, page: activityLogsPagination.page - 1 })}
                        className="pagination-btn"
                      >
                        Previous
                      </button>
                      <span>Page {activityLogsPagination.page} of {activityLogsPagination.pages || 1}</span>
                      <button
                        disabled={activityLogsPagination.page >= activityLogsPagination.pages}
                        onClick={() => setActivityLogsPagination({ ...activityLogsPagination, page: activityLogsPagination.page + 1 })}
                        className="pagination-btn"
                      >
                        Next
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="no-items">No activity logs found</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <AdminTeamTab
              canManage={canAccess(permissions, 'team:manage')}
              onSuccess={(msg) => { setSuccess(msg); setError(''); }}
              onError={(msg) => { setError(msg); setSuccess(''); }}
            />
          )}

          {activeTab === 'export' && (
            <div className="export-tab">
              <h2>Export Data</h2>
              <div className="export-options">
                <div className="export-card">
                  <h3>Appointments</h3>
                  <div className="export-buttons">
                    <button onClick={() => handleExportData('appointments', 'csv')} className="btn-export">
                      Export as CSV
                    </button>
                    <button onClick={() => handleExportData('appointments', 'xlsx')} className="btn-export">
                      Export as Excel
                    </button>
                  </div>
                </div>
                <div className="export-card">
                  <h3>Orders</h3>
                  <div className="export-buttons">
                    <button onClick={() => handleExportData('orders', 'csv')} className="btn-export">
                      Export as CSV
                    </button>
                    <button onClick={() => handleExportData('orders', 'xlsx')} className="btn-export">
                      Export as Excel
                    </button>
                  </div>
                </div>
                <div className="export-card">
                  <h3>Users</h3>
                  <div className="export-buttons">
                    <button onClick={() => handleExportData('users', 'csv')} className="btn-export">
                      Export as CSV
                    </button>
                    <button onClick={() => handleExportData('users', 'xlsx')} className="btn-export">
                      Export as Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
