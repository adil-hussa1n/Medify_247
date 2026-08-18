import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking', 'online', 'offline'
  const { login } = useAuth();
  const navigate = useNavigate();

  // Check backend connection on component mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        // Use fetch directly to avoid API base URL prefix
        const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const healthURL = baseURL.replace('/api', '') + '/health';
        
        const response = await fetch(healthURL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const data = await response.json();
          console.log('Backend is online:', data);
          setBackendStatus('online');
        } else {
          console.warn('Backend health check returned non-OK status:', response.status);
          setBackendStatus('offline');
        }
      } catch (error) {
        console.error('Backend health check failed:', error);
        setBackendStatus('offline');
      }
    };
    checkBackend();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('=== LOGIN ATTEMPT STARTED ===');
    console.log('Email:', formData.email);
    console.log('Password length:', formData.password.length);

    try {
      console.log('Calling login function...');
      const result = await login(formData.email, formData.password);
      console.log('Login result received:', result);
      
      if (result.success) {
        const role = result.data?.user?.role;
        if (role === 'doctor' || role === 'doctor_staff') {
          navigate('/doctor/dashboard');
        } else if (role === 'hospital_admin') {
          navigate('/hospital/dashboard');
        } else if (role === 'diagnostic_center_admin') {
          navigate('/diagnostic-center/dashboard');
        } else if (role === 'super_admin' || role === 'super_admin_staff') {
          navigate('/super-admin/dashboard');
        } else if (role === 'patient') {
          navigate('/user/dashboard');
        } else {
          navigate('/');
        }
      } else {
        console.error('Login failed:', result.message);
        setError(result.message || 'Login failed. Please try again.');
        if (result.errors) {
          console.error('Login errors:', result.errors);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card-container">
        <div className="auth-header">
          <div className="auth-brand-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
              <path d="M2 17L12 22L22 17"/>
              <path d="M2 12L12 17L22 12"/>
            </svg>
          </div>
          <h1>Welcome to Medify</h1>
          <p>Sign in to your account to continue</p>
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
          <div className="auth-form-grid single-col">
            <div className="auth-field-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@example.com"
                className={`auth-input-control ${errors.email ? 'has-error' : ''}`}
              />
              {errors.email && <span className="auth-field-error">{errors.email}</span>}
            </div>

            <div className="auth-field-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className={`auth-input-control ${errors.password ? 'has-error' : ''}`}
              />
              {errors.password && <span className="auth-field-error">{errors.password}</span>}
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Create one here</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
