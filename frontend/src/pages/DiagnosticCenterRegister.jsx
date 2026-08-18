import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './DiagnosticCenterRegister.css';

const DiagnosticCenterRegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '+88',
    email: '',
    address: '',
    ownerName: '',
    ownerPhone: '+88',
    tradeLicenseNumber: '',
    tradeLicenseDocument: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { diagnosticCenterRegister } = useAuth();
  const navigate = useNavigate();

  // Helper function to ensure phone number starts with +88
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

  const handlePhoneChange = (field, value) => {
    const formatted = formatPhoneNumber(value);
    setFormData({...formData, [field]: formatted});
    if (errors[field]) {
      setErrors({...errors, [field]: ''});
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone' || name === 'ownerPhone') {
      handlePhoneChange(name, value);
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: '',
      });
    }
    setError('');
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Diagnostic center name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.phone.trim() || formData.phone === '+88') {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[1-9]\d{1,14}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.ownerName.trim()) {
      newErrors.ownerName = 'Owner/Admin name is required';
    }

    if (!formData.ownerPhone.trim() || formData.ownerPhone === '+88') {
      newErrors.ownerPhone = 'Owner phone number is required';
    } else if (!/^\+?[1-9]\d{1,14}$/.test(formData.ownerPhone.replace(/\s/g, ''))) {
      newErrors.ownerPhone = 'Please enter a valid phone number';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.tradeLicenseNumber.trim()) {
      newErrors.tradeLicenseNumber = 'Trade license number is required';
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
      
      const result = await diagnosticCenterRegister(registerData);

      if (result.success) {
        navigate('/diagnostic-center/login');
      } else {
        if (result.errors && Array.isArray(result.errors)) {
          const fieldErrors = {};
          result.errors.forEach((err) => {
            if (err.param) {
              fieldErrors[err.param] = err.msg;
            }
          });
          setErrors(fieldErrors);
        }
        setError(result.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="diagnostic-center-register-container">
      <div className="diagnostic-center-register-background">
        <div className="lab-pattern"></div>
      </div>
      
      <div className="diagnostic-center-register-content">
        <div className="diagnostic-center-register-card">
          <div className="diagnostic-center-register-header">
            <div className="logo-container">
              <svg className="lab-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 2v6m6-6v6M5 10h14M4 20h16a1 1 0 001-1V11a1 1 0 00-1-1H4a1 1 0 00-1 1v8a1 1 0 001 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h1>Register Your Diagnostic Center</h1>
            <p>Join Medify and manage your diagnostic services</p>
          </div>

          <form onSubmit={handleSubmit} className="diagnostic-center-register-form">
            {error && (
              <div className="error-message">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Diagnostic Center Name *</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter diagnostic center name"
                    className={errors.name ? 'error' : ''}
                    required
                  />
                </div>
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    className={errors.email ? 'error' : ''}
                    required
                  />
                </div>
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number *</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l1.12 6.5a1 1 0 01-.54 1.06l-1.293.577a11.042 11.042 0 005.29 5.29l.577-1.293a1 1 0 011.06-.54l6.5 1.12a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange('phone', e.target.value)}
                    onBlur={(e) => handlePhoneChange('phone', e.target.value)}
                    placeholder="+88"
                    className={errors.phone ? 'error' : ''}
                    required
                  />
                </div>
                {errors.phone && <span className="field-error">{errors.phone}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label htmlFor="address">Address *</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Enter physical address"
                    className={errors.address ? 'error' : ''}
                    required
                  />
                </div>
                {errors.address && <span className="field-error">{errors.address}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ownerName">Owner/Admin Name *</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="text"
                    id="ownerName"
                    name="ownerName"
                    value={formData.ownerName}
                    onChange={handleChange}
                    placeholder="Enter owner/admin name"
                    className={errors.ownerName ? 'error' : ''}
                    required
                  />
                </div>
                {errors.ownerName && <span className="field-error">{errors.ownerName}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="ownerPhone">Owner Phone *</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l1.12 6.5a1 1 0 01-.54 1.06l-1.293.577a11.042 11.042 0 005.29 5.29l.577-1.293a1 1 0 011.06-.54l6.5 1.12a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  <input
                    type="tel"
                    id="ownerPhone"
                    name="ownerPhone"
                    value={formData.ownerPhone}
                    onChange={(e) => handlePhoneChange('ownerPhone', e.target.value)}
                    onBlur={(e) => handlePhoneChange('ownerPhone', e.target.value)}
                    placeholder="+88"
                    className={errors.ownerPhone ? 'error' : ''}
                    required
                  />
                </div>
                {errors.ownerPhone && <span className="field-error">{errors.ownerPhone}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="tradeLicenseNumber">Trade License Number *</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="text"
                    id="tradeLicenseNumber"
                    name="tradeLicenseNumber"
                    value={formData.tradeLicenseNumber}
                    onChange={handleChange}
                    placeholder="Enter trade license number"
                    className={errors.tradeLicenseNumber ? 'error' : ''}
                    required
                  />
                </div>
                {errors.tradeLicenseNumber && <span className="field-error">{errors.tradeLicenseNumber}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="tradeLicenseDocument">Trade License Document URL</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="url"
                    id="tradeLicenseDocument"
                    name="tradeLicenseDocument"
                    value={formData.tradeLicenseDocument}
                    onChange={handleChange}
                    placeholder="Enter document URL (optional)"
                    className={errors.tradeLicenseDocument ? 'error' : ''}
                  />
                </div>
                {errors.tradeLicenseDocument && <span className="field-error">{errors.tradeLicenseDocument}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password *</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className={errors.password ? 'error' : ''}
                    required
                  />
                </div>
                {errors.password && <span className="field-error">{errors.password}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password *</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
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
                </div>
                {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
              </div>
            </div>

            <button type="submit" className="diagnostic-center-register-button" disabled={loading}>
              {loading ? (
                <>
                  <svg className="spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Registering...
                </>
              ) : (
                'Register Diagnostic Center'
              )}
            </button>
          </form>

          <div className="diagnostic-center-register-footer">
            <p>
              Already have an account?{' '}
              <Link to="/diagnostic-center/login" className="link">
                Sign in here
              </Link>
            </p>
            <div style={{ marginTop: '16px', fontSize: '13px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <span>Not a diagnostic center? Register as </span>
              <Link to="/doctor/register" className="link">Doctor</Link>
              <span> or </span>
              <Link to="/hospital/register" className="link">Hospital</Link>
              <span> or </span>
              <Link to="/register" className="link">Patient</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticCenterRegister;

