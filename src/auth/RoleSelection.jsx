import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './RoleSelection.css';

const RoleSelection = () => {
  const [selectedRole, setSelectedRole] = useState('');
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    localStorage.setItem('selectedRole', role);
    navigate('/login');
  };

  return (
    <div className="role-selection-container">
      <div className="role-selection-card">
        <h1>Attendance Tracking System</h1>
        <p className="subtitle">Select your role to continue</p>
        
        <div className="role-options">
          <div 
            className="role-card student-card"
            onClick={() => handleRoleSelect('student')}
          >
            <div className="role-icon">🎓</div>
            <h2>Student</h2>
            <p>View your attendance and track progress</p>
          </div>

          <div 
            className="role-card teacher-card"
            onClick={() => handleRoleSelect('teacher')}
          >
            <div className="role-icon">👨‍🏫</div>
            <h2>Teacher</h2>
            <p>Manage classes and track student attendance</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;