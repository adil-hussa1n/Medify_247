import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../config/api';
import './AuthShared.css';

const DoctorRegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    medicalLicenseNumber: '',
    specialization: '',
    experienceYears: '',
    consultationFee: ''
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: '',
      });
    }
    setError('');
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.medicalLicenseNumber.trim()) newErrors.medicalLicenseNumber = 'Medical license number is required';
    if (!formData.specialization.trim()) newErrors.specialization = 'Specialization is required';
    if (!formData.experienceYears || parseInt(formData.experienceYears) < 0) newErrors.experienceYears = 'Experience is required';
    if (!formData.consultationFee || parseFloat(formData.consultationFee) < 0) newErrors.consultationFee = 'Consultation fee is required';
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    setLoading(true);

    try {
      const { confirmPassword, ...registerData } = formData;
      const requestData = {
        name: registerData.name.trim(),
        email: registerData.email.trim(),
        phone: registerData.phone.trim(),
        password: registerData.password,
        medicalLicenseNumber: registerData.medicalLicenseNumber.trim(),
        specialization: registerData.specialization.trim(),
        experienceYears: parseInt(registerData.experienceYears),
        consultationFee: parseFloat(registerData.consultationFee),
        schedule: []
      };

      const response = await api.post('/doctors/register', requestData);

      if (response.data.success) {
        alert('Registration successful! Please wait for admin approval.');
        navigate('/doctor/login');
      } else {
        setError(response.data.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        const fieldErrors = {};
        err.response.data.errors.forEach((error) => {
          if (error.param) {
            fieldErrors[error.param] = error.msg;
          }
        });
        setErrors(fieldErrors);
      }
      setError(err.response?.data?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card-container wide-card">
        <div className="auth-header">
          <div className="auth-brand-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
              <path d="M2 17L12 22L22 17"/>
              <path d="M2 12L12 17L22 12"/>
            </svg>
          </div>
          <h1>Doctor Registration</h1>
          <p>Register as an individual practitioner on Medify</p>
        </div>

        {error && (
          <div className="auth-error-alert">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-section-title">Personal Details</div>
          <div className="auth-form-grid">
            <div className="auth-field-group">
              <label htmlFor="name">Full Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Dr. John Doe"
                className={`auth-input-control ${errors.name ? 'has-error' : ''}`}
              />
              {errors.name && <span className="auth-field-error">{errors.name}</span>}
            </div>

            <div className="auth-field-group">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="doctor@example.com"
                className={`auth-input-control ${errors.email ? 'has-error' : ''}`}
              />
              {errors.email && <span className="auth-field-error">{errors.email}</span>}
            </div>
          </div>

          <div className="auth-form-grid">
            <div className="auth-field-group">
              <label htmlFor="phone">Phone Number *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+8801712345678"
                className={`auth-input-control ${errors.phone ? 'has-error' : ''}`}
              />
              {errors.phone && <span className="auth-field-error">{errors.phone}</span>}
            </div>

            <div className="auth-field-group">
              <label htmlFor="medicalLicenseNumber">Medical License Number (BMDC) *</label>
              <input
                type="text"
                id="medicalLicenseNumber"
                name="medicalLicenseNumber"
                value={formData.medicalLicenseNumber}
                onChange={handleChange}
                placeholder="BMDC-A-12345"
                className={`auth-input-control ${errors.medicalLicenseNumber ? 'has-error' : ''}`}
              />
              {errors.medicalLicenseNumber && <span className="auth-field-error">{errors.medicalLicenseNumber}</span>}
            </div>
          </div>

          <div className="auth-section-title">Professional Practice</div>
          <div className="auth-form-grid">
            <div className="auth-field-group">
              <label htmlFor="specialization">Specialization *</label>
              <input
                type="text"
                id="specialization"
                name="specialization"
                value={formData.specialization}
                onChange={handleChange}
                placeholder="Cardiologist, Medicine..."
                className={`auth-input-control ${errors.specialization ? 'has-error' : ''}`}
              />
              {errors.specialization && <span className="auth-field-error">{errors.specialization}</span>}
            </div>

            <div className="auth-field-group">
              <label htmlFor="experienceYears">Experience (Years) *</label>
              <input
                type="number"
                id="experienceYears"
                name="experienceYears"
                value={formData.experienceYears}
                onChange={handleChange}
                placeholder="5"
                min="0"
                className={`auth-input-control ${errors.experienceYears ? 'has-error' : ''}`}
              />
              {errors.experienceYears && <span className="auth-field-error">{errors.experienceYears}</span>}
            </div>
          </div>

          <div className="auth-form-grid single-col">
            <div className="auth-field-group">
              <label htmlFor="consultationFee">Consultation Fee (BDT ৳) *</label>
              <input
                type="number"
                id="consultationFee"
                name="consultationFee"
                value={formData.consultationFee}
                onChange={handleChange}
                placeholder="1000"
                min="0"
                className={`auth-input-control ${errors.consultationFee ? 'has-error' : ''}`}
              />
              {errors.consultationFee && <span className="auth-field-error">{errors.consultationFee}</span>}
            </div>
          </div>

          <div className="auth-section-title">Security</div>
          <div className="auth-form-grid">
            <div className="auth-field-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                className={`auth-input-control ${errors.password ? 'has-error' : ''}`}
              />
              {errors.password && <span className="auth-field-error">{errors.password}</span>}
            </div>

            <div className="auth-field-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm password"
                className={`auth-input-control ${errors.confirmPassword ? 'has-error' : ''}`}
              />
              {errors.confirmPassword && <span className="auth-field-error">{errors.confirmPassword}</span>}
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Submitting Application...' : 'Register as Doctor'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already registered as Doctor? <Link to="/doctor/login">Sign in here</Link></p>
          <p style={{ marginTop: '8px' }}>Not a doctor? <Link to="/register">Patient</Link> · <Link to="/hospital/register">Hospital</Link> · <Link to="/diagnostic-center/register">Diagnostic</Link></p>
        </div>
      </div>
    </div>
  );
};

export default DoctorRegister;
