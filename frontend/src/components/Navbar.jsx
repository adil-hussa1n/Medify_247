import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [hospital, setHospital] = useState(null);
  const [diagnosticCenter, setDiagnosticCenter] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  useEffect(() => {
    if (user?.role === 'hospital_admin') {
      fetchHospitalData();
    } else if (user?.role === 'diagnostic_center_admin') {
      fetchDiagnosticCenterData();
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
        }
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [showDropdown]);

  const handleMouseEnter = () => {
    // Clear any pending close timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setShowDropdown(true);
  };

  const handleMouseLeave = () => {
    // Add a delay before closing to allow moving mouse to dropdown
    closeTimeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
      closeTimeoutRef.current = null;
    }, 200); // 200ms delay
  };

  const fetchHospitalData = async () => {
    try {
      const userResponse = await api.get(`/users/${user.id}`);
      if (userResponse.data.success && userResponse.data.data.roleData) {
        setHospital(userResponse.data.data.roleData);
      }
    } catch (error) {
      console.error('Error fetching hospital data:', error);
    }
  };

  const fetchDiagnosticCenterData = async () => {
    try {
      const userResponse = await api.get(`/users/${user.id}`);
      if (userResponse.data.success && userResponse.data.data.roleData) {
        setDiagnosticCenter(userResponse.data.data.roleData);
      }
    } catch (error) {
      console.error('Error fetching diagnostic center data:', error);
    }
  };

  const handleProfileClick = () => {
    setShowDropdown(false);
    if (user?.role === 'hospital_admin') {
      navigate('/hospital/profile');
    } else if (user?.role === 'diagnostic_center_admin') {
      navigate('/diagnostic-center/profile');
    } else if (user?.role === 'patient') {
      navigate('/user/profile');
    }
  };

  const handleDashboardClick = () => {
    setShowDropdown(false);
    if (user?.role === 'patient') {
      navigate('/user/dashboard');
    }
  };

  const handleAppointmentsClick = () => {
    setShowDropdown(false);
    navigate('/user/dashboard');
    // Could navigate to a specific appointments tab if needed
  };

  const handleTestsClick = () => {
    setShowDropdown(false);
    navigate('/user/dashboard', { state: { tab: 'tests' } });
  };

  const handleTestOrdersClick = () => {
    setShowDropdown(false);
    navigate('/user/dashboard', { state: { tab: 'test-orders' } });
  };

  const handleHomeServicesClick = () => {
    setShowDropdown(false);
    navigate('/user/dashboard');
    // Could navigate to a specific home services tab if needed
  };

  const handleLogout = () => {
    setShowDropdown(false);
    logout();
    if (user?.role === 'hospital_admin') {
      navigate('/hospital/login');
    } else if (user?.role === 'diagnostic_center_admin') {
      navigate('/diagnostic-center/login');
    } else {
      navigate('/login');
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <svg className="medical-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="brand-text">Medify</span>
        </div>

        <div className="navbar-right">
          {user?.role === 'hospital_admin' && hospital ? (
            <div 
              className="hospital-logo-dropdown" 
              ref={dropdownRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="hospital-logo-trigger">
                {hospital.logo && hospital.logo.trim() ? (
                  <img 
                    src={hospital.logo.trim()} 
                    alt="Hospital Logo" 
                    className="hospital-logo-img"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="hospital-logo-placeholder"
                  style={{ display: hospital.logo && hospital.logo.trim() ? 'none' : 'flex' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" strokeWidth="2"/>
                  </svg>
                </div>
              </div>

              {showDropdown && (
                <div className="hospital-dropdown-menu">
                  <div className="dropdown-header">
                    {hospital.logo && hospital.logo.trim() ? (
                      <img 
                        src={hospital.logo.trim()} 
                        alt="Hospital Logo" 
                        className="dropdown-logo"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="dropdown-logo-placeholder"
                      style={{ display: hospital.logo && hospital.logo.trim() ? 'none' : 'flex' }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="dropdown-info">
                      <h3 className="dropdown-hospital-name">{hospital.name}</h3>
                      <p className="dropdown-hospital-email">{user.email}</p>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-options">
                    <button onClick={handleProfileClick} className="dropdown-option">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      <span>Profile</span>
                    </button>
                    <button onClick={handleLogout} className="dropdown-option">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : user?.role === 'diagnostic_center_admin' && diagnosticCenter ? (
            <div 
              className="hospital-logo-dropdown" 
              ref={dropdownRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="hospital-logo-trigger">
                {diagnosticCenter.logo && diagnosticCenter.logo.trim() ? (
                  <img 
                    src={diagnosticCenter.logo.trim()} 
                    alt="Diagnostic Center Logo" 
                    className="hospital-logo-img"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="hospital-logo-placeholder"
                  style={{ display: diagnosticCenter.logo && diagnosticCenter.logo.trim() ? 'none' : 'flex' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" strokeWidth="2"/>
                  </svg>
                </div>
              </div>

              {showDropdown && (
                <div className="hospital-dropdown-menu">
                  <div className="dropdown-header">
                    {diagnosticCenter.logo && diagnosticCenter.logo.trim() ? (
                      <img 
                        src={diagnosticCenter.logo.trim()} 
                        alt="Diagnostic Center Logo" 
                        className="dropdown-logo"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="dropdown-logo-placeholder"
                      style={{ display: diagnosticCenter.logo && diagnosticCenter.logo.trim() ? 'none' : 'flex' }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="dropdown-info">
                      <h3 className="dropdown-hospital-name">{diagnosticCenter.name}</h3>
                      <p className="dropdown-hospital-email">{user.email}</p>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-options">
                    <button onClick={handleProfileClick} className="dropdown-option">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      <span>Profile</span>
                    </button>
                    <button onClick={handleLogout} className="dropdown-option">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : user?.role === 'patient' ? (
            <div 
              className="patient-dropdown" 
              ref={dropdownRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="patient-avatar-trigger">
                {user.profileImage ? (
                  <img 
                    src={user.profileImage} 
                    alt="Patient Avatar" 
                    className="patient-avatar-img"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="patient-avatar-placeholder"
                  style={{ display: user.profileImage ? 'none' : 'flex' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="patient-status-indicator"></div>
              </div>

              {showDropdown && (
                <div className="patient-dropdown-menu">
                  <div className="patient-dropdown-header">
                    {user.profileImage ? (
                      <img 
                        src={user.profileImage} 
                        alt="Patient Avatar" 
                        className="patient-dropdown-avatar"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="patient-dropdown-avatar-placeholder"
                      style={{ display: user.profileImage ? 'none' : 'flex' }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="patient-dropdown-info">
                      <h3 className="patient-dropdown-name">{user.name || 'Patient'}</h3>
                      <p className="patient-dropdown-email">{user.email}</p>
                      <div className="patient-role-badge">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <span>Patient Account</span>
                      </div>
                    </div>
                  </div>
                  <div className="patient-dropdown-divider"></div>
                  <div className="patient-dropdown-options">
                    <button onClick={handleDashboardClick} className="patient-dropdown-option">
                      <div className="option-icon dashboard">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                        </svg>
                      </div>
                      <div className="option-content">
                        <span className="option-title">Dashboard</span>
                        <span className="option-subtitle">View overview</span>
                      </div>
                    </button>
                    <button onClick={handleAppointmentsClick} className="patient-dropdown-option">
                      <div className="option-icon appointments">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="option-content">
                        <span className="option-title">Appointments</span>
                        <span className="option-subtitle">Manage bookings</span>
                      </div>
                    </button>
                    <button onClick={handleTestsClick} className="patient-dropdown-option">
                      <div className="option-icon tests">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM7 8a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="option-content">
                        <span className="option-title">Tests</span>
                        <span className="option-subtitle">Search & book serials</span>
                      </div>
                    </button>
                    <button onClick={handleTestOrdersClick} className="patient-dropdown-option">
                      <div className="option-icon tests">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="option-content">
                        <span className="option-title">Test Orders</span>
                        <span className="option-subtitle">Your bookings & orders</span>
                      </div>
                    </button>
                    <button onClick={handleHomeServicesClick} className="patient-dropdown-option">
                      <div className="option-icon services">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                        </svg>
                      </div>
                      <div className="option-content">
                        <span className="option-title">Home Services</span>
                        <span className="option-subtitle">Request services</span>
                      </div>
                    </button>
                    <div className="patient-dropdown-divider"></div>
                    <button onClick={handleProfileClick} className="patient-dropdown-option">
                      <div className="option-icon profile">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="option-content">
                        <span className="option-title">Profile Settings</span>
                        <span className="option-subtitle">Edit your profile</span>
                      </div>
                    </button>
                    <button onClick={handleLogout} className="patient-dropdown-option logout">
                      <div className="option-icon">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="option-content">
                        <span className="option-title">Logout</span>
                        <span className="option-subtitle">Sign out of account</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button onClick={logout} className="logout-button">
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

