// src/auth/Login.jsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState(""); // "student" | "teacher" (from RoleSelection)
  const navigate = useNavigate();

  // Load selected role from homepage (only for label + signup metadata)
  useEffect(() => {
    const selectedRole = localStorage.getItem("selectedRole");
    if (!selectedRole) {
      navigate("/");
      return;
    }
    setRole(selectedRole); // "student" or "teacher"
  }, [navigate]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    const cleanName = fullName.trim();

    try {
      // -------------------------
      // SIGN UP
      // -------------------------
      if (isSignUp) {
        if (!cleanName) {
          alert("Please enter your full name");
          setLoading(false);
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: cleanName, // 👈 goes into raw_user_meta_data
              role: role,           // 👈 "student" or "teacher"
            },
          },
        });

        if (signUpError) throw signUpError;

        alert("Account created! Please login.");
        setIsSignUp(false);
        setPassword("");
        return;
      }

      // -------------------------
      // LOGIN
      // -------------------------
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

      if (signInError) throw signInError;

      const user = signInData.user;
      if (!user) throw new Error("Could not load user");

      // Fetch profile from DB (created by trigger using metadata)
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (pErr) throw pErr;
      if (!profile) throw new Error("Profile missing. Check DB trigger.");

      const dbRole = profile.role || "student";

      // ✅ Redirect based on DB role (authoritative)
      if (dbRole === "teacher") {
        navigate("/teacher/dashboard");
      } else {
        navigate("/student/dashboard");
      }
    } catch (err) {
      console.error("Auth Error:", err);
      alert(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isSignUp ? "Create Account" : "Welcome Back"}</h2>

        <span className="role-badge">
          {role === "student" ? "🎓 Student" : "👨‍🏫 Teacher"}
        </span>

        <form onSubmit={handleAuth}>
          {isSignUp && (
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Enter your full name"
              />
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Enter password"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="auth-toggle">
          <p>
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="link-button"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>

        <button
          type="button"
          className="back-button"
          onClick={() => navigate("/")}
        >
          ← Change Role
        </button>
      </div>
    </div>
  );
};

export default Login;
