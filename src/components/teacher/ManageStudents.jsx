// src/components/teacher/ManageStudents.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./ManageStudents.css";

const ManageStudents = () => {
  const [user, setUser] = useState(null);

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  // [{classStudentId, profileId, name, register_no, email, parent_email, joined_at}]
  const [students, setStudents] = useState([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState("");

  // CSV import state
  const [csvFile, setCsvFile] = useState(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importSummary, setImportSummary] = useState(null); // {updated, skipped}

  // 1) Load teacher
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("getUser error:", error);
        setError(error.message || "Failed to load user");
      } else {
        setUser(user);
      }
      setLoadingUser(false);
    };

    loadUser();
  }, []);

  // 2) Load teacher's classes
  useEffect(() => {
    if (!user) return;

    const loadClasses = async () => {
      setLoadingClasses(true);
      setError("");

      const { data, error } = await supabase
        .from("classes")
        .select("id, name, section, class_code, created_at")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("loadClasses error:", error);
        setError(error.message || "Failed to load classes");
      } else {
        setClasses(data || []);
      }

      setLoadingClasses(false);
    };

    loadClasses();
  }, [user]);

  // helper: load students using TWO queries (no joins, safe for parent_email)
  const loadStudentsForClass = async (classId) => {
    if (!classId) {
      setStudents([]);
      return;
    }

    setLoadingStudents(true);
    setError("");

    // 1) get class_students rows
    const { data: csData, error: csError } = await supabase
      .from("class_students")
      .select("id, joined_at, student_id")
      .eq("class_id", classId);

    if (csError) {
      console.error("loadStudents class_students error:", csError);
      setError(csError.message || "Failed to load students");
      setLoadingStudents(false);
      return;
    }

    const rows = csData || [];
    if (rows.length === 0) {
      setStudents([]);
      setLoadingStudents(false);
      return;
    }

    const studentIds = rows
      .map((r) => r.student_id)
      .filter((id) => !!id);

    if (studentIds.length === 0) {
      setStudents([]);
      setLoadingStudents(false);
      return;
    }

    // 2) get profiles with parent_email
    const { data: profData, error: profError } = await supabase
      .from("profiles")
      .select("id, full_name, register_no, email, parent_email")
      .in("id", studentIds);

    if (profError) {
      console.error("loadStudents profiles error:", profError);
      setError(profError.message || "Failed to load student profiles");
      setLoadingStudents(false);
      return;
    }

    const profileMap = new Map();
    (profData || []).forEach((p) => profileMap.set(p.id, p));

    const list =
      rows.map((r) => {
        const p = profileMap.get(r.student_id) || {};
        return {
          classStudentId: r.id,
          profileId: r.student_id,
          name: p.full_name || "Unknown",
          register_no: p.register_no || "",
          email: p.email || "",
          parent_email: p.parent_email || "",
          joined_at: r.joined_at,
        };
      }) || [];

    list.sort((a, b) => a.name.localeCompare(b.name));
    setStudents(list);
    setLoadingStudents(false);
  };

  // 3) Load students when class changes
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    loadStudentsForClass(selectedClassId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId]);

  const handleRemove = async (classStudentId) => {
    if (!selectedClassId) return;

    const confirmDelete = window.confirm(
      "Remove this student from the class?\nThey will no longer see this class in their dashboard."
    );
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from("class_students")
        .delete()
        .eq("id", classStudentId);

      if (error) throw error;

      setStudents((prev) =>
        prev.filter((s) => s.classStudentId !== classStudentId)
      );
    } catch (err) {
      console.error("remove student error:", err);
      alert(err.message || "Failed to remove student");
    }
  };

  // ========== CSV IMPORT HANDLERS ==========

  const handleCsvFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setCsvFile(file);
    setImportSummary(null);
  };

  const handleCsvImport = async () => {
    if (!selectedClassId) {
      alert("Select a class first.");
      return;
    }
    if (!csvFile) {
      alert("Choose a CSV file first.");
      return;
    }
    if (!students.length) {
      alert("No students in this class to update.");
      return;
    }

    setImportingCsv(true);
    setError("");
    setImportSummary(null);

    try {
      const text = await csvFile.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

      if (lines.length <= 1) {
        alert("CSV has no data rows.");
        setImportingCsv(false);
        return;
      }

      const headers = lines[0]
        .split(",")
        .map((h) => h.trim().toLowerCase());

      const idxReg = headers.indexOf("register_no");
      const idxFullName =
        headers.indexOf("full_name") !== -1
          ? headers.indexOf("full_name")
          : headers.indexOf("student_name");
      const idxStudentEmail = headers.indexOf("student_email");
      const idxParentEmail = headers.indexOf("parent_email");

      if (idxReg === -1) {
        alert('CSV must have a "register_no" column in the header.');
        setImportingCsv(false);
        return;
      }

      if (
        idxStudentEmail === -1 &&
        idxParentEmail === -1 &&
        idxFullName === -1
      ) {
        alert(
          'CSV must have at least one of: "student_email", "parent_email", "full_name"/"student_name".'
        );
        setImportingCsv(false);
        return;
      }

      // Only update students already in this class
      const allowedRegs = new Set(
        students.map((s) => (s.register_no || "").toString().trim())
      );

      let updated = 0;
      let skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        if (!row.trim()) continue;

        const cols = row.split(",");

        const reg = (cols[idxReg] || "").trim();
        if (!reg) {
          skipped++;
          continue;
        }

        if (!allowedRegs.has(reg)) {
          // register_no not in this class – skip
          skipped++;
          continue;
        }

        // 1) find profile row by register_no
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("id, register_no")
          .eq("register_no", reg)
          .maybeSingle();

        if (profErr) {
          console.error("Error fetching profile for", reg, profErr);
          skipped++;
          continue;
        }

        if (!prof) {
          console.warn("No profile row found in DB for register_no", reg);
          skipped++;
          continue;
        }

        const update = {};

        if (idxFullName !== -1 && cols[idxFullName] !== undefined) {
          const v = cols[idxFullName].trim();
          if (v) update.full_name = v;
        }

        if (idxStudentEmail !== -1 && cols[idxStudentEmail] !== undefined) {
          const v = cols[idxStudentEmail].trim();
          if (v) update.email = v;
        }

        if (idxParentEmail !== -1 && cols[idxParentEmail] !== undefined) {
          const v = cols[idxParentEmail].trim();
          if (v) update.parent_email = v;
        }

        if (Object.keys(update).length === 0) {
          skipped++;
          continue;
        }

        // 2) update that specific profile by id
        const { data: updData, error: updErr } = await supabase
          .from("profiles")
          .update(update)
          .eq("id", prof.id)
          .select("id, parent_email");

        if (updErr) {
          console.error("CSV update error for", reg, updErr);
          skipped++;
        } else if (!updData || updData.length === 0) {
          console.warn("Update did not return any row for register_no", reg);
          skipped++;
        } else {
          updated++;
        }
      }

      setImportSummary({ updated, skipped });

      // reload students to show updated emails
      await loadStudentsForClass(selectedClassId);
    } catch (err) {
      console.error("CSV import error:", err);
      alert(err.message || "Failed to import CSV");
    } finally {
      setImportingCsv(false);
    }
  };

  if (loadingUser) {
    return <div className="manage-students">Loading...</div>;
  }

  return (
    <div className="manage-students">
      <h2>Manage Students</h2>

      {error && (
        <p style={{ color: "red", marginBottom: "8px" }}>Error: {error}</p>
      )}

      {/* Class selector */}
      <div className="class-select" style={{ marginBottom: "16px" }}>
        <label style={{ marginRight: "8px" }}>Select Class:</label>
        <select
          value={selectedClassId}
          onChange={(e) => {
            setSelectedClassId(e.target.value);
            setStudents([]);
            setImportSummary(null);
          }}
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

      {loadingClasses && <p>Loading classes...</p>}

      {/* CSV Import UI */}
      {selectedClassId && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            background: "#f9fafb",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>
            Bulk Import Emails (CSV)
          </h3>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            CSV headers: <code>register_no</code>, optional:{" "}
            <code>full_name</code>/<code>student_name</code>,{" "}
            <code>student_email</code>, <code>parent_email</code>. Only
            students in this class are updated.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleCsvFileChange}
            />
            <button
              onClick={handleCsvImport}
              disabled={importingCsv || !csvFile}
            >
              {importingCsv ? "Importing..." : "Import CSV"}
            </button>
          </div>
          {importSummary && (
            <p style={{ marginTop: 8, fontSize: 13 }}>
              ✅ Updated: <strong>{importSummary.updated}</strong>, Skipped:{" "}
              <strong>{importSummary.skipped}</strong>
            </p>
          )}
        </div>
      )}

      {selectedClassId && (
        <>
          {loadingStudents ? (
            <p>Loading students...</p>
          ) : students.length === 0 ? (
            <p>No students joined this class yet.</p>
          ) : (
            <table className="students-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Name</th>
                  <th>Register No</th>
                  <th>Student Email</th>
                  <th>Parent Email</th>
                  <th>Joined At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, index) => (
                  <tr key={s.classStudentId}>
                    <td>{index + 1}</td>
                    <td>{s.name}</td>
                    <td>{s.register_no || "-"}</td>
                    <td>{s.email || "-"}</td>
                    <td>{s.parent_email || "-"}</td>
                    <td>
                      {s.joined_at
                        ? new Date(s.joined_at).toLocaleString()
                        : "-"}
                    </td>
                    <td>
                      <button
                        onClick={() => handleRemove(s.classStudentId)}
                        className="remove-btn"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
};

export default ManageStudents;
