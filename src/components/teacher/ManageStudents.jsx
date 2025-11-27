// src/components/teacher/ManageStudents.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./ManageStudents.css";

const ManageStudents = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMyClasses();
  }, []);

  // ✅ Load ONLY logged-in teacher's classes
  const loadMyClasses = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) return;

    const { data, error } = await supabase
      .from("classes")
      .select("id, name, class_code")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Failed to load classes");
      return;
    }

    setClasses(data || []);
  };

  // ✅ Load students of selected class
  const fetchStudents = async (classId) => {
    setLoading(true);

    const { data, error } = await supabase
      .from("class_students")
      .select(`
        id,
        joined_at,
        profiles (
          id,
          full_name
        )
      `)
      .eq("class_id", classId)
      .order("joined_at", { ascending: false });

    setLoading(false);

    if (error) {
      console.error(error);
      alert("Failed to load students");
      return;
    }

    setStudents(data || []);
  };

  const handleClassChange = (e) => {
    const classId = e.target.value;
    setSelectedClass(classId);
    setStudents([]);

    if (classId) fetchStudents(classId);
  };

  // ✅ REAL delete (DB + refresh)
  const removeStudent = async (rowId) => {
    if (!confirm("Remove this student from the class?")) return;

    const { error } = await supabase
      .from("class_students")
      .delete()
      .eq("id", rowId);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    // ✅ reload from DB (important!)
    fetchStudents(selectedClass);
  };

  return (
    <div className="manage-students">
      <h2>Manage Students</h2>

      <label>Select Class:</label>
      <select value={selectedClass} onChange={handleClassChange}>
        <option value="">-- Select class --</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.class_code})
          </option>
        ))}
      </select>

      <br /><br />

      {selectedClass && (
        <>
          {loading && <p>Loading...</p>}

          {!loading && students.length === 0 && (
            <p>No students joined yet.</p>
          )}

          {!loading && students.length > 0 && (
            <table border="1" cellPadding="8">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Joined At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.profiles?.full_name || "Unnamed student"}</td>
                    <td>{new Date(s.joined_at).toLocaleString()}</td>
                    <td>
                      <button onClick={() => removeStudent(s.id)}>
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
