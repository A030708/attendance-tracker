// src/components/teacher/AttendanceReport.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const AttendanceReport = () => {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [logs, setLogs] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Per-student summary
  const [summary, setSummary] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // 👉 Dashboard metrics
  const totalStudents = summary.length;
  const totalSessions = sessions.length;
  const avgPercentage =
    totalStudents > 0
      ? Math.round(
          summary.reduce((sum, s) => sum + s.percentage, 0) / totalStudents
        )
      : 0;

  // load teacher + classes
  useEffect(() => {
    const load = async () => {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        console.error(userErr);
        alert("Error loading user");
        return;
      }
      const u = userRes?.user;
      setUser(u);

      const { data, error } = await supabase
        .from("classes")
        .select("id, name, class_code")
        .eq("teacher_id", u.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        alert("Failed to load classes");
        return;
      }

      setClasses(data || []);
    };

    load();
  }, []);

  // when class changes → load sessions + summary
  useEffect(() => {
    if (!selectedClass) {
      setSessions([]);
      setSelectedSession("");
      setLogs([]);
      setSummary([]);
      return;
    }
    loadSessions(selectedClass);
    loadSummaryForClass(selectedClass);
  }, [selectedClass]);

  // when session changes → load logs
  useEffect(() => {
    if (!selectedSession) {
      setLogs([]);
      return;
    }
    loadLogs(selectedSession);
  }, [selectedSession]);

  const loadSessions = async (classId) => {
    setLoadingSessions(true);
    try {
      const { data, error } = await supabase
        .from("attendance_sessions")
        .select("id, code, status, created_at")
        .eq("class_id", classId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        alert("Failed to load sessions");
        return;
      }

      setSessions(data || []);
      if (data && data.length > 0) {
        setSelectedSession(data[0].id);
      } else {
        setSelectedSession("");
      }
    } catch (err) {
      console.error(err);
      alert("Unexpected error loading sessions");
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadLogs = async (sessionId) => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select(`
          id,
          status,
          student_id,
          profiles (
            full_name
          )
        `)
        .eq("session_id", sessionId)
        .order("id", { ascending: true });

      if (error) {
        console.error(error);
        alert("Failed to load attendance logs");
        return;
      }

      setLogs(data || []);
    } catch (err) {
      console.error(err);
      alert("Unexpected error loading logs");
    } finally {
      setLoadingLogs(false);
    }
  };

  // 🔥 Per-student summary for a class (across all sessions)
  const loadSummaryForClass = async (classId) => {
    setLoadingSummary(true);
    try {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select(`
          id,
          status,
          student_id,
          profiles (
            full_name
          )
        `)
        .eq("class_id", classId);

      if (error) {
        console.error(error);
        alert("Failed to load class attendance summary");
        return;
      }

      const map = new Map(); // key: student_id

      (data || []).forEach((row) => {
        const sid = row.student_id;
        if (!map.has(sid)) {
          map.set(sid, {
            student_id: sid,
            name: row.profiles?.full_name || "Unnamed student",
            present: 0,
            absent: 0,
          });
        }
        const item = map.get(sid);
        if (row.status === "present") item.present += 1;
        else if (row.status === "absent") item.absent += 1;
      });

      const arr = Array.from(map.values()).map((item) => {
        const total = item.present + item.absent;
        const percentage =
          total > 0 ? Math.round((item.present / total) * 100) : 0;
        return { ...item, total, percentage };
      });

      setSummary(arr);
    } catch (err) {
      console.error(err);
      alert("Unexpected error loading summary: " + (err.message || err));
    } finally {
      setLoadingSummary(false);
    }
  };

  // ⭐ NEW: Export per-student summary as CSV
  const handleExportCSV = () => {
    if (!summary.length) {
      alert("No summary data to export");
      return;
    }

    const header = ["Student", "Present", "Absent", "Total", "Attendance %"];
    const rows = summary.map((s) => [
      s.name,
      s.present,
      s.absent,
      s.total,
      s.percentage,
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    // Optional: filename includes class id
    const fileName = `attendance-summary-${selectedClass || "class"}.csv`;

    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // simple card style
  const cardStyle = {
    flex: "1 1 160px",
    padding: "12px 16px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
  };

  const cardLabelStyle = { fontSize: 12, color: "#6b7280" };
  const cardValueStyle = { fontSize: 20, fontWeight: "bold", marginTop: 4 };

  return (
    <div className="attendance-report">
      <h2>Attendance Report</h2>

      {/* Class selector */}
      <div style={{ marginBottom: 12 }}>
        <label>Class:&nbsp;</label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          <option value="">-- Select class --</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.class_code})
            </option>
          ))}
        </select>
      </div>

      {/* Session selector */}
      <div style={{ marginBottom: 12 }}>
        <label>Session:&nbsp;</label>
        <select
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
          disabled={loadingSessions || sessions.length === 0}
        >
          {sessions.length === 0 ? (
            <option value="">No sessions</option>
          ) : (
            sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} | {new Date(s.created_at).toLocaleString()} ({s.status})
              </option>
            ))
          )}
        </select>
      </div>

      {/* 🔥 DASHBOARD SUMMARY CARDS */}
      {selectedClass && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            margin: "16px 0",
            flexWrap: "wrap",
          }}
        >
          <div style={cardStyle}>
            <div style={cardLabelStyle}>Total Students</div>
            <div style={cardValueStyle}>{totalStudents}</div>
          </div>

          <div style={cardStyle}>
            <div style={cardLabelStyle}>Total Sessions</div>
            <div style={cardValueStyle}>{totalSessions}</div>
          </div>

          <div style={cardStyle}>
            <div style={cardLabelStyle}>Average Attendance</div>
            <div style={cardValueStyle}>{avgPercentage}%</div>
          </div>
        </div>
      )}

      {/* SESSION LOGS */}
      <h3>Session Attendance Logs</h3>

      {loadingLogs ? (
        <p>Loading logs...</p>
      ) : logs.length === 0 ? (
        <p>No attendance records found for this session.</p>
      ) : (
        <table
          border="1"
          cellPadding="8"
          style={{ marginTop: 8, minWidth: 360 }}
        >
          <thead>
            <tr>
              <th>Student</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.profiles?.full_name || "Unnamed"}</td>
                <td>{log.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* PER-STUDENT SUMMARY */}
      <h3 style={{ marginTop: 24 }}>Per-Student Summary (Entire Class)</h3>

      {loadingSummary ? (
        <p>Loading summary...</p>
      ) : summary.length === 0 ? (
        <p>No attendance data found for this class yet.</p>
      ) : (
        <>
          {/* ⭐ Export button */}
          <button
            onClick={handleExportCSV}
            style={{ marginBottom: 8, padding: "6px 10px", cursor: "pointer" }}
          >
            ⬇ Export Summary CSV
          </button>

          <table
            border="1"
            cellPadding="8"
            style={{ marginTop: 8, minWidth: 480 }}
          >
            <thead>
              <tr>
                <th>Student</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Total</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.student_id}>
                  <td>{row.name}</td>
                  <td>{row.present}</td>
                  <td>{row.absent}</td>
                  <td>{row.total}</td>
                  <td>{row.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default AttendanceReport;
