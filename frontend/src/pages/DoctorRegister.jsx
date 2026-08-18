import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../config/api';
import './DoctorRegister.css';

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

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.medicalLicenseNumber.trim()) {
      newErrors.medicalLicenseNumber = 'Medical license number is required';
    }

    if (!formData.specialization.trim()) {
      newErrors.specialization = 'Specialization is required';
    }

    if (!formData.experienceYears || parseInt(formData.experienceYears) < 0) {
      newErrors.experienceYears = 'Experience years is required';
    }

    if (!formData.consultationFee || parseFloat(formData.consultationFee) < 0) {
      newErrors.consultationFee = 'Consultation fee is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...registerData } = formData;
      
      // Prepare request data - send specialization as string (backend validation expects string)
      // Schedule will be managed from dashboard, so send empty array
      const requestData = {
        name: registerData.name.trim(),
        email: registerData.email.trim(),
        phone: registerData.phone.trim(),
        password: registerData.password,
        medicalLicenseNumber: registerData.medicalLicenseNumber.trim(),
        specialization: registerData.specialization.trim(), // Send as string, backend will convert to array
        experienceYears: parseInt(registerData.experienceYears),
        consultationFee: parseFloat(registerData.consultationFee),
        schedule: [] // Schedule will be managed from dashboard
      };
      
      // Only include hospitalId and chamberId if they're not null (backend validation expects optional)
      // For individual doctors, we don't send these fields
      
      const response = await api.post('/doctors/register', requestData);

      if (response.data.success) {
        alert('Registration successful! Please wait for admin approval. You will be notified once approved.');
        navigate('/doctor/login');
      } else {
        setError(response.data.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      console.error('Error response:', err.response?.data);
      
      if (err.response?.data?.errors) {
        const fieldErrors = {};
        err.response.data.errors.forEach((error) => {
          if (error.param) {
            fieldErrors[error.param] = error.msg;
          }
        });
        setErrors(fieldErrors);
        
        // Also show the first error message
        if (err.response.data.errors.length > 0) {
          setError(err.response.data.errors[0].msg || 'Validation failed. Please check the form.');
        }
      } else {
        setError(err.response?.data?.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="doctor-register-container">
      <div className="doctor-register-background">
        <div className="medical-pattern"></div>
      </div>
      
      <div className="doctor-register-content">
        <div className="doctor-register-card">
          <div className="doctor-register-header">
            <div className="logo-container">
              <svg className="medical-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1>Doctor Registration</h1>
            <p>Register as an individual doctor</p>
          </div>

          <form onSubmit={handleSubmit} className="doctor-register-form">
            {error && (
              <div className="error-message">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <div className="form-section">
              <h3>Personal Information</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Full Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Dr. John Doe"
                    className={errors.name ? 'error' : ''}
                    required
                  />
                  {errors.name && <span className="field-error">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="doctor@example.com"
                    className={errors.email ? 'error' : ''}
                    required
                  />
                  {errors.email && <span className="field-error">{errors.email}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">Phone Number *</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1234567890"
                    className={errors.phone ? 'error' : ''}
                    required
                  />
                  {errors.phone && <span className="field-error">{errors.phone}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="medicalLicenseNumber">Medical License Number *</label>
                  <input
                    type="text"
                    id="medicalLicenseNumber"
                    name="medicalLicenseNumber"
                    value={formData.medicalLicenseNumber}
                    onChange={handleChange}
                    placeholder="BMDC-12345"
                    className={errors.medicalLicenseNumber ? 'error' : ''}
                    required
                  />
                  {errors.medicalLicenseNumber && <span className="field-error">{errors.medicalLicenseNumber}</span>}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Professional Information</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="specialization">Specialization *</label>
                  <input
                    type="text"
                    id="specialization"
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleChange}
                    placeholder="Cardiology, General Medicine (comma separated)"
                    className={errors.specialization ? 'error' : ''}
                    required
                  />
                  {errors.specialization && <span className="field-error">{errors.specialization}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="experienceYears">Experience (Years) *</label>
                  <input
                    type="number"
                    id="experienceYears"
                    name="experienceYears"
                    value={formData.experienceYears}
                    onChange={handleChange}
                    placeholder="5"
                    min="0"
                    className={errors.experienceYears ? 'error' : ''}
                    required
                  />
                  {errors.experienceYears && <span className="field-error">{errors.experienceYears}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="consultationFee">Consultation Fee (BDT) *</label>
                  <input
                    type="number"
                    id="consultationFee"
                    name="consultationFee"
                    value={formData.consultationFee}
                    onChange={handleChange}
                    placeholder="500"
                    min="0"
                    step="0.01"
                    className={errors.consultationFee ? 'error' : ''}
                    required
                  />
                  {errors.consultationFee && <span className="field-error">{errors.consultationFee}</span>}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Account Security</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="password">Password *</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Minimum 8 characters"
                    className={errors.password ? 'error' : ''}
                    required
                  />
                  {errors.password && <span className="field-error">{errors.password}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password *</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    className={errors.confirmPassword ? 'error' : ''}
                    required
                  />
                  {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                </div>
              </div>
            </div>

            <button type="submit" className="register-button" disabled={loading}>
              {loading ? (
                <>
                  <svg className="spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Registering...
                </>
              ) : (
                'Register as Doctor'
              )}
            </button>
          </form>

          <div className="doctor-register-footer">
            <p>
              Already have an account?{' '}
              <Link to="/doctor/login" className="link">
                Sign in here
              </Link>
            </p>
            <div style={{ marginTop: '16px', fontSize: '13px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <span>Not a doctor? Register as </span>
              <Link to="/hospital/register" className="link">Hospital</Link>
              <span> or </span>
              <Link to="/diagnostic-center/register" className="link">Diagnostic Center</Link>
              <span> or </span>
              <Link to="/register" className="link">Patient</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorRegister;
