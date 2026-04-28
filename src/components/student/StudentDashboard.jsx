// src/components/student/StudentDashboard.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import Navbar from "../shared/Navbar";
import JoinClass from "./JoinClass";
import StudentProfileSetup from "./StudentProfileSetup"; // 🔹 NEW
import "./StudentDashboard.css";

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("classes"); // classes | join | attendance

  // For attendance view
  const [attendanceClass, setAttendanceClass] = useState("");
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  useEffect(() => {
    loadUserAndClasses();
  }, []);

  const loadUserAndClasses = async () => {
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
      console.error("Student load error:", err);
      alert("Error loading dashboard: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Load classes the student has joined
  const loadClasses = async (studentId) => {
    try {
      const { data, error } = await supabase
        .from("class_students")
        .select(
          `
          class_id,
          joined_at,
          classes (
            id,
            name,
            section,
            class_code
          )
        `
        )
        .eq("student_id", studentId)
        .order("joined_at", { ascending: false });

      if (error) {
        console.error("Student classes load error:", error);
        alert("Error loading classes: " + error.message);
        return;
      }

      const list =
        data?.map((row) => ({
          id: row.classes.id,
          name: row.classes.name,
          section: row.classes.section,
          class_code: row.classes.class_code,
          joined_at: row.joined_at,
        })) || [];

      setClasses(list);
    } catch (err) {
      console.error("Student classes load error:", err);
      alert("Unexpected error loading classes: " + (err.message || err));
    }
  };

  // Realtime refresh when this student joins/leaves classes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("student-dashboard-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_students",
          filter: `student_id=eq.${user.id}`,
        },
        () => loadClasses(user.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // ✅ Load attendance logs for selected class
  const loadAttendanceForClass = async (classId) => {
    if (!user?.id || !classId) return;

    setAttendanceLoading(true);
    try {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select(
          `
          id,
          status,
          session_id,
          attendance_sessions (
            id,
            code,
            created_at
          )
        `
        )
        .eq("student_id", user.id)
        .eq("class_id", classId)
        .order("id", { ascending: false });

      if (error) {
        console.error("Attendance logs load error:", error);
        alert("Failed to load attendance logs");
        return;
      }

      setAttendanceLogs(data || []);
    } catch (err) {
      console.error("Attendance logs load error:", err);
      alert("Unexpected error loading attendance: " + (err.message || err));
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Compute stats
  const totalSessions = attendanceLogs.length;
  const presentCount = attendanceLogs.filter(
    (l) => l.status === "present"
  ).length;
  const absentCount = attendanceLogs.filter(
    (l) => l.status === "absent"
  ).length;
  const percentage =
    totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

  if (loading) return <div className="loading">Loading...</div>;

  // simple card styles (inline to avoid extra CSS)
  const cardStyle = {
    flex: "1 1 160px",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
  };
  const cardLabel = { fontSize: 12, color: "#6b7280" };
  const cardValue = { fontSize: 20, fontWeight: "bold", marginTop: 4 };

  return (
    <div className="dashboard">
      <Navbar user={user} role="student" />

      <div className="dashboard-content">
        <div className="welcome-section">
          <h1>Welcome, {profile?.full_name || user?.email}! 🎓</h1>
          <p>View your classes and track your attendance</p>
        </div>

        {/* 🔹 Ask student to set Register Number if missing */}
        <StudentProfileSetup />

        <div className="tabs">
          <button
            className={activeTab === "classes" ? "tab active" : "tab"}
            onClick={() => setActiveTab("classes")}
          >
            📚 My Classes ({classes.length})
          </button>

          <button
            className={activeTab === "join" ? "tab active" : "tab"}
            onClick={() => setActiveTab("join")}
          >
            ➕ Join Class
          </button>

          <button
            className={activeTab === "attendance" ? "tab active" : "tab"}
            onClick={() => setActiveTab("attendance")}
          >
            📈 Attendance
          </button>
        </div>

        <div className="tab-content">
          {/* MY CLASSES */}
          {activeTab === "classes" && (
            <div className="classes-list">
              <h2>My Classes</h2>
              {classes.length === 0 ? (
                <p>You have not joined any classes yet.</p>
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
                        🕒 Joined:{" "}
                        {new Date(cls.joined_at).toLocaleString()}
                      </p>

                      {/* View Attendance button */}
                      <button
                        style={{
                          marginTop: 8,
                          padding: "6px 10px",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setActiveTab("attendance");
                          setAttendanceClass(cls.id);
                          setAttendanceLogs([]);
                          loadAttendanceForClass(cls.id);
                        }}
                      >
                        📈 View Attendance
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* JOIN CLASS */}
          {activeTab === "join" && (
            <JoinClass onJoined={() => loadClasses(user.id)} />
          )}

          {/* ATTENDANCE TAB */}
          {activeTab === "attendance" && (
            <div className="attendance-view">
              <h2>My Attendance</h2>

              <div style={{ marginBottom: 12 }}>
                <label>Select Class:&nbsp;</label>
                <select
                  value={attendanceClass}
                  onChange={(e) => {
                    const classId = e.target.value;
                    setAttendanceClass(classId);
                    setAttendanceLogs([]);
                    if (classId) loadAttendanceForClass(classId);
                  }}
                >
                  <option value="">-- Select class --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.class_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Summary cards */}
              {attendanceClass && (
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    margin: "12px 0 16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={cardStyle}>
                    <div style={cardLabel}>Total Sessions</div>
                    <div style={cardValue}>{totalSessions}</div>
                  </div>
                  <div style={cardStyle}>
                    <div style={cardLabel}>Present</div>
                    <div style={cardValue}>{presentCount}</div>
                  </div>
                  <div style={cardStyle}>
                    <div style={cardLabel}>Absent</div>
                    <div style={cardValue}>{absentCount}</div>
                  </div>
                  <div style={cardStyle}>
                    <div style={cardLabel}>Attendance %</div>
                    <div style={cardValue}>{percentage}%</div>
                  </div>
                </div>
              )}

              {attendanceClass && (
                <>
                  {attendanceLoading ? (
                    <p>Loading attendance...</p>
                  ) : totalSessions === 0 ? (
                    <p>No attendance records found for this class yet.</p>
                  ) : (
                    <>
                      <table
                        border="1"
                        cellPadding="8"
                        style={{ marginTop: 8, minWidth: 450 }}
                      >
                        <thead>
                          <tr>
                            <th>Session</th>
                            <th>Date/Time</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceLogs.map((log) => (
                            <tr key={log.id}>
                              <td>{log.attendance_sessions?.code}</td>
                              <td>
                                {log.attendance_sessions?.created_at
                                  ? new Date(
                                      log.attendance_sessions.created_at
                                    ).toLocaleString()
                                  : "-"}
                              </td>
                              <td>{log.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
