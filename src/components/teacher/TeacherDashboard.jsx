// src/components/teacher/TeacherDashboard.jsx
import { useState, useEffect } from "react";
import Navbar from "../shared/Navbar";
import CreateClass from "./CreateClass";
import ManageStudents from "./ManageStudents";
import MarkAttendance from "./MarkAttendance";
import AttendanceReport from "./AttendanceReport";
import "./TeacherDashboard.css";

import { supabase } from "../../lib/supabase";

const TeacherDashboard = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [activeTab, setActiveTab] = useState("classes"); // classes | create | manage | attendance | reports
  const [loading, setLoading] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);

  useEffect(() => {
    loadUserAndData();
  }, []);

  const loadUserAndData = async () => {
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const currentUser = userRes.user;
      setUser(currentUser);

      const { data: profileRes, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

      if (profileErr) throw profileErr;
      setProfile(profileRes);

      await loadClasses(currentUser.id);
    } catch (err) {
      console.error("Teacher load error:", err);
      alert("Error loading dashboard");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Load ONLY this teacher's classes
  const loadClasses = async (teacherId) => {
    try {
      setLoadingClasses(true);

      const { data, error } = await supabase
        .from("classes")
        .select("id, name, section, class_code, created_at")
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false });

      setLoadingClasses(false);

      if (error) {
        console.error("Class load error:", error);
        alert("Failed to load classes");
        return;
      }

      setClasses(data || []);
    } catch (err) {
      setLoadingClasses(false);
      console.error("Class load error:", err);
    }
  };

  // ❌ Delete class (for this teacher only)
  const handleDeleteClass = async (classId) => {
    if (!user?.id) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this class?\n" +
        "All enrollments and attendance for this class will be lost."
    );
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from("classes")
        .delete()
        .eq("id", classId)
        .eq("teacher_id", user.id); // extra safety

      if (error) {
        console.error("Delete class error:", error);
        alert(error.message || "Failed to delete class");
        return;
      }

      // Reload list after delete
      await loadClasses(user.id);
    } catch (err) {
      console.error("Unexpected delete error:", err);
      alert("Unexpected error deleting class: " + (err.message || err));
    }
  };

  // Optional realtime: refresh when classes change
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("teacher-dashboard-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "classes" },
        () => loadClasses(user.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <Navbar user={user} role="teacher" />

      <div className="dashboard-content">
        <div className="welcome-section">
          <h1>Welcome, {profile?.full_name || user?.email}! 👨‍🏫</h1>
          <p>Create and manage your classes</p>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={activeTab === "classes" ? "tab active" : "tab"}
            onClick={() => setActiveTab("classes")}
          >
            📚 My Classes ({classes.length})
          </button>

          <button
            className={activeTab === "create" ? "tab active" : "tab"}
            onClick={() => setActiveTab("create")}
          >
            ➕ Create Class
          </button>

          <button
            className={activeTab === "manage" ? "tab active" : "tab"}
            onClick={() => setActiveTab("manage")}
          >
            👥 Manage Students
          </button>

          <button
            className={activeTab === "attendance" ? "tab active" : "tab"}
            onClick={() => setActiveTab("attendance")}
          >
            ✓ Mark Attendance
          </button>

          <button
            className={activeTab === "reports" ? "tab active" : "tab"}
            onClick={() => setActiveTab("reports")}
          >
            📊 Reports
          </button>

          
        </div>

        {/* Tab content */}
        <div className="tab-content">
          {/* MY CLASSES */}
          {activeTab === "classes" && (
            <div className="classes-list">
              <h2>My Classes</h2>

              {loadingClasses ? (
                <p>Loading...</p>
              ) : classes.length === 0 ? (
                <div className="empty-state">
                  <p>You have not created any classes.</p>
                </div>
              ) : (
                <div className="classes-grid">
                  {classes.map((cls) => (
                    <div key={cls.id} className="class-card">
                      <h3>{cls.name}</h3>
                      {cls.section && (
                        <p className="subject">Section: {cls.section}</p>
                      )}
                      <p>🔑 Code: {cls.class_code}</p>
                      <p>
                        🕒 Created:{" "}
                        {new Date(cls.created_at).toLocaleString()}
                      </p>

                      <div className="class-actions">
                        <button
                          onClick={() => setActiveTab("manage")}
                          className="btn-secondary"
                        >
                          Manage
                        </button>
                        <button
                          onClick={() => handleDeleteClass(cls.id)}
                          className="btn-danger"
                          style={{ marginLeft: 8 }}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CREATE CLASS */}
          {activeTab === "create" && (
            <CreateClass onCreated={() => loadClasses(user.id)} />
          )}

          {/* MANAGE STUDENTS */}
          {activeTab === "manage" && <ManageStudents />}

          {/* MARK ATTENDANCE */}
          {activeTab === "attendance" && <MarkAttendance />}

          {/* REPORTS */}
          {activeTab === "reports" && <AttendanceReport />}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
