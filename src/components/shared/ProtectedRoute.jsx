// src/components/shared/ProtectedRoute.jsx
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";

const ProtectedRoute = ({ children, requiredRole }) => {
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const checkUser = async () => {
      setLoading(true);

      try {
        // get current user (client-side)
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("supabase getUser error:", userError);
          if (mounted) setIsAllowed(false);
          return;
        }

        if (!user) {
          // not logged in
          if (mounted) setIsAllowed(false);
          return;
        }

        // fetch profile role
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          // If profile doesn't exist or permission denied, deny access
          console.error("profile fetch error:", profileError);
          if (mounted) setIsAllowed(false);
          return;
        }

        const userRole = profile?.role || null;

        if (requiredRole) {
          if (userRole === requiredRole) {
            if (mounted) setIsAllowed(true);
          } else {
            if (mounted) setIsAllowed(false);
          }
        } else {
          // no required role -> any authenticated user allowed
          if (mounted) setIsAllowed(true);
        }
      } catch (err) {
        console.error("ProtectedRoute error:", err);
        if (mounted) setIsAllowed(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkUser();

    return () => {
      mounted = false;
    };
  }, [requiredRole, location]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAllowed) {
    // redirect to login and preserve current location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
