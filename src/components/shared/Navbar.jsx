import { supabase } from "../../lib/supabase.js";
import "./Navbar.css";

const Navbar = ({ user, role }) => {
  const handleLogout = async () => {
    // Simple proof that click works
   

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Supabase signOut error:", e);
    } finally {
      // Clear any app + supabase-related storage
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("sb-") || key.toLowerCase().includes("supabase")) {
            localStorage.removeItem(key);
          }
        });
      } catch {}
      localStorage.removeItem("selectedRole");

      try {
        sessionStorage.clear();
      } catch {}

      // Hard reload to role selection
      window.location.href = "/";
    }
  };

  const icon =
    role === "student"
      ? "✍🏻"
      : role === "teacher"
      ? "👩🏻‍💻"
      : role === "org_admin"
      ? "🏫"
      : "👤";

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <h2>🗓️ Attendance Tracker</h2>
      </div>

      <div className="navbar-right">
        <span className="navbar-user">
          {icon} {user?.email || ""}
        </span>
        <button className="btn-logout" onClick={handleLogout}>
          LOGOUT
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
