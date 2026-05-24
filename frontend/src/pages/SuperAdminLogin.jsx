import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import './SuperAdminLogin.css';

const SuperAdminLogin = () => {
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

  const handleFocus = (e) => {
    e.target.classList.add('focused');
  };

  const handleBlur = (e) => {
    if (!e.target.value) {
      e.target.classList.remove('focused');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      
      if (result.success) {
        const user = result.data.user;
        
        if (!['super_admin', 'super_admin_staff'].includes(user.role)) {
          setError('Access denied. This login is for platform administrators only.');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('adminAccess');
          setLoading(false);
          return;
        }
        
        // Redirect to super admin dashboard
        navigate('/super-admin/dashboard');
      } else {
        setError(result.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="super-admin-login-container">
      <div className="super-admin-login-card">
        <div className="super-admin-login-header">
          <div className="super-admin-logo">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            </svg>
          </div>
          <h1>Super Admin Login</h1>
          <p>Access the administrative dashboard</p>
        </div>

        {backendStatus === 'offline' && (
          <div className="backend-warning">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Backend server is offline. Please ensure the server is running.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="super-admin-login-form">
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
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Enter your email"
              required
              disabled={loading || backendStatus === 'offline'}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Enter your password"
              required
              disabled={loading || backendStatus === 'offline'}
            />
          </div>

          <button
            type="submit"
            className="super-admin-login-btn"
            disabled={loading || backendStatus === 'offline'}
          >
            {loading ? (
              <>
                <div className="spinner-small"></div>
                <span>Logging in...</span>
              </>
            ) : (
              'Login as Super Admin'
            )}
          </button>
        </form>

        <div className="super-admin-login-footer">
          <p>Super Admin Access Only</p>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
