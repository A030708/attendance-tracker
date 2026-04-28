import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationCode, setOrganizationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState(""); // "student" | "teacher"
  const navigate = useNavigate();

  // Load selected role from RoleSelection
  useEffect(() => {
    const selectedRole = localStorage.getItem("selectedRole");
    if (!selectedRole) {
      navigate("/");
      return;
    }
    setRole(selectedRole);
  }, [navigate]);

  // Teachers cannot sign up directly
  useEffect(() => {
    if (role === "teacher") {
      setIsSignUp(false);
    }
  }, [role]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    const cleanName = fullName.trim();
    const cleanOrgCode = organizationCode.trim().toUpperCase();

    try {
      // =========================
      // SIGN UP (STUDENTS ONLY)
      // =========================
      if (isSignUp) {
        if (role === "teacher") {
          alert(
            "Teachers cannot sign up directly. Your organization admin must create your account."
          );
          setLoading(false);
          return;
        }

        if (!cleanName) {
          alert("Please enter your full name");
          setLoading(false);
          return;
        }

        if (!cleanOrgCode) {
          alert("Please enter your organization code");
          setLoading(false);
          return;
        }

        // 1) Check org exists
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("id, org_code")
          .eq("org_code", cleanOrgCode)
          .maybeSingle();

        if (orgError || !org) {
          alert("Invalid organization code. Please check with your admin.");
          setLoading(false);
          return;
        }

        // 2) Create auth user
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
            options: {
              data: {
                full_name: cleanName,
                role: "student",
                org_code: cleanOrgCode,
              },
            },
          });

        if (signUpError) throw signUpError;

        const user = signUpData?.user;
        if (!user) {
          throw new Error(
            "Sign up succeeded but user is null. Check email confirmation settings."
          );
        }

        // 3) Manually create profile
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email: cleanEmail,
            full_name: cleanName,
            role: "student",
            org_code: org.org_code,
            organization_id: org.id,
          });

        if (profileError) throw profileError;

        alert("Account created! Please login.");
        setIsSignUp(false);
        setPassword("");
        return;
      }

      // =========================
      // LOGIN (STUDENT + TEACHER)
      // =========================
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

      if (signInError) throw signInError;

      const user = signInData?.user;
      if (!user) throw new Error("Could not load user");

      // Try to load profile
      let { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      // If profile missing (old accounts), create minimal one
      if (!profile && !pErr) {
        const roleFromMeta =
          user.user_metadata?.role === "teacher" ? "teacher" : "student";

        const { error: createProfileError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || "",
            role: roleFromMeta,
          });

        if (createProfileError) throw createProfileError;

        profile = { role: roleFromMeta };
      }

      if (pErr) throw pErr;
      if (!profile) throw new Error("Profile missing");

      const dbRole = profile.role || "student";

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

  const roleLabel =
    role === "student" ? "🎓 Student" : role === "teacher" ? "👨‍🏫 Teacher" : "User";

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isSignUp ? "Create Account" : "Welcome Back"}</h2>

        <span className="role-badge">{roleLabel}</span>

        <form onSubmit={handleAuth}>
          {/* Full Name only for signup */}
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

          {/* Org code only for student signup */}
          {isSignUp && role === "student" && (
            <div className="form-group">
              <label>Organization Code</label>
              <input
                type="text"
                value={organizationCode}
                onChange={(e) => setOrganizationCode(e.target.value.toUpperCase())}
                required
                placeholder="Enter code given by organization"
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

        {/* Signup toggle only for student */}
        {role === "student" && (
          <div className="auth-toggle">
            <p>
              {isSignUp
                ? "Already have an account?"
                : "Don't have an account?"}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="link-button"
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </p>
          </div>
        )}

        <button
          type="button"
          className="back-button"
          onClick={() => navigate("/")}
        >
          ← Change Role
        </button>

        <button
          type="button"
          className="link-button"
          onClick={() => navigate("/forgot-password")}
        >
          Forgot Password?
        </button>
      </div>
    </div>
  );
};

export default Login;