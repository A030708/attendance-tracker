// src/components/teacher/TeacherAttendance.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { exportToCsv } from "../../utils/csvExport";
import { exportAttendancePdf } from "../../utils/pdfExport";

const TeacherAttendance = () => {
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // get logged-in teacher
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("getUser error:", error);
        setError(error.message || "Failed to fetch user");
      } else {
        setUser(user);
      }
    };

    getUser();
  }, []);

  // build per-student summary for this teacher
  useEffect(() => {
    if (!user) return;

    const fetchSummary = async () => {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("attendance_logs")
        .select(
          `
          id,
          status,
          class_id,
          student_id,
          profiles:student_id (
            full_name,
            register_no,
            email
          ),
          attendance_sessions:session_id (
            teacher_id
          )
        `
        )
        .eq("attendance_sessions.teacher_id", user.id);

      if (error) {
        console.error("fetchSummary error:", error);
        setError(error.message || "Failed to fetch attendance");
        setLoading(false);
        return;
      }

      const summaryMap = new Map();

      (data || []).forEach((row) => {
        const prof = row.profiles || {};
        const key = row.student_id;

        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            studentId: key,
            name: prof.full_name || "Unknown",
            registerNo: prof.register_no || "",
            email: prof.email || "",
            totalClasses: 0,
            presentCount: 0,
          });
        }

        const s = summaryMap.get(key);
        s.totalClasses += 1;
        if (row.status && row.status.toLowerCase() === "present") {
          s.presentCount += 1;
        }
      });

      let summaryArr = Array.from(summaryMap.values()).map((s) => {
        const percentage =
          s.totalClasses > 0
            ? Math.round((s.presentCount / s.totalClasses) * 100)
            : 0;
        return { ...s, percentage };
      });

      // sort students alphabetically
      summaryArr.sort((a, b) => a.name.localeCompare(b.name));

      setSummary(summaryArr);
      setLoading(false);
    };

    fetchSummary();
  }, [user]);

  const handleExportCsv = () => {
    if (!summary || summary.length === 0) {
      alert("No attendance data to export");
      return;
    }

    const rows = summary.map((row, index) => ({
      SNo: index + 1,
      Name: row.name,
      RegisterNo: row.registerNo,
      TotalClasses: row.totalClasses,
      PresentClasses: row.presentCount,
      AttendancePercentage: row.percentage,
    }));

    exportToCsv("attendance-summary.csv", rows);
  };

  const handleExportPdf = () => {
    if (!summary || summary.length === 0) {
      alert("No attendance data to export");
      return;
    }
    exportAttendancePdf("attendance-summary.pdf", summary);
  };

  if (loading) {
    return <div style={{ padding: "16px" }}>Loading attendance...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "16px", color: "red" }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2>Attendance Records</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleExportCsv}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Export CSV
          </button>
          <button
            onClick={handleExportPdf}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Export PDF
          </button>
        </div>
      </div>

      {summary.length === 0 ? (
        <p>No attendance records found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "700px",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>S.No</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Register No</th>
                <th style={thStyle}>Total Classes</th>
                <th style={thStyle}>Present</th>
                <th style={thStyle}>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row, index) => (
                <tr key={row.studentId || index}>
                  <td style={tdStyle}>{index + 1}</td>
                  <td style={tdStyle}>{row.name}</td>
                  <td style={tdStyle}>{row.registerNo}</td>
                  <td style={tdStyle}>{row.totalClasses}</td>
                  <td style={tdStyle}>{row.presentCount}</td>
                  <td
                    style={{
                      ...tdStyle,
                      fontWeight: "bold",
                      color: row.percentage < 75 ? "red" : "green",
                    }}
                  >
                    {row.percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const thStyle = {
  border: "1px solid #ddd",
  padding: "8px",
  backgroundColor: "#f5f5f5",
  textAlign: "left",
  fontWeight: "bold",
};

const tdStyle = {
  border: "1px solid #ddd",
  padding: "8px",
  textAlign: "left",
};

export default TeacherAttendance;
