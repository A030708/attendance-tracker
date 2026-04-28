// src/components/shared/ProtectedRoute.jsx - UPDATED VERSION
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useEffect, useState } from "react";

const ProtectedRoute = ({ children, requiredRole }) => {
  const location = useLocation();
  const [authorized, setAuthorized] = useState(null); // null = loading
  const [requires2FA, setRequires2FA] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAuthorized(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, two_factor_enabled")
        .eq("id", user.id)
        .single();

      if (error || !profile) {
        setAuthorized(false);
        return;
      }

      if (requiredRole && profile.role !== requiredRole) {
        setAuthorized(false);
        return;
      }

      // Special handling for org_admin: check 2FA status
      if (requiredRole === "org_admin") {
        // Store 2FA status in session storage for this check
        const is2FAVerified = sessionStorage.getItem(`2fa_verified_${user.id}`) === 'true';
        
        if (profile.two_factor_enabled && !is2FAVerified) {
          // User has 2FA enabled but hasn't verified in this session
          setRequires2FA(true);
          setAuthorized(false);
          return;
        }
      }

      setAuthorized(true);
    };

    checkAccess();
  }, [requiredRole]);

  if (authorized === null) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Verifying access...</p>
      </div>
    );
  }

  if (requires2FA) {
    // Redirect to 2FA verification
    return (
      <Navigate
        to="/organization/verify-2fa"
        state={{ from: location }}
        replace
      />
    );
  }

  if (!authorized) {
    const redirectPath =
      requiredRole === "org_admin" ? "/organization/login" : "/login";

    return (
      <Navigate
        to={redirectPath}
        state={{ from: location }}
        replace
      />
    );
  }

  return children;
};

export default ProtectedRoute;