import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const Home = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'patient') {
        navigate('/user/dashboard');
      } else if (user.role === 'hospital_admin') {
        navigate('/hospital/dashboard');
      } else if (user.role === 'diagnostic_center_admin') {
        navigate('/diagnostic-center/dashboard');
      } else if (user.role === 'super_admin' || user.role === 'super_admin_staff') {
        navigate('/super-admin/dashboard');
      } else if (user.role === 'doctor' || user.role === 'doctor_staff') {
        navigate('/doctor/dashboard');
      }
    }
  }, [user, navigate]);

  return (
    <div className="home-container">
      <nav className="navbar">
        <div className="nav-content">
          <div className="nav-brand">
            <svg className="medical-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Medify</span>
          </div>
          <button onClick={logout} className="logout-button">
            Logout
          </button>
        </div>
      </nav>

      <div className="home-content">
        <div className="welcome-card">
          <h1>Welcome to Medify!</h1>
          <p className="welcome-message">
            Hello, <strong>{user?.name || user?.email}</strong>! You have successfully logged in.
          </p>
          <div className="user-info">
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">{user?.email}</span>
            </div>
            {user?.phone && (
              <div className="info-item">
                <span className="info-label">Phone:</span>
                <span className="info-value">{user.phone}</span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">Role:</span>
              <span className="info-value badge">{user?.role || 'patient'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;


