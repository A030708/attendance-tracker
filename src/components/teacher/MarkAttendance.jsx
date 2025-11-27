// src/components/teacher/MarkAttendance.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const TeacherMarkAttendance = () => {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]); // { student_id, name, status }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load current teacher + their classes
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

      if (!u) return;

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

  // Load students enrolled in selected class
  const loadStudentsForClass = async () => {
    if (!selectedClass) {
      alert("Please select a class");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("class_students")
        .select(
          `
          student_id,
          profiles (
            full_name
          )
        `
        )
        .eq("class_id", selectedClass)
        .order("joined_at", { ascending: true });

      if (error) {
        console.error(error);
        alert("Failed to load students");
        return;
      }

      const list =
        (data || []).map((row) => ({
          student_id: row.student_id,
          name: row.profiles?.full_name || "Unnamed student",
          status: "present", // default status
        })) || [];

      setStudents(list);
    } catch (err) {
      console.error(err);
      alert("Unexpected error loading students");
    } finally {
      setLoading(false);
    }
  };

  // Change Present/Absent for a student
  const handleStatusChange = (student_id, newStatus) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.student_id === student_id ? { ...s, status: newStatus } : s
      )
    );
  };

  // Save attendance for all students
  const handleSaveAttendance = async () => {
    if (!selectedClass) {
      alert("Select a class first");
      return;
    }
    if (!user) {
      alert("User not loaded, please re-login");
      return;
    }
    if (students.length === 0) {
      alert("No students to mark");
      return;
    }

    setSaving(true);

    try {
      // Build a simple manual session code e.g. MANUAL-20251126
      const dateCode = date.split("-").join(""); // "2025-11-26" -> "20251126"
      const codeForSession = `MANUAL-${dateCode}`;

      // 1) Create a session row (attendance_sessions)
      const { data: sessionData, error: sessionError } = await supabase
        .from("attendance_sessions")
        .insert({
          class_id: selectedClass,
          teacher_id: user.id,      // NOT NULL
          code: codeForSession,     // NOT NULL
          status: "closed",         // NOT NULL
          // no started_at column in your table
        })
        .select()
        .single();

      if (sessionError) {
        console.error(sessionError);
        alert(sessionError.message || "Failed to create attendance session");
        setSaving(false);
        return;
      }

      const sessionId = sessionData.id;

      // 2) Insert logs for each student (attendance_logs)
      const nowIso = new Date().toISOString();
      const logs = students.map((s) => ({
        session_id: sessionId,
        class_id: selectedClass,   // REQUIRED (NOT NULL)
        student_id: s.student_id,
        status: s.status,          // "present" or "absent"
        marked_at: nowIso,         // only if this column exists (it does in your table)
      }));

      const { error: logsError } = await supabase
        .from("attendance_logs")
        .insert(logs);

      if (logsError) {
        console.error(logsError);
        alert(logsError.message || "Failed to save attendance logs");
        setSaving(false);
        return;
      }

      alert("✅ Attendance saved successfully");
    } catch (err) {
      console.error(err);
      alert("Unexpected error saving attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mark-attendance">
      <h2>Mark Attendance (Teacher)</h2>

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

      <div style={{ marginBottom: 12 }}>
        <label>Date:&nbsp;</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <button
        onClick={loadStudentsForClass}
        disabled={loading || !selectedClass}
      >
        {loading ? "Loading..." : "Load Students"}
      </button>

      {students.length > 0 && (
        <>
          <table
            border="1"
            cellPadding="8"
            style={{ marginTop: 16, minWidth: 400 }}
          >
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.student_id}>
                  <td>{s.name}</td>
                  <td>
                    <select
                      value={s.status}
                      onChange={(e) =>
                        handleStatusChange(s.student_id, e.target.value)
                      }
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            style={{ marginTop: 16 }}
            onClick={handleSaveAttendance}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        </>
      )}
    </div>
  );
};

export default TeacherMarkAttendance;
