// src/components/teacher/EditStudentRollNo.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./EditStudentRollNo.css";

const EditStudentRollNo = ({ classId, teacherId }) => {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [newRollNo, setNewRollNo] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (classId) loadStudents();
  }, [classId]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredStudents(students);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredStudents(
        students.filter(
          s =>
            s.name?.toLowerCase().includes(term) ||
            s.register_no?.toLowerCase().includes(term) ||
            s.email?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, students]);

  const loadStudents = async () => {
    try {
      setLoading(true);

      const { data: cs } = await supabase
        .from("class_students")
        .select("student_id, joined_at")
        .eq("class_id", classId);

      if (!cs?.length) {
        setStudents([]);
        setFilteredStudents([]);
        return;
      }

      const ids = cs.map(s => s.student_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, register_no, email, parent_email, roll_no_updated_at")
        .in("id", ids);

      const map = new Map(profiles.map(p => [p.id, p]));

      const list = cs.map((c, i) => {
        const p = map.get(c.student_id) || {};
        return {
          profileId: c.student_id,
          name: p.full_name || "Unknown",
          register_no: p.register_no || "",
          email: p.email || "",
          parent_email: p.parent_email || "",
          joined_at: c.joined_at,
          roll_no_updated_at: p.roll_no_updated_at
        };
      });

      setStudents(list);
      setFilteredStudents(list);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (student) => {
    setEditingId(student.profileId);
    setNewFullName(student.name || "");
    setNewRollNo(student.register_no || "");
    setError("");
    setSuccess("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewFullName("");
    setNewRollNo("");
  };

  const saveChanges = async (studentId) => {
    if (!newFullName || newRollNo.length !== 11) {
      setError("Valid name and 11-character Register Number required");
      return;
    }

    await supabase
      .from("profiles")
      .update({
        full_name: newFullName.trim(),
        register_no: newRollNo.trim(),
        roll_no_updated_at: new Date().toISOString(),
        roll_no_updated_by: teacherId
      })
      .eq("id", studentId);

    setSuccess("Student updated successfully");
    cancelEdit();
    loadStudents();
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="edit-rollno-container">
      <h2>Manage Student Information</h2>

      <input
        className="search-input"
        placeholder="Search students..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="students-table-container">
        <table className="students-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Full Name</th>
              <th>Register No</th>
              <th>Email</th>
              <th>Parent Email</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((s, i) => (
              <tr key={s.profileId}>
                <td>{i + 1}</td>
                <td>{s.name}</td>
                <td className="register-no">{s.register_no || "Not set"}</td>
                <td>{s.email || "-"}</td>
                <td>{s.parent_email || "-"}</td>
                <td>{new Date(s.joined_at).toLocaleDateString()}</td>
                <td>
                  <button className="btn-edit" onClick={() => startEdit(s)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== MODAL ===== */}
      {editingId && (
        <div className="edit-modal-overlay">
          <div className="edit-modal">
            <h3>Edit Student</h3>

            <label>Full Name</label>
            <input
              className="modal-input"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
            />

            <label>Register Number</label>
            <input
              className="modal-input mono"
              maxLength={11}
              value={newRollNo}
              onChange={(e) =>
                setNewRollNo(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                )
              }
            />

            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelEdit}>
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={() => saveChanges(editingId)}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditStudentRollNo;
