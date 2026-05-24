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
        } else if (role === 'super_admin') {
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
      console.error('Login exception caught:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
      console.log('=== LOGIN ATTEMPT COMPLETED ===');
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="medical-pattern"></div>
      </div>
      
      <div className="login-content">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-container">
              <svg className="medical-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1>Welcome to Medify</h1>
            <p>Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {backendStatus === 'offline' && (
              <div className="error-message" style={{ background: '#fff3cd', borderColor: '#ffc107', color: '#856404' }}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <strong>Backend server is offline!</strong>
                  <br />
                  Please make sure the backend server is running on port 5000.
                  <br />
                  <small>Run: <code>cd backend && npm start</code></small>
                </div>
              </div>
            )}
            {error && (
              <div className="error-message">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={(e) => e.target.placeholder = ''}
                  onBlur={(e) => !e.target.value && (e.target.placeholder = 'Enter your email')}
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={(e) => e.target.placeholder = ''}
                  onBlur={(e) => !e.target.value && (e.target.placeholder = 'Enter your password')}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-button" disabled={loading || backendStatus === 'offline'}>
              {loading ? (
                <>
                  <svg className="spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"/>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/register" className="link">
                Create one here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;


