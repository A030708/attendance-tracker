// src/components/teacher/MarkAttendance.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./MarkAttendance.css";
import { sendAttendanceEmail } from "../../utils/sendEmail";
import { checkAttendanceEditPermission, checkAndAlertAttendancePermission, getTimeRemainingString } from "../../utils/attendanceTimeCheck";

// ✅ helper: today's date in LOCAL timezone as yyyy-mm-dd
const getTodayLocalDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const MarkAttendance = () => {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDate());
  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [canEditAttendance, setCanEditAttendance] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState("");

  // Function to check attendance editing permission
  const updateAttendancePermission = () => {
    const { isAllowed, hoursRemaining, minutesRemaining } = checkAttendanceEditPermission();
    setCanEditAttendance(isAllowed);
    if (isAllowed) {
      setTimeRemaining(`Time remaining: ${hoursRemaining}h ${minutesRemaining}m`);
    } else {
      setTimeRemaining("Editing closed (after 4:00 PM)");
    }
    return isAllowed;
  };

  // Update permission every minute
  useEffect(() => {
    updateAttendancePermission();
    const interval = setInterval(() => {
      updateAttendancePermission();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // 1) load teacher
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error(error);
        setError("Failed to load user");
      } else {
        setUser(user);
      }
      setLoadingUser(false);
    };
    loadUser();
  }, []);

  // 2) load classes for this teacher
  useEffect(() => {
    if (!user) return;

    const loadClasses = async () => {
      setLoadingClasses(true);
      setError("");

      const { data, error } = await supabase
        .from("classes")
        .select("id, name, section, class_code")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setError("Failed to load classes");
      } else {
        setClasses(data || []);
      }

      setLoadingClasses(false);
    };

    loadClasses();
  }, [user]);

  // 3) load students when clicking "Load Students"
  const handleLoadStudents = async () => {
    if (!selectedClassId) {
      alert("Please select a class");
      return;
    }
    if (!selectedDate) {
      alert("Please select a date");
      return;
    }

    setLoadingStudents(true);
    setError("");

    const { data, error } = await supabase
      .from("class_students")
      .select(
        `
        id,
        student_id,
        profiles:student_id (
          full_name,
          register_no,
          email
        )
      `
      )
      .eq("class_id", selectedClassId);

    setLoadingStudents(false);

    if (error) {
      console.error("loadStudents error:", error);
      setError("Failed to load students for class");
      return;
    }

    let list =
      data?.map((row) => ({
        id: row.student_id,
        full_name: row.profiles?.full_name || "Unknown",
        register_no: row.profiles?.register_no || "",
        email: row.profiles?.email || "",
      })) || [];

    // sort by name A–Z
    list.sort((a, b) => a.full_name.localeCompare(b.full_name));

    // default everyone present
    const initialStatuses = {};
    list.forEach((s) => {
      initialStatuses[s.id] = "present";
    });

    setStudents(list);
    setStatuses(initialStatuses);
    setStudentsLoaded(true);
  };

  const handleStatusChange = (studentId, status) => {
    if (!updateAttendancePermission()) {
      alert("Attendance editing is only allowed until 4:00 PM");
      return;
    }
    
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  // 4) save attendance (with one-session-per-day rule)
  const handleSubmit = async () => {
    if (!updateAttendancePermission()) {
      alert("Attendance editing is only allowed until 4:00 PM");
      return;
    }

    if (!selectedClassId) {
      alert("Please select a class");
      return;
    }
    if (!selectedDate) {
      alert("Please select a date");
      return;
    }
    if (!studentsLoaded || students.length === 0) {
      alert("Click 'Load Students' first.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // ====== DATE RANGE FOR THAT DAY ======
      // selectedDate is already yyyy-mm-dd in LOCAL time
      const dayStart = new Date(selectedDate + "T00:00:00");
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      // 🔴 CHECK: any session already exists for this class on this date?
      const { data: existingSessions, error: existingErr } = await supabase
        .from("attendance_sessions")
        .select("id, code, starts_at")
        .eq("class_id", selectedClassId)
        .eq("teacher_id", user.id)
        .gte("starts_at", dayStart.toISOString())
        .lt("starts_at", dayEnd.toISOString());

      if (existingErr) throw existingErr;

      if (existingSessions && existingSessions.length > 0) {
        setSaving(false);
        alert(
          "Attendance for this class on this date is already taken.\n\n" +
            "Only one attendance session is allowed per day for a class."
        );
        return;
      }

      // ====== CREATE SESSION FOR THIS DAY ======
      const sessionIso = dayStart.toISOString(); // store UTC timestamp

      const sessionCode =
        "SES-" +
        Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data: sessionData, error: sessionError } = await supabase
        .from("attendance_sessions")
        .insert([
          {
            class_id: selectedClassId,
            teacher_id: user.id,
            code: sessionCode,
            starts_at: sessionIso,
            ends_at: sessionIso,
            started_at: sessionIso,
          },
        ])
        .select("id")
        .single();

      if (sessionError) throw sessionError;
      const sessionId = sessionData.id;

      // ====== INSERT LOGS ======
      // ✅ add attendance_date using the selectedDate (LOCAL)
      const logs = students.map((s) => ({
        session_id: sessionId,
        class_id: selectedClassId,
        student_id: s.id,
        status: statuses[s.id] || "present",
        marked_at: sessionIso,
        attendance_date: selectedDate, // ✅ CRITICAL
      }));

      const { error: logsError } = await supabase
        .from("attendance_logs")
        .insert(logs);

      if (logsError) throw logsError;

      // ====== EMAILS ======

      // absent emails
      for (const s of students) {
        const status = (statuses[s.id] || "present").toLowerCase();
        if (status === "absent" && s.email) {
          sendAttendanceEmail({
            type: "absent",
            studentEmail: s.email,
            studentName: s.full_name,
          });
        }
      }

      // low-percentage emails (< 75%)
      for (const s of students) {
        if (!s.email) continue;

        const { data: logsByStudent, error: logsByStudentError } =
          await supabase
            .from("attendance_logs")
            .select("status")
            .eq("class_id", selectedClassId)
            .eq("student_id", s.id);

        if (logsByStudentError || !logsByStudent) continue;

        const total = logsByStudent.length;
        const present = logsByStudent.filter(
          (l) => l.status && l.status.toLowerCase() === "present"
        ).length;
        const percentage =
          total > 0 ? Math.round((present / total) * 100) : 0;

        if (percentage < 75) {
          await sendAttendanceEmail({
            type: "low_percentage",
            studentEmail: s.email,
            studentName: s.full_name,
            percentage,
          });
        }
      }

      alert("Attendance saved (emails logged in console).");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser) return <div>Loading...</div>;

  return (
    <div className="mark-attendance">
      <h2>Mark Attendance (Teacher)</h2>

      {/* Attendance Time Status */}
      <div className={`time-status ${canEditAttendance ? 'time-status-open' : 'time-status-closed'}`}>
        {canEditAttendance ? (
          <>
            <span className="time-status-icon">✅</span>
            <span className="time-status-text">{timeRemaining}</span>
          </>
        ) : (
          <>
            <span className="time-status-icon">⏰</span>
            <span className="time-status-text">Attendance editing closed (after 4:00 PM)</span>
          </>
        )}
      </div>

      {error && (
        <p style={{ color: "red", marginBottom: "8px" }}>Error: {error}</p>
      )}

      {/* Class + Date row */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ marginRight: 8 }}>Class:</label>
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setStudents([]);
              setStatuses({});
              setStudentsLoaded(false);
            }}
            disabled={!canEditAttendance}
            className={!canEditAttendance ? "disabled-select" : ""}
          >
            <option value="">-- Select class --</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
                {cls.section ? ` (${cls.section})` : ""} ({cls.class_code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ marginRight: 8 }}>Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setStudentsLoaded(false);
            }}
            disabled={!canEditAttendance}
            className={!canEditAttendance ? "disabled-input" : ""}
          />
        </div>
      </div>

      <button
        onClick={handleLoadStudents}
        disabled={loadingStudents || !selectedClassId || !selectedDate || !canEditAttendance}
        style={{ marginBottom: 16 }}
        className={!canEditAttendance ? "disabled-button" : ""}
      >
        {loadingStudents ? "Loading..." : "Load Students"}
      </button>

      {/* Students table */}
      {studentsLoaded && students.length === 0 && (
        <p>No students joined this class yet.</p>
      )}

      {students.length > 0 && (
        <div className="students-table-wrapper">
          <table className="students-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Name</th>
                <th>Register No</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, index) => (
                <tr key={s.id}>
                  <td>{index + 1}</td>
                  <td>{s.full_name}</td>
                  <td>{s.register_no || "-"}</td>
                  <td>
                    <div>
                      <label>
                        <input
                          type="radio"
                          name={`status-${s.id}`}
                          value="present"
                          checked={
                            (statuses[s.id] || "present") === "present"
                          }
                          onChange={(e) =>
                            handleStatusChange(s.id, e.target.value)
                          }
                          disabled={!canEditAttendance}
                        />
                        &nbsp;Present
                      </label>

                      <label style={{ marginLeft: 12 }}>
                        <input
                          type="radio"
                          name={`status-${s.id}`}
                          value="absent"
                          checked={statuses[s.id] === "absent"}
                          onChange={(e) =>
                            handleStatusChange(s.id, e.target.value)
                          }
                          disabled={!canEditAttendance}
                        />
                        &nbsp;Absent
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            className={`submit-btn ${!canEditAttendance ? 'disabled-submit' : ''}`}
            onClick={handleSubmit}
            disabled={saving || !canEditAttendance}
            style={{ marginTop: 12 }}
          >
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        </div>
      )}
    </div>
  );
};

export default MarkAttendance;