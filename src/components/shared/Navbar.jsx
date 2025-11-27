import { supabase } from "../../lib/supabase.js";

import { useNavigate } from 'react-router-dom';
import './Navbar.css';

const Navbar = ({ user, role }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('selectedRole');
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2>📚 Attendance Tracker</h2>
      </div>
      <div className="navbar-user">
        <span className="user-info">
          {role === 'student' ? '🎓' : '👨‍🏫'} {user?.email}
        </span>
        <button onClick={handleLogout} className="btn-logout">
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;