// src/components/teacher/TeacherDashboard.jsx
import { useState, useEffect } from "react";
import Navbar from "../shared/Navbar";
import CreateClass from "./CreateClass";
import ManageStudents from "./ManageStudents";
import MarkAttendance from "./MarkAttendance";
import AttendanceReport from "./AttendanceReport";
import EditStudentRollNo from "./EditStudentRollNo";
import "./TeacherDashboard.css";

import { supabase } from "../../lib/supabase";

const TeacherDashboard = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [activeTab, setActiveTab] = useState("classes");
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [error, setDashboardError] = useState("");

  useEffect(() => {
    loadUserAndData();
  }, []);

  const loadUserAndData = async () => {
    try {
      setLoading(true);
      setDashboardError("");

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      
      if (userErr) {
        console.error("Auth error:", userErr);
        setDashboardError("Authentication failed. Please login again.");
        setLoading(false);
        return;
      }

      if (!userRes?.user) {
        setDashboardError("No user found. Please login.");
        setLoading(false);
        return;
      }

      const currentUser = userRes.user;
      setUser(currentUser);

      // Check if profiles table exists
      const { data: profileRes, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

      if (profileErr) {
        // If profiles table doesn't exist, create a basic profile
        console.warn("Profile error:", profileErr);
        
        // Create a minimal profile if table exists but record doesn't
        if (profileErr.code === 'PGRST116') { // Record not found
          const { error: insertErr } = await supabase
            .from("profiles")
            .insert({
              id: currentUser.id,
              role: 'teacher',
              email: currentUser.email,
              full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0],
              active: true,
              is_active: true
            });

          if (insertErr) {
            console.error("Failed to create profile:", insertErr);
            setDashboardError("Failed to setup teacher profile. Please contact admin.");
            setLoading(false);
            return;
          }

          // Retry loading profile
          const { data: newProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .single();

          setProfile(newProfile);
        } else {
          setDashboardError("Database error: " + profileErr.message);
          setLoading(false);
          return;
        }
      } else {
        setProfile(profileRes);
        
        // Check if user is actually a teacher
        if (profileRes.role !== 'teacher') {
          setDashboardError("Access denied. This dashboard is for teachers only.");
          setLoading(false);
          return;
        }
      }

      await loadClasses(currentUser.id);
    } catch (err) {
      console.error("Teacher load error:", err);
      setDashboardError("Error loading dashboard: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async (teacherId) => {
    try {
      setLoadingClasses(true);
      
      // First check if classes table exists
      const { error: tableCheck } = await supabase
        .from("classes")
        .select("id")
        .limit(1);

      if (tableCheck) {
        console.warn("Classes table might not exist:", tableCheck);
        setClasses([]);
        setLoadingClasses(false);
        return;
      }

      // Load teacher's classes
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, section, class_code, created_at")
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Class load error:", error);
        setDashboardError("Failed to load classes: " + error.message);
        setClasses([]);
      } else {
        setClasses(data || []);
        // Auto-select first class
        if (data && data.length > 0 && !selectedClassId) {
          setSelectedClassId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Unexpected error loading classes:", err);
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  };

  const handleDeleteClass = async (classId) => {
    if (!user?.id) {
      alert("User not authenticated");
      return;
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this class?\n" +
      "All enrollments and attendance for this class will be lost."
    );
    
    if (!confirmDelete) return;

    try {
      // Check if class exists and belongs to teacher
      const { data: classData, error: checkError } = await supabase
        .from("classes")
        .select("id")
        .eq("id", classId)
        .eq("teacher_id", user.id)
        .single();

      if (checkError || !classData) {
        alert("Class not found or you don't have permission to delete it.");
        return;
      }

      // Delete the class
      const { error: deleteError } = await supabase
        .from("classes")
        .delete()
        .eq("id", classId);

      if (deleteError) {
        console.error("Delete class error:", deleteError);
        alert("Failed to delete class: " + deleteError.message);
        return;
      }

      alert("Class deleted successfully!");
      await loadClasses(user.id);
    } catch (err) {
      console.error("Unexpected delete error:", err);
      alert("Unexpected error: " + err.message);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to classes changes (only if table exists)
    const channel = supabase
      .channel("teacher-dashboard-classes")
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "classes",
          filter: `teacher_id=eq.${user.id}`
        },
        () => loadClasses(user.id)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("Subscribed to classes changes");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Reset selected class when switching to relevant tabs
  useEffect(() => {
    if ((activeTab === "manage" || activeTab === "rollnumbers") && 
        classes.length > 0 && 
        !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [activeTab, classes, selectedClassId]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading Teacher Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <Navbar user={user} role="teacher" />
        <div className="error-content">
          <h2>⚠️ Error Loading Dashboard</h2>
          <p>{error}</p>
          <button 
            onClick={loadUserAndData}
            className="btn-retry"
          >
            Retry
          </button>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="btn-logout"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (profile?.role !== 'teacher') {
    return (
      <div className="access-denied">
        <Navbar user={user} role="teacher" />
        <div className="denied-content">
          <h2>🔒 Access Denied</h2>
          <p>This dashboard is only accessible to teachers.</p>
          <p>Your role: {profile?.role || 'Not assigned'}</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="btn-home"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Navbar user={user} role="teacher" />

      <div className="dashboard-content">
        <div className="welcome-section">
          <h1>Welcome, {profile?.full_name || user?.email || 'Teacher'}! 👩🏻‍💻</h1>
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
            onClick={() => {
              if (classes.length === 0) {
                alert("Please create a class first");
                setActiveTab("create");
              } else {
                setActiveTab("manage");
              }
            }}
          >
            👥 Manage Students
          </button>

          <button
            className={activeTab === "attendance" ? "tab active" : "tab"}
            onClick={() => {
              if (classes.length === 0) {
                alert("Please create a class first");
                setActiveTab("create");
              } else {
                setActiveTab("attendance");
              }
            }}
          >
            ✓ Mark Attendance
          </button>

          <button
            className={activeTab === "reports" ? "tab active" : "tab"}
            onClick={() => {
              if (classes.length === 0) {
                alert("Please create a class first");
                setActiveTab("create");
              } else {
                setActiveTab("reports");
              }
            }}
          >
            📊 Reports / Export
          </button>

          <button
            className={activeTab === "rollnumbers" ? "tab active" : "tab"}
            onClick={() => {
              if (classes.length === 0) {
                alert("Please create a class first");
                setActiveTab("create");
              } else {
                setActiveTab("rollnumbers");
              }
            }}
          >
            🔢 Roll Numbers
          </button>
        </div>

        {/* Tab content */}
        <div className="tab-content">
          {/* MY CLASSES */}
          {activeTab === "classes" && (
            <div className="classes-list">
              <h2>My Classes</h2>

              {loadingClasses ? (
                <div className="loading-indicator">
                  <div className="spinner-small"></div>
                  <span>Loading classes...</span>
                </div>
              ) : classes.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📚</div>
                  <h3>No Classes Yet</h3>
                  <p>You haven't created any classes. Start by creating your first class.</p>
                  <button 
                    className="btn-primary"
                    onClick={() => setActiveTab("create")}
                  >
                    Create Your First Class
                  </button>
                </div>
              ) : (
                <div className="classes-grid">
                  {classes.map((cls) => (
                    <div key={cls.id} className="class-card">
                      <div className="class-card-header">
                        <h3>{cls.name}</h3>
                        {cls.section && (
                          <span className="class-section">Section: {cls.section}</span>
                        )}
                      </div>
                      
                      <div className="class-card-body">
                        <p>
                          <span className="icon">🔑</span>
                          <strong>Code:</strong> <code>{cls.class_code}</code>
                        </p>
                        <p>
                          <span className="icon">🕒</span>
                          <strong>Created:</strong> {new Date(cls.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="class-actions">
                        <button
                          onClick={() => {
                            setSelectedClassId(cls.id);
                            setActiveTab("rollnumbers");
                          }}
                          className="btn-secondary"
                          title="Manage roll numbers"
                        >
                          🔢 Roll Nos
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClassId(cls.id);
                            setActiveTab("manage");
                          }}
                          className="btn-secondary"
                        >
                          👥 Manage
                        </button>
                        <button
                          onClick={() => handleDeleteClass(cls.id)}
                          className="btn-danger"
                          title="Delete class"
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
            <CreateClass 
              onCreated={() => {
                loadClasses(user.id);
                setActiveTab("classes");
              }} 
            />
          )}

          {/* MANAGE STUDENTS */}
          {activeTab === "manage" && (
            <ManageStudents 
              selectedClassId={selectedClassId}
              onClassChange={(classId) => setSelectedClassId(classId)}
              classes={classes}
            />
          )}

          {/* MARK ATTENDANCE */}
          {activeTab === "attendance" && (
            <MarkAttendance 
              selectedClassId={selectedClassId}
              onClassChange={(classId) => setSelectedClassId(classId)}
              classes={classes}
            />
          )}

          {/* REPORTS / EXPORT */}
          {activeTab === "reports" && (
            <AttendanceReport 
              selectedClassId={selectedClassId}
              onClassChange={(classId) => setSelectedClassId(classId)}
              classes={classes}
            />
          )}

          {/* ROLL NUMBERS MANAGEMENT */}
          {activeTab === "rollnumbers" && (
            <div className="rollnumbers-section">
              <div className="section-header">
                <h2>Manage Student Roll Numbers</h2>
                <p className="section-subtitle">
                  Edit student roll numbers (11 digits, unique). 
                  You can edit within 7 days of last update.
                </p>
              </div>

              {classes.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔢</div>
                  <h3>No Classes</h3>
                  <p>You need to create a class first to manage roll numbers.</p>
                  <button 
                    className="btn-primary"
                    onClick={() => setActiveTab("create")}
                  >
                    Create a Class
                  </button>
                </div>
              ) : (
                <>
                  {/* Class Selector */}
                  <div className="class-selector">
                    <label>Select Class:</label>
                    <div className="class-buttons">
                      {classes.map(cls => (
                        <button
                          key={cls.id}
                          className={`class-btn ${selectedClassId === cls.id ? 'active' : ''}`}
                          onClick={() => setSelectedClassId(cls.id)}
                        >
                          {cls.name} 
                          {cls.section && ` (${cls.section})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Class Info */}
                  {selectedClassId && classes.find(c => c.id === selectedClassId) && (
                    <div className="selected-class-info">
                      <h3>
                        {classes.find(c => c.id === selectedClassId).name}
                        {classes.find(c => c.id === selectedClassId).section && 
                         ` - ${classes.find(c => c.id === selectedClassId).section}`}
                      </h3>
                      <p>Class Code: <code>{classes.find(c => c.id === selectedClassId).class_code}</code></p>
                    </div>
                  )}

                  {/* Roll Number Editor */}
                  {selectedClassId && user?.id && (
                    <EditStudentRollNo 
                      key={selectedClassId} // Force re-render when class changes
                      classId={selectedClassId} 
                      teacherId={user.id} 
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;