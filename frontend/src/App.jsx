import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import HospitalLogin from './pages/HospitalLogin';
import HospitalRegister from './pages/HospitalRegister';
import HospitalProfile from './pages/HospitalProfile';
import HospitalDashboard from './pages/HospitalDashboard';
import DiagnosticCenterLogin from './pages/DiagnosticCenterLogin';
import DiagnosticCenterRegister from './pages/DiagnosticCenterRegister';
import DiagnosticCenterDashboard from './pages/DiagnosticCenterDashboard';
import DiagnosticCenterProfile from './pages/DiagnosticCenterProfile';
import UserDashboard from './pages/UserDashboard';
import UserProfile from './pages/UserProfile';
import SearchDoctors from './pages/SearchDoctors';
import SearchTests from './pages/SearchTests';
import BookAppointment from './pages/BookAppointment';
import Home from './pages/Home';
import SuperAdminLogin from './pages/SuperAdminLogin';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DoctorLogin from './pages/DoctorLogin';
import DoctorRegister from './pages/DoctorRegister';
import DoctorDashboard from './pages/DoctorDashboard';
import './App.css';

const PrivateRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, loading, user } = useAuth();
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '4px solid #e2e8f0', 
          borderTop: '4px solid #667eea', 
          borderRadius: '50%', 
          animation: 'spin 1s linear infinite' 
        }}></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(user?.role)) {
      return <Navigate to="/" />;
    }
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '4px solid #e2e8f0', 
          borderTop: '4px solid #667eea', 
          borderRadius: '50%', 
          animation: 'spin 1s linear infinite' 
        }}></div>
      </div>
    );
  }
  
  return !isAuthenticated ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          <Route 
            path="/register" 
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            } 
          />
          <Route 
            path="/hospital/login" 
            element={
              <PublicRoute>
                <HospitalLogin />
              </PublicRoute>
            } 
          />
          <Route 
            path="/hospital/register" 
            element={
              <PublicRoute>
                <HospitalRegister />
              </PublicRoute>
            } 
          />
          <Route 
            path="/hospital/dashboard" 
            element={
              <PrivateRoute requiredRole="hospital_admin">
                <HospitalDashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/hospital/profile" 
            element={
              <PrivateRoute requiredRole="hospital_admin">
                <HospitalProfile />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/diagnostic-center/login" 
            element={
              <PublicRoute>
                <DiagnosticCenterLogin />
              </PublicRoute>
            } 
          />
          <Route 
            path="/diagnostic-center/register" 
            element={
              <PublicRoute>
                <DiagnosticCenterRegister />
              </PublicRoute>
            } 
          />
          <Route 
            path="/diagnostic-center/dashboard" 
            element={
              <PrivateRoute requiredRole="diagnostic_center_admin">
                <DiagnosticCenterDashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/diagnostic-center/profile" 
            element={
              <PrivateRoute requiredRole="diagnostic_center_admin">
                <DiagnosticCenterProfile />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/user/dashboard" 
            element={
              <PrivateRoute requiredRole="patient">
                <UserDashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/user/profile" 
            element={
              <PrivateRoute requiredRole="patient">
                <UserProfile />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/search-doctors" 
            element={
              <PrivateRoute requiredRole="patient">
                <SearchDoctors />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/search-tests" 
            element={
              <PrivateRoute requiredRole="patient">
                <Navigate to="/user/dashboard" state={{ tab: 'tests' }} replace />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/book-appointment" 
            element={
              <PrivateRoute requiredRole="patient">
                <BookAppointment />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/super-admin/login" 
            element={
              <PublicRoute>
                <SuperAdminLogin />
              </PublicRoute>
            } 
          />
          <Route 
            path="/super-admin/dashboard" 
            element={
              <PrivateRoute requiredRole={['super_admin', 'super_admin_staff']}>
                <SuperAdminDashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/doctor/login" 
            element={
              <PublicRoute>
                <DoctorLogin />
              </PublicRoute>
            } 
          />
          <Route 
            path="/doctor/register" 
            element={
              <PublicRoute>
                <DoctorRegister />
              </PublicRoute>
            } 
          />
          <Route 
            path="/doctor/dashboard" 
            element={
              <PrivateRoute requiredRole={['doctor', 'doctor_staff']}>
                <DoctorDashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/" 
            element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
