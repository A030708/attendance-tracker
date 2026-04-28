// src/App.jsx - UPDATED VERSION
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import RoleSelection from "./auth/RoleSelection";
import Login from "./auth/Login";
import ForgotPassword from "./auth/ForgotPassword";
import ResetPassword from "./auth/ResetPassword";

import StudentDashboard from "./components/student/StudentDashboard";
import TeacherDashboard from "./components/teacher/TeacherDashboard";
import TeacherAttendance from "./components/teacher/TeacherAttendance";

import ProtectedRoute from "./components/shared/ProtectedRoute";
import OrganizationLogin from "./auth/OrganizationLogin";
import OrganizationDashboard from "./components/organization/OrganizationDashboard";

// Import 2FA components
import TwoFactorSetup from "./auth/TwoFactorSetup";
import TwoFactorVerify from "./auth/TwoFactorVerify";
import TwoFASuccess from "./auth/TwoFASuccess";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<RoleSelection />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Organization auth routes */}
        <Route path="/organization/login" element={<OrganizationLogin />} />
        
        {/* 2FA Routes for Organization */}
        <Route path="/organization/setup-2fa" element={<TwoFactorSetup />} />
        <Route path="/organization/verify-2fa" element={<TwoFactorVerify />} />
        <Route path="/organization/2fa-success" element={<TwoFASuccess />} />

        {/* Student dashboard */}
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Teacher dashboard */}
        <Route
          path="/teacher/dashboard"
          element={
            <ProtectedRoute requiredRole="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />

        {/* Teacher attendance */}
        <Route
          path="/teacher/attendance"
          element={
            <ProtectedRoute requiredRole="teacher">
              <TeacherAttendance />
            </ProtectedRoute>
          }
        />


        {/* Organization dashboard */}
        <Route
          path="/organization/dashboard"
          element={
            <ProtectedRoute requiredRole="org_admin">
              <OrganizationDashboard />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;