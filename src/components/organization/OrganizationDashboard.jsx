// src/components/organization/OrganizationDashboard.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./OrganizationDashboard.css";

// ===========================
// DATE HELPERS
// ===========================
const toLocalDateKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getLogDateKey = (log) => {
  if (log.attendance_date) {
    if (typeof log.attendance_date === "string") {
      return log.attendance_date.slice(0, 10);
    }
    const key = toLocalDateKey(log.attendance_date);
    if (key) return key;
  }

  if (log.marked_at) {
    const key = toLocalDateKey(log.marked_at);
    if (key) return key;
  }

  if (log.date) return String(log.date).slice(0, 10);
  if (log.class_date) return String(log.class_date).slice(0, 10);
  if (log.created_at) {
    const key = toLocalDateKey(log.created_at);
    if (key) return key;
  }

  return null;
};

const formatLogDate = (log) => {
  const dateKey = getLogDateKey(log);
  if (!dateKey) return "Unknown";

  const d = new Date(dateKey + "T00:00:00");
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return dateKey;
};

const formatTime = (date) => {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "N/A";
  }
};

// ===========================
// ICON COMPONENTS
// ===========================
const Icon = ({ name, size = 20, color = "currentColor", className = "" }) => {
  const icons = {
    users: "👥",
    user: "👤",
    userCheck: "✅",
    userX: "❌",
    trendingUp: "📈",
    plus: "➕",
    search: "🔍",
    trash: "🗑️",
    eye: "👁️",
    chevronRight: "▶",
    chevronDown: "▼",
    refresh: "🔄",
    alert: "⚠️",
    calendar: "📅",
    book: "📚",
    home: "🏠",
    chart: "📊",
    settings: "⚙️",
    clock: "⏰",
    percent: "%",
    activity: "📈",
    star: "⭐",
    award: "🏆",
    target: "🎯",
    filter: "🔧",
    download: "📥",
    mail: "✉️",
    phone: "📱",
    map: "📍",
    globe: "🌐",
    checkCircle: "✅",
    xCircle: "❌",
    edit: "✏️",
    more: "⋯",
    clipboard: "📋",
    database: "💾",
    layers: "📑",
    pieChart: "🥧",
    thermometer: "🌡️",
    logout: "🚪",
    bell: "🔔",
    arrowLeft: "←",
    lock: "🔒",
  };

  return (
    <span
      className={`icon ${className}`}
      style={{
        fontSize: `${size}px`,
        color: color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icons[name] || "⚫"}
    </span>
  );
};

const OrganizationDashboard = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [org, setOrg] = useState(null);

  // overview
  const [overview, setOverview] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    presentToday: 0,
    absentToday: 0,
    overallPercent: 0,
  });

  // teacher management
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [creatingTeacher, setCreatingTeacher] = useState(false);
  const [teacherDetail, setTeacherDetail] = useState(null);
  const [loadingTeacherDetail, setLoadingTeacherDetail] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherStats, setTeacherStats] = useState([]);
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [expandedTeacherClasses, setExpandedTeacherClasses] = useState({});

  // student management
  const [studentQuery, setStudentQuery] = useState("");
  const [students, setStudents] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);

  // student 360 view
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [classAttendanceData, setClassAttendanceData] = useState({});
  const [expandedClasses, setExpandedClasses] = useState({});

  // analytics
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // UI states
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTeacherForm, setShowTeacherForm] = useState(false);

  // ===========================
  // HELPER FUNCTIONS
  // ===========================
  const fixTeacherOrganization = async (teacherId, orgCode) => {
    try {
      // Find organization by code
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('org_code', orgCode)
        .single();
      
      if (orgError || !orgData) {
        console.error('Organization not found for code:', orgCode);
        return false;
      }
      
      // Update teacher's profile with organization_id
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ organization_id: orgData.id })
        .eq('id', teacherId);
      
      if (updateError) {
        console.error('Failed to update teacher organization:', updateError);
        return false;
      }
      
      console.log('Fixed organization link for teacher:', teacherId);
      return true;
    } catch (err) {
      console.error('Error fixing teacher organization:', err);
      return false;
    }
  };

  // ===========================
  // FIX ALL TEACHERS ORGANIZATION
  // ===========================
  const fixAllTeachersOrganization = async () => {
    if (!org) return;
    
    if (!window.confirm('This will fix organization links for ALL teachers. Continue?')) {
      return;
    }

    try {
      // Get all teachers without organization_id or with wrong organization_id
      const { data: teachers, error } = await supabase
        .from('profiles')
        .select('id, email, org_code')
        .eq('role', 'teacher')
        .or(`organization_id.is.null,organization_id.eq.${org.id}`)
        .eq('org_code', org.org_code);

      if (error) throw error;

      let fixedCount = 0;
      for (const teacher of teachers || []) {
        await supabase
          .from('profiles')
          .update({ organization_id: org.id })
          .eq('id', teacher.id);
        fixedCount++;
      }

      alert(`✅ Fixed organization links for ${fixedCount} teachers!`);
      await loadTeachers(org.id, org.org_code);
    } catch (err) {
      console.error('Error fixing teachers:', err);
      alert('Failed to fix teachers: ' + err.message);
    }
  };

  // ===========================
  // LOAD STUDENT FUNCTION
  // ===========================
  const loadStudents = async () => {
    if (!org) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, register_no, email, parent_email, active, organization_id, created_at"
        )
        .eq("organization_id", org.id)
        .eq("role", "student")
        .order("full_name", { ascending: true });

      if (error) {
        console.error("Load students error:", error);
        return;
      }

      setStudents(data || []);
    } catch (err) {
      console.error("Load students error:", err);
    }
  };

  // ===========================
  // DELETE STUDENT FUNCTION
  // ===========================
  const handleDeleteStudent = async (studentId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this student? This action cannot be undone!"
      )
    ) {
      return;
    }

    try {
      // First, delete attendance logs
      await supabase.from("attendance_logs").delete().eq("student_id", studentId);

      // Delete from class_students
      await supabase.from("class_students").delete().eq("student_id", studentId);

      // Delete student profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", studentId);

      if (profileError) throw profileError;

      // Try to delete auth user
      try {
        await supabase.auth.admin.deleteUser(studentId);
      } catch (authErr) {
        console.warn("Could not delete auth user:", authErr);
      }

      alert("Student deleted successfully.");
      await loadStudents();
      await loadOverview(org.id);
    } catch (err) {
      console.error("Delete student error:", err);
      alert(err.message || "Failed to delete student");
    }
  };

  // ===========================
  // INITIAL LOAD
  // ===========================
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          console.error("Org load user error:", error);
          setLoading(false);
          return;
        }
        const currentUser = data.user;
        setUser(currentUser);

        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("id, role, full_name, organization_id, org_code, email")
          .eq("id", currentUser.id)
          .single();

        if (profErr || !prof) {
          console.error("Org load profile error:", profErr);
          setLoading(false);
          return;
        }

        if (prof.role !== "org_admin") {
          alert("You are not an organization admin");
          setLoading(false);
          return;
        }
        setProfile(prof);

        let orgRow = null;
        if (prof.organization_id) {
          const { data: orgData, error: orgErr } = await supabase
            .from("organizations")
            .select("id, name, org_code, created_by, created_at")
            .eq("id", prof.organization_id)
            .single();
          if (!orgErr) orgRow = orgData;
        }

        if (!orgRow) {
          const { data: orgData2, error: orgErr2 } = await supabase
            .from("organizations")
            .select("id, name, org_code, created_by, created_at")
            .eq("created_by", currentUser.id)
            .maybeSingle();
          if (!orgErr2) orgRow = orgData2;
        }

        if (!orgRow) {
          alert("Organization record not found. Please contact support.");
          setLoading(false);
          return;
        }

        setOrg(orgRow);

        if (!prof.organization_id) {
          await supabase
            .from("profiles")
            .update({ organization_id: orgRow.id, org_code: orgRow.org_code })
            .eq("id", prof.id);
        }

        await Promise.all([
          loadTeachers(orgRow.id, orgRow.org_code),
          loadOverview(orgRow.id),
          loadStudents(),
        ]);
      } catch (err) {
        console.error("Initial load error:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ===========================
  // LOAD TEACHERS WITH STATS
  // ===========================
  const loadTeachers = async (orgId, orgCode) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, register_no, active, organization_id, org_code, created_at"
        )
        .or(`organization_id.eq.${orgId},org_code.eq.${orgCode}`)
        .eq("role", "teacher")
        .order("full_name", { ascending: true });

      if (error) {
        console.error("Load teachers error:", error);
        return;
      }

      // Load individual teacher stats
      const teachersWithStats = await Promise.all(
        (data || []).map(async (teacher) => {
          try {
            // Get teacher's classes
            const { data: classesData } = await supabase
              .from("classes")
              .select("id")
              .eq("teacher_id", teacher.id);

            const classIds = classesData?.map((c) => c.id) || [];

            let totalStudents = 0;
            let totalAttendanceLogs = 0;
            let presentLogs = 0;

            if (classIds.length > 0) {
              // Get student count across all classes
              const { count: studentCount } = await supabase
                .from("class_students")
                .select("student_id", { count: "exact", head: true })
                .in("class_id", classIds);

              totalStudents = studentCount || 0;

              // Get attendance logs for these classes
              const { data: logsData } = await supabase
                .from("attendance_logs")
                .select("status")
                .in("class_id", classIds);

              totalAttendanceLogs = logsData?.length || 0;
              presentLogs =
                logsData?.filter((l) => l.status === "present").length || 0;
            }

            const attendancePercent =
              totalAttendanceLogs > 0
                ? Math.round((presentLogs / totalAttendanceLogs) * 100)
                : 0;

            return {
              ...teacher,
              classCount: classIds.length,
              studentCount: totalStudents,
              attendancePercent,
            };
          } catch (err) {
            console.error(`Error loading stats for teacher ${teacher.id}:`, err);
            return {
              ...teacher,
              classCount: 0,
              studentCount: 0,
              attendancePercent: 0,
            };
          }
        })
      );

      setTeachers(teachersWithStats);
    } catch (err) {
      console.error("Load teachers error:", err);
    }
  };

  // ===========================
  // OVERVIEW METRICS
  // ===========================
  const loadOverview = async (orgId) => {
    try {
      // counts
      const { count: teacherCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("role", "teacher");

      const { count: studentCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("role", "student");

      // today (LOCAL)
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const todayDate = `${yyyy}-${mm}-${dd}`;

      // Get classes for this organization
      const { data: orgClasses } = await supabase
        .from("classes")
        .select("id")
        .eq("organization_id", orgId);

      const classIds = orgClasses?.map((c) => c.id) || [];

      let presentToday = 0;
      let absentToday = 0;

      if (classIds.length > 0) {
        const { data: todayLogs } = await supabase
          .from("attendance_logs")
          .select("status")
          .in("class_id", classIds)
          .eq("attendance_date", todayDate);

        presentToday =
          todayLogs?.filter((l) => l.status === "present").length || 0;
        absentToday =
          todayLogs?.filter((l) => l.status === "absent").length || 0;
      }

      // OVERALL %
      let overallPercent = 0;
      if (classIds.length > 0) {
        const { data: allLogs } = await supabase
          .from("attendance_logs")
          .select("status")
          .in("class_id", classIds);

        const total = allLogs?.length || 0;
        const present =
          allLogs?.filter((l) => l.status === "present").length || 0;
        overallPercent = total > 0 ? Math.round((present / total) * 100) : 0;
      }

      setOverview({
        totalStudents: studentCount || 0,
        totalTeachers: teacherCount || 0,
        presentToday,
        absentToday,
        overallPercent,
      });
    } catch (err) {
      console.error("Overview error:", err);
    }
  };

  // ===========================
  // CREATE TEACHER - FIXED VERSION (ENSURES ORGANIZATION LINK)
  // ===========================
  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    if (!org) return;

    const cleanName = teacherName.trim();
    const cleanEmail = teacherEmail.trim().toLowerCase();
    const cleanPassword = teacherPassword.trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      alert("Please fill all required fields");
      return;
    }

    if (cleanPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      alert("Please enter a valid email address");
      return;
    }

    setCreatingTeacher(true);
    let teacherId = null;
    
    try {
      // Check if email already exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (existing) {
        alert("A teacher with this email already exists.");
        setCreatingTeacher(false);
        return;
      }

      // Create auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
        {
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: cleanName,
              role: "teacher",
              org_code: org.org_code,
            },
          },
        }
      );

      if (signUpError) {
        // If email already exists in auth, create just the profile
        if (signUpError.message.includes("already registered")) {
          // Create profile only
          teacherId =
            "teacher_" +
            Date.now() +
            "_" +
            Math.random().toString(36).substr(2, 9);

          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: teacherId,
              email: cleanEmail,
              full_name: cleanName,
              role: "teacher",
              org_code: org.org_code,
              organization_id: org.id,  // CRITICAL: Direct organization link
              active: true,
              temp_password: cleanPassword,
            });

          if (profileError) throw profileError;

          alert(
            `Teacher created successfully!\n\nEmail: ${cleanEmail}\nPassword: ${cleanPassword}\n\nNote: This teacher will need to register with this email to access their account.`
          );
        } else {
          throw signUpError;
        }
      } else {
        // Auth signup succeeded
        const teacherUser = signUpData?.user;
        teacherId = teacherUser?.id;

        if (teacherUser) {
          // Create profile WITH ORGANIZATION_ID
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: teacherUser.id,
              email: cleanEmail,
              full_name: cleanName,
              role: "teacher",
              org_code: org.org_code,
              organization_id: org.id,  // CRITICAL: Direct organization link
              active: true,
            });

          if (profileError) throw profileError;
        }

        if (signUpData?.session) {
          alert(
            `Teacher account created successfully!\n\nEmail: ${cleanEmail}\nPassword: ${cleanPassword}\n\nTeacher can login immediately.`
          );
        } else {
          alert(
            `Teacher invitation sent to ${cleanEmail}!\n\nThey need to check their email to verify and set their password.`
          );
        }
      }

      // DOUBLE VERIFICATION: Immediately verify and fix if needed
      if (teacherId) {
        // Wait a moment for Supabase to process
        setTimeout(async () => {
          try {
            const { data: teacherProfile, error: fetchError } = await supabase
              .from("profiles")
              .select("organization_id")
              .eq("id", teacherId)
              .single();
            
            if (!fetchError && teacherProfile && !teacherProfile.organization_id) {
              console.log("Teacher missing organization_id, fixing immediately...");
              
              // Force update organization_id
              await supabase
                .from("profiles")
                .update({ organization_id: org.id })
                .eq("id", teacherId);
              
              console.log("Organization link fixed on creation!");
            }
          } catch (err) {
            console.log("Verification check:", err);
          }
        }, 1000);
      }

      // Reset form
      setTeacherName("");
      setTeacherEmail("");
      setTeacherPassword("");
      setShowTeacherForm(false);

      await loadTeachers(org.id, org.org_code);
      await loadOverview(org.id);
      
      // Show success message with organization info
      alert(`✅ Teacher "${cleanName}" created successfully and linked to "${org.name}" organization!\n\nOrganization ID: ${org.id}\nOrg Code: ${org.org_code}`);
      
    } catch (err) {
      console.error("Create teacher error:", err);
      
      // More specific error messages
      if (err.message.includes("duplicate key")) {
        alert("This email is already registered. Please use a different email.");
      } else if (err.message.includes("organization")) {
        alert("Organization linking failed. Please try again or contact support.");
      } else {
        alert(err.message || "Failed to create teacher. Please try again.");
      }
    } finally {
      setCreatingTeacher(false);
    }
  };

  const handleDeleteTeacher = async (teacherId) => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete this teacher? This will also delete all their associated classes and attendance data!"
      )
    ) {
      return;
    }

    try {
      // 1. First get teacher's classes
      const { data: teacherClasses } = await supabase
        .from("classes")
        .select("id")
        .eq("teacher_id", teacherId);

      if (teacherClasses && teacherClasses.length > 0) {
        const classIds = teacherClasses.map((c) => c.id);

        // Delete attendance logs for these classes
        await supabase.from("attendance_logs").delete().in("class_id", classIds);

        // Delete class_students records
        await supabase.from("class_students").delete().in("class_id", classIds);

        // Delete classes
        await supabase.from("classes").delete().eq("teacher_id", teacherId);
      }

      // 2. Delete teacher's profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", teacherId);

      if (profileError) throw profileError;

      // 3. Try to delete auth user (if it exists and starts with a proper UUID)
      if (!teacherId.startsWith("teacher_")) {
        try {
          await supabase.auth.admin.deleteUser(teacherId);
        } catch (authErr) {
          console.warn("Could not delete auth user:", authErr);
        }
      }

      alert("Teacher deleted successfully.");
      await loadTeachers(org.id, org.org_code);
      await loadOverview(org.id);
    } catch (err) {
      console.error("Delete teacher error:", err);
      alert(err.message || "Failed to delete teacher");
    }
  };

  // ===========================
  // LOAD TEACHER DETAILS
  // ===========================
  const openTeacherDetail = async (teacher) => {
    setSelectedTeacher(teacher);
    setLoadingTeacherDetail(true);
    setTeacherDetail(null);
    setTeacherStats([]);
    setTeacherClasses([]);

    try {
      // 1. Get teacher's classes
      const { data: classesData, error: classesErr } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", teacher.id);

      if (classesErr) {
        console.error("Error fetching teacher classes:", classesErr);
      }

      const classes = classesData || [];
      setTeacherClasses(classes);

      // 2. Get student count and attendance for each class
      const classStats = [];

      for (const cls of classes) {
        // Get student count
        let studentCount = 0;
        try {
          const { count, error: countErr } = await supabase
            .from("class_students")
            .select("id", { count: "exact", head: true })
            .eq("class_id", cls.id);

          if (!countErr) {
            studentCount = count || 0;
          }
        } catch (err) {
          console.warn("Error counting students:", err.message);
        }

        // Get attendance stats
        let totalSessions = 0;
        let presentSessions = 0;

        try {
          const { data: attendanceData, error: attendanceErr } = await supabase
            .from("attendance_logs")
            .select("id, status")
            .eq("class_id", cls.id);

          if (!attendanceErr && attendanceData) {
            totalSessions = attendanceData.length || 0;
            presentSessions =
              attendanceData.filter((a) => a.status === "present").length || 0;
          }
        } catch (err) {
          console.warn("Attendance logs query failed:", err.message);
        }

        const attendancePercent =
          totalSessions > 0
            ? Math.round((presentSessions / totalSessions) * 100)
            : 0;

        classStats.push({
          classId: cls.id,
          name: cls.name || "Unnamed Class",
          section: cls.section || "N/A",
          code: cls.class_code || "N/A",
          subject: cls.subject || "General",
          studentCount,
          totalSessions,
          presentSessions,
          attendancePercent,
        });
      }

      setTeacherDetail({
        classes,
        totalClasses: classes.length,
        totalStudents: classStats.reduce(
          (sum, stat) => sum + stat.studentCount,
          0
        ),
      });
      setTeacherStats(classStats);
    } catch (err) {
      console.error("Teacher detail error:", err);
    } finally {
      setLoadingTeacherDetail(false);
    }
  };

  // ===========================
  // TOGGLE TEACHER CLASS EXPANSION
  // ===========================
  const toggleTeacherClassExpansion = (classId) => {
    setExpandedTeacherClasses((prev) => ({
      ...prev,
      [classId]: !prev[classId],
    }));
  };

  // ===========================
  // STUDENT SEARCH
  // ===========================
  const handleSearchStudents = async (e) => {
    // Prevent default only if event exists
    if (e?.preventDefault) {
      e.preventDefault();
    }
    
    if (!org) return;

    const q = studentQuery.trim();
    if (!q) {
      // If query is empty, show all students
      await loadStudents();
      return;
    }

    setSearchingStudents(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, register_no, email, parent_email, active, organization_id, created_at"
        )
        .eq("organization_id", org.id)
        .eq("role", "student")
        .or(
          `full_name.ilike.%${q}%,register_no.ilike.%${q}%,email.ilike.%${q}%,parent_email.ilike.%${q}%`
        )
        .order("full_name", { ascending: true });

      if (error) {
        console.error("Search students error:", error);
        alert(error.message || "Failed to search students");
        return;
      }

      setStudents(data || []);
    } catch (err) {
      console.error("Search students error:", err);
    } finally {
      setSearchingStudents(false);
    }
  };

  // ===========================
  // STUDENT 360° VIEW
  // ===========================
  const openStudentDetail = async (student) => {
    setSelectedStudent(student);
    setActiveTab("studentView");
    setLoadingStudentDetail(true);
    setStudentDetail(null);
    setAttendanceHistory([]);
    setClassAttendanceData({});
    setExpandedClasses({});

    try {
      // 1. Get student's class enrollments
      const { data: enrollData, error: enrollErr } = await supabase
        .from("class_students")
        .select("*")
        .eq("student_id", student.id);

      if (enrollErr) {
        console.error("Error fetching enrollments:", enrollErr);
        setStudentDetail({
          classes: [],
          logs: [],
          overallPercent: 0,
          classStats: [],
          totalClasses: 0,
        });
        setLoadingStudentDetail(false);
        return;
      }

      const enrollments = enrollData || [];

      // 2. Get class details for each enrollment
      let studentClasses = [];
      const enrolledClassIds = enrollments.map((e) => e.class_id);

      if (enrolledClassIds.length > 0) {
        const { data: classesData, error: classesErr } = await supabase
          .from("classes")
          .select("*")
          .in("id", enrolledClassIds);

        if (classesErr) {
          console.error("Error fetching classes:", classesErr);
        } else {
          studentClasses = classesData || [];
        }
      }

      // 3. Get teacher names
      const teacherIds = [
        ...new Set(studentClasses.map((c) => c.teacher_id).filter(Boolean)),
      ];
      let teachersMap = {};

      if (teacherIds.length > 0) {
        const { data: teachersData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", teacherIds);

        if (teachersData) {
          teachersData.forEach((t) => {
            teachersMap[t.id] = t.full_name;
          });
        }
      }

      // 4. Get student's attendance logs
      let logs = [];
      const { data: logsData, error: logsErr } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("student_id", student.id);

      if (logsErr) {
        console.warn("No attendance logs found:", logsErr.message);
      } else {
        logs = logsData || [];
      }

      // 5. ORGANIZE LOGS BY CLASS
      const classWiseLogs = {};
      logs.forEach((log) => {
        const classId = log.class_id;
        if (!classWiseLogs[classId]) {
          classWiseLogs[classId] = [];
        }
        classWiseLogs[classId].push(log);
      });

      setClassAttendanceData(classWiseLogs);

      // 6. Calculate overall stats
      const totalSessions = logs.length;
      const presentCount = logs.filter((l) => l.status === "present").length;
      const overallPercent =
        totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

      // 7. Calculate class-wise stats
      const classMap = {};
      logs.forEach((log) => {
        const classId = log.class_id;
        if (!classMap[classId]) {
          classMap[classId] = { total: 0, present: 0 };
        }
        classMap[classId].total += 1;
        if (log.status === "present") classMap[classId].present += 1;
      });

      const classStats = studentClasses.map((cls) => {
        const stats = classMap[cls.id] || { total: 0, present: 0 };
        const percentage =
          stats.total > 0
            ? Math.round((stats.present / stats.total) * 100)
            : 0;
        return {
          classId: cls.id,
          name: cls.name || "Class",
          code: cls.class_code || "N/A",
          subject: cls.subject || "General",
          teacher: teachersMap[cls.teacher_id] || "Unknown",
          total: stats.total,
          present: stats.present,
          percentage,
        };
      });

      setStudentDetail({
        classes: studentClasses,
        logs,
        overallPercent,
        classStats,
        totalClasses: studentClasses.length,
      });
      setAttendanceHistory(logs.slice(0, 50));
    } catch (err) {
      console.error("Student detail error:", err);
      setStudentDetail({
        classes: [],
        logs: [],
        overallPercent: 0,
        classStats: [],
        totalClasses: 0,
      });
    } finally {
      setLoadingStudentDetail(false);
    }
  };

  // ===========================
  // UPDATE ATTENDANCE STATUS
  // ===========================
  const handleUpdateAttendance = async (logId, newStatus) => {
    if (!window.confirm(`Change attendance status to ${newStatus}?`)) return;

    try {
      const { error } = await supabase
        .from("attendance_logs")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId);

      if (error) throw error;

      alert("Attendance updated successfully.");

      // Refresh student details
      if (selectedStudent) {
        await openStudentDetail(selectedStudent);
      }
    } catch (err) {
      console.error("Update attendance error:", err);
      alert(err.message || "Failed to update attendance");
    }
  };

  // ===========================
  // TOGGLE CLASS EXPANSION
  // ===========================
  const toggleClassExpansion = (classId) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [classId]: !prev[classId],
    }));
  };

  // ===========================
  // ANALYTICS: BELOW 75%
  // ===========================
  const loadAnalytics = async () => {
    if (!org) return;
    setLoadingAnalytics(true);
    setLowAttendanceStudents([]);

    try {
      const { data: stuData, error: stuErr } = await supabase
        .from("profiles")
        .select("id, full_name, register_no, email")
        .eq("organization_id", org.id)
        .eq("role", "student")
        .eq("active", true);

      if (stuErr) throw stuErr;

      const studentsList = stuData || [];
      const result = [];

      for (const s of studentsList) {
        const { data: logs, error: logsErr } = await supabase
          .from("attendance_logs")
          .select("id, status")
          .eq("student_id", s.id);

        if (logsErr) continue;

        const total = logs.length;
        const present = logs.filter((l) => l.status === "present").length;
        const percent = total > 0 ? Math.round((present / total) * 100) : 0;

        if (percent < 75) {
          result.push({
            ...s,
            percent,
            totalClasses: total,
            presentClasses: present,
          });
        }
      }

      setLowAttendanceStudents(result.sort((a, b) => a.percent - b.percent));

      if (result.length === 0) {
        alert("✅ All students have attendance above 75%! Great job!");
      }
    } catch (err) {
      console.error("Analytics error:", err);
      alert(err.message || "Failed to load analytics");
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // ===========================
  // EXPORT FUNCTIONS
  // ===========================
  const exportData = (type) => {
    let data = [];
    let filename = "";
    let headers = [];

    switch (type) {
      case "overview":
        data = [
          {
            "Total Students": overview.totalStudents,
            "Total Teachers": overview.totalTeachers,
            "Present Today": overview.presentToday,
            "Absent Today": overview.absentToday,
            "Overall Attendance %": overview.overallPercent,
            Date: new Date().toLocaleDateString(),
          },
        ];
        filename = `overview_export_${new Date()
          .toISOString()
          .split("T")[0]}.csv`;
        headers = [
          "Total Students",
          "Total Teachers",
          "Present Today",
          "Absent Today",
          "Overall Attendance %",
          "Date",
        ];
        break;

      case "teachers":
        data = teachers.map((t) => ({
          Name: t.full_name,
          Email: t.email,
          "Register No": t.register_no || "N/A",
          Classes: t.classCount,
          Students: t.studentCount,
          "Attendance %": t.attendancePercent,
          Status: t.active ? "Active" : "Inactive",
          Joined: new Date(t.created_at).toLocaleDateString(),
        }));
        filename = `teachers_export_${new Date()
          .toISOString()
          .split("T")[0]}.csv`;
        headers = [
          "Name",
          "Email",
          "Register No",
          "Classes",
          "Students",
          "Attendance %",
          "Status",
          "Joined",
        ];
        break;

      case "students":
        data = students.map((s) => ({
          Name: s.full_name,
          "Roll No": s.register_no || "N/A",
          Email: s.email,
          "Parent Email": s.parent_email || "N/A",
          Status: s.active ? "Active" : "Inactive",
          Joined: new Date(s.created_at).toLocaleDateString(),
        }));
        filename = `students_export_${new Date()
          .toISOString()
          .split("T")[0]}.csv`;
        headers = [
          "Name",
          "Roll No",
          "Email",
          "Parent Email",
          "Status",
          "Joined",
        ];
        break;
    }

    // Convert to CSV
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma
            if (
              typeof value === "string" &&
              (value.includes(",") || value.includes('"'))
            ) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(",")
      ),
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(
      `${type.charAt(0).toUpperCase() + type.slice(1)} data exported successfully!`
    );
  };

  // ===========================
  // LOGOUT FUNCTION
  // ===========================
  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      try {
        await supabase.auth.signOut();
        window.location.href = "/login";
      } catch (error) {
        console.error("Logout error:", error);
        alert("Error logging out. Please try again.");
      }
    }
  };

  // ===========================
  // MODERN UI COMPONENTS
  // ===========================
  const GlassCard = ({ children, className = "", style = {} }) => (
    <div className={`glass-card ${className}`} style={style}>
      {children}
    </div>
  );

  const UserAvatar = ({ name, role = "user", size = "md" }) => {
    const sizeClass = {
      sm: "avatar-sm",
      md: "avatar-md",
      lg: "avatar-lg",
      xl: "avatar-xl",
    }[size];

    const roleClass = {
      teacher: "avatar-teacher",
      student: "avatar-student",
      admin: "avatar-admin",
      user: "avatar-user",
    }[role];

    return (
      <div className={`user-avatar ${sizeClass} ${roleClass}`}>
        <div className="avatar-initial">
          {name?.charAt(0)?.toUpperCase() || "U"}
        </div>
        <div className="avatar-ring"></div>
      </div>
    );
  };

  const ProgressRing = ({ percentage, size = 100, strokeWidth = 8 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset =
      circumference - (percentage / 100) * circumference;

    return (
      <div className="progress-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            className="progress-ring-bg"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className="progress-ring-fill"
            stroke="url(#gradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            style={{
              strokeDasharray: `${circumference} ${circumference}`,
              strokeDashoffset: strokeDashoffset,
              transform: "rotate(-90deg)",
              transformOrigin: "50% 50%",
            }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="progress-ring-text">{percentage}%</div>
      </div>
    );
  };

  const DashboardHeader = () => (
    <div className="dashboard-header">
      <div className="header-left">
        <button
          className="menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <div className="menu-icon">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
        <div className="header-title">
          <h1>{org?.name || "Organization"} Dashboard</h1>
          <div className="org-badge">
            <Icon name="globe" size={14} /> Code:{" "}
            <strong>{org?.org_code}</strong>
          </div>
        </div>
      </div>
      <div className="header-right">
        <div
          className="user-menu"
          onClick={handleLogout}
          style={{ cursor: "pointer" }}
        >
          <UserAvatar name={profile?.full_name || "Admin"} role="admin" />
          <div className="user-info">
            <span className="user-name">{profile?.full_name}</span>
            <span className="user-role">Logout</span>
          </div>
          <Icon
            name="logout"
            size={20}
            style={{ marginLeft: "10px", color: "#ef4444" }}
          />
        </div>
      </div>
    </div>
  );

  const SidebarNav = () => (
    <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">AT</div>
          <span className="logo-text">
            Attendance<span>Tracker</span>
          </span>
        </div>
        <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
          <Icon name="arrowLeft" size={20} />
        </button>
      </div>

      <div className="sidebar-menu">
        <div className="menu-section">
          <div className="section-label">MAIN</div>
          <nav className="nav-links">
            <button
              className={`nav-link ${
                activeTab === "overview" ? "active" : ""
              }`}
              onClick={() => setActiveTab("overview")}
            >
              <Icon name="home" size={18} /> Overview
              {activeTab === "overview" && <div className="nav-indicator"></div>}
            </button>
            <button
              className={`nav-link ${
                activeTab === "teachers" ? "active" : ""
              }`}
              onClick={() => {
                setActiveTab("teachers");
                setSelectedTeacher(null);
                setShowTeacherForm(false);
              }}
            >
              <Icon name="user" size={18} /> Teachers
              {activeTab === "teachers" && (
                <div className="nav-indicator"></div>
              )}
            </button>
            <button
              className={`nav-link ${
                activeTab === "students" ? "active" : ""
              }`}
              onClick={() => setActiveTab("students")}
            >
              <Icon name="users" size={18} /> Students
              {activeTab === "students" && (
                <div className="nav-indicator"></div>
              )}
            </button>
            <button
              className={`nav-link ${
                activeTab === "studentView" ? "active" : ""
              }`}
              onClick={() => {
                if (!selectedStudent) {
                  alert("Please select a student first from the Students tab.");
                  setActiveTab("students");
                } else {
                  setActiveTab("studentView");
                }
              }}
            >
              <Icon name="eye" size={18} /> Student 360°
              {activeTab === "studentView" && (
                <div className="nav-indicator"></div>
              )}
            </button>
            <button
              className={`nav-link ${
                activeTab === "analytics" ? "active" : ""
              }`}
              onClick={() => {
                setActiveTab("analytics");
              }}
            >
              <Icon name="chart" size={18} /> Analytics
              {activeTab === "analytics" && (
                <div className="nav-indicator"></div>
              )}
            </button>
          </nav>
        </div>

        <div className="menu-section">
          <div className="section-label">QUICK ACTIONS</div>
          <div className="quick-actions">
            <button
              className="quick-action"
              onClick={() => {
                loadOverview(org?.id);
                loadTeachers(org?.id, org?.org_code);
                loadStudents();
              }}
            >
              <Icon name="refresh" size={16} /> Refresh Data
            </button>
            <button
              className="quick-action"
              onClick={() => {
                setActiveTab("teachers");
                setShowTeacherForm(true);
              }}
            >
              <Icon name="plus" size={16} /> Add Teacher
            </button>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="org-stats">
            <div className="stat-item">
              <Icon name="users" size={14} />
              <span>{overview.totalStudents} Students</span>
            </div>
            <div className="stat-item">
              <Icon name="user" size={14} />
              <span>{overview.totalTeachers} Teachers</span>
            </div>
            <div className="stat-item">
              <Icon name="trendingUp" size={14} />
              <span>{overview.overallPercent}% Attendance</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOverview = () => (
    <div className="dashboard-content">
      <div className="content-header">
        <h2>Dashboard Overview</h2>
        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={() => {
              loadOverview(org?.id);
              loadTeachers(org?.id, org?.org_code);
              loadStudents();
            }}
          >
            <Icon name="refresh" size={18} /> Refresh
          </button>
          <button
            className="btn-primary"
            onClick={() => exportData("overview")}
          >
            <Icon name="download" size={18} /> Export Report
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <GlassCard className="stat-highlight">
          <div className="stat-main">
            <div className="stat-icon-large">
              <Icon name="users" size={32} color="white" />
            </div>
            <div className="stat-details">
              <div className="stat-number">{overview.totalStudents}</div>
              <div className="stat-label">Total Students</div>
              <div className="stat-sub">Active in organization</div>
            </div>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(
                  100,
                  (overview.totalStudents / 500) * 100
                )}%`,
              }}
            ></div>
          </div>
        </GlassCard>

        <GlassCard className="stat-highlight">
          <div className="stat-main">
            <div className="stat-icon-large">
              <Icon name="user" size={32} color="white" />
            </div>
            <div className="stat-details">
              <div className="stat-number">{overview.totalTeachers}</div>
              <div className="stat-label">Total Teachers</div>
              <div className="stat-sub">Teaching staff</div>
            </div>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(
                  100,
                  (overview.totalTeachers / 50) * 100
                )}%`,
              }}
            ></div>
          </div>
        </GlassCard>

        <GlassCard className="stat-highlight">
          <div className="stat-main">
            <div className="stat-icon-large">
              <Icon name="userCheck" size={32} color="white" />
            </div>
            <div className="stat-details">
              <div className="stat-number">{overview.presentToday}</div>
              <div className="stat-label">Present Today</div>
              <div className="stat-sub">
                Out of {overview.presentToday + overview.absentToday}
              </div>
            </div>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${
                  overview.presentToday + overview.absentToday > 0
                    ? Math.round(
                        (overview.presentToday /
                          (overview.presentToday + overview.absentToday)) *
                          100
                      )
                    : 0
                }%`,
              }}
            ></div>
          </div>
        </GlassCard>

        <GlassCard className="stat-highlight">
          <div className="stat-main">
            <div className="stat-icon-large">
              <Icon name="userX" size={32} color="white" />
            </div>
            <div className="stat-details">
              <div className="stat-number">{overview.absentToday}</div>
              <div className="stat-label">Absent Today</div>
              <div className="stat-sub">Need follow-up</div>
            </div>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill danger"
              style={{
                width: `${
                  overview.presentToday + overview.absentToday > 0
                    ? Math.round(
                        (overview.absentToday /
                          (overview.presentToday + overview.absentToday)) *
                          100
                      )
                    : 0
                }%`,
              }}
            ></div>
          </div>
        </GlassCard>
      </div>

      <div className="content-row">
        <GlassCard className="chart-card">
          <div className="card-header">
            <h3>Attendance Overview</h3>
            <div className="card-actions">
              <button className="btn-text">This Week</button>
              <button className="btn-text active">This Month</button>
              <button className="btn-text">All Time</button>
            </div>
          </div>
          <div className="attendance-chart">
            <ProgressRing percentage={overview.overallPercent} size={120} />
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-color primary"></div>
                <div className="legend-text">Overall Attendance</div>
                <div className="legend-value">{overview.overallPercent}%</div>
              </div>
              <div className="legend-item">
                <div className="legend-color success"></div>
                <div className="legend-text">Target</div>
                <div className="legend-value">75%</div>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="recent-card">
          <div className="card-header">
            <h3>Recent Activity</h3>
            <button className="btn-text">View All</button>
          </div>
          <div className="activity-list">
            {students.slice(0, 5).map((student, index) => (
              <div className="activity-item" key={student.id || index}>
                <UserAvatar name={student.full_name} role="student" size="sm" />
                <div className="activity-content">
                  <div className="activity-title">{student.full_name}</div>
                  <div className="activity-desc">Student enrolled</div>
                  <div className="activity-time">
                    {new Date(student.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="activity-badge new">NEW</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="content-row">
        <GlassCard className="quick-stats">
          <div className="card-header">
            <h3>Quick Stats</h3>
          </div>
          <div className="stats-mini">
            <div className="mini-stat">
              <div className="mini-icon">
                <Icon name="clock" size={20} color="white" />
              </div>
              <div className="mini-content">
                <div className="mini-value">
                  {overview.presentToday + overview.absentToday}
                </div>
                <div className="mini-label">Today's Sessions</div>
              </div>
            </div>
            <div className="mini-stat">
              <div className="mini-icon">
                <Icon name="percent" size={20} color="white" />
              </div>
              <div className="mini-content">
                <div className="mini-value">{overview.overallPercent}%</div>
                <div className="mini-label">Monthly Average</div>
              </div>
            </div>
            <div className="mini-stat">
              <div className="mini-icon">
                <Icon name="activity" size={20} color="white" />
              </div>
              <div className="mini-content">
                <div className="mini-value">24</div>
                <div className="mini-label">Active Classes</div>
              </div>
            </div>
            <div className="mini-stat">
              <div className="mini-icon">
                <Icon name="star" size={20} color="white" />
              </div>
              <div className="mini-content">
                <div className="mini-value">95%</div>
                <div className="mini-label">Satisfaction Rate</div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );

  // ===========================
  // TEACHERS TAB (with new register UI)
  // ===========================
  const renderTeachers = () => {
    if (selectedTeacher) {
      return renderTeacherDetail();
    }

    return (
      <div className="dashboard-content">
        <div className="content-header">
          <h2>Teacher Management</h2>
          <div className="header-actions">
            <button
              className="btn-secondary"
              onClick={() => setShowTeacherForm(!showTeacherForm)}
            >
              <Icon
                name={showTeacherForm ? "arrowLeft" : "plus"}
                size={18}
              />
              {showTeacherForm ? "Back to Teachers" : "Add Teacher"}
            </button>
            <button
              className="btn-warning"
              onClick={fixAllTeachersOrganization}
              title="Fix organization links for all existing teachers"
            >
              <Icon name="settings" size={18} /> Fix All Teachers
            </button>
            <button
              className="btn-primary"
              onClick={() => exportData("teachers")}
            >
              <Icon name="download" size={18} /> Export Teachers
            </button>
          </div>
        </div>

        {showTeacherForm ? (
          <div className="teacher-register-wrapper">
            <div className="teacher-register-container active">
              {/* LEFT WELCOME SIDE */}
              <div
                className="teacher-register-left animation"
                style={{ "--i": 1 }}
              >
                <h2 className="welcome-title">WELCOME!</h2>
                <p className="welcome-text">
                  We&apos;re delighted to have you here. If you need any
                  assistance, feel free to reach out.
                </p>

                <div className="welcome-meta">
                  <div className="welcome-line">
                    <Icon name="globe" size={16} /> ORGANIZATION
                  </div>
                  <div className="welcome-value">{org?.name}</div>

                  <div className="welcome-line">
                    <Icon name="database" size={16} /> ORG CODE
                  </div>
                  <div className="welcome-value">{org?.org_code}</div>
                </div>
              </div>

              {/* RIGHT REGISTER FORM SIDE */}
              <div
                className="teacher-register-right animation"
                style={{ "--i": 2 }}
              >
                <div className="register-header">
                  <h3>Register</h3>
                  <p>Create a new teacher account</p>
                </div>

                <form
                  onSubmit={handleCreateTeacher}
                  className="teacher-register-form"
                >
                  {/* NAME */}
                  <div className="field-group animation" style={{ "--i": 3 }}>
                    <label>Username</label>
                    <div className="field-input">
                      <input
                        type="text"
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        placeholder="Enter full name"
                        autoComplete="off"
                        required
                      />
                      <span className="field-icon">
                        <Icon name="user" size={18} />
                      </span>
                    </div>
                  </div>

                  {/* EMAIL */}
                  <div className="field-group animation" style={{ "--i": 4 }}>
                    <label>Email</label>
                    <div className="field-input">
                      <input
                        type="email"
                        value={teacherEmail}
                        onChange={(e) => setTeacherEmail(e.target.value)}
                        placeholder="Enter email address"
                        autoComplete="off"
                        required
                      />
                      <span className="field-icon">
                        <Icon name="mail" size={18} />
                      </span>
                    </div>
                  </div>

                  {/* PASSWORD */}
                  <div className="field-group animation" style={{ "--i": 5 }}>
                    <label>Password</label>
                    <div className="field-input">
                      <input
                        type="text"
                        value={teacherPassword}
                        onChange={(e) => setTeacherPassword(e.target.value)}
                        placeholder="Temporary password"
                        autoComplete="off"
                        minLength={6}
                        required
                      />
                      <span className="field-icon">
                        <Icon name="lock" size={18} />
                      </span>
                    </div>
                    <div className="password-hint">
                      Teacher can change this password after first login.
                    </div>
                  </div>

                  {/* BUTTONS */}
                  <div
                    className="register-actions animation"
                    style={{ "--i": 6 }}
                  >
                    <button
                      type="submit"
                      className="btn-register-glow"
                      disabled={creatingTeacher}
                    >
                      {creatingTeacher ? "Creating..." : "Register"}
                    </button>

                    <button
                      type="button"
                      className="btn-register-link"
                      onClick={() => {
                        setShowTeacherForm(false);
                        setTeacherName("");
                        setTeacherEmail("");
                        setTeacherPassword("");
                      }}
                    >
                      Back to teacher list
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <GlassCard className="teachers-list">
            <div className="card-header">
              <h3>All Teachers ({teachers.length})</h3>
              <div className="card-actions">
                <button
                  className="btn-icon"
                  onClick={() => loadTeachers(org?.id, org?.org_code)}
                >
                  <Icon name="refresh" size={18} />
                </button>
              </div>
            </div>

            {teachers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Icon name="user" size={32} />
                </div>
                <h4>No Teachers Found</h4>
                <p>Start by creating your first teacher account</p>
                <button
                  className="btn-secondary"
                  onClick={() => setShowTeacherForm(true)}
                >
                  <Icon name="plus" size={18} /> Add First Teacher
                </button>
              </div>
            ) : (
              <div className="teachers-grid">
                {teachers.map((teacher) => (
                  <div className="teacher-card" key={teacher.id}>
                    <div className="teacher-header">
                      <UserAvatar
                        name={teacher.full_name}
                        role="teacher"
                        size="lg"
                      />
                      <div className="teacher-info">
                        <h4>{teacher.full_name}</h4>
                        <div className="teacher-email">{teacher.email}</div>
                        <div className="teacher-meta">
                          <span className="meta-item">
                            <Icon name="calendar" size={14} /> Joined{" "}
                            {new Date(
                              teacher.created_at
                            ).toLocaleDateString()}
                          </span>
                          <span className="meta-item">
                            <Icon name="globe" size={14} /> Org ID:{" "}
                            {teacher.organization_id ? "✅" : "❌"}
                          </span>
                        </div>
                      </div>
                      <div className="teacher-actions">
                        <button
                          className="btn-icon"
                          onClick={() => openTeacherDetail(teacher)}
                        >
                          <Icon name="eye" size={18} />
                        </button>
                        <button
                          className="btn-icon danger"
                          onClick={() => handleDeleteTeacher(teacher.id)}
                        >
                          <Icon name="trash" size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="teacher-stats">
                      <div className="teacher-stat">
                        <div className="stat-label">Classes</div>
                        <div className="stat-value">
                          {teacher.classCount || 0}
                        </div>
                      </div>
                      <div className="teacher-stat">
                        <div className="stat-label">Students</div>
                        <div className="stat-value">
                          {teacher.studentCount || 0}
                        </div>
                      </div>
                      <div className="teacher-stat">
                        <div className="stat-label">Attendance</div>
                        <div className="stat-value">
                          {teacher.attendancePercent || 0}%
                        </div>
                      </div>
                    </div>

                    <div className="teacher-status">
                      <span
                        className={`status-badge ${
                          teacher.active ? "active" : "inactive"
                        }`}
                      >
                        {teacher.active ? "Active" : "Inactive"}
                      </span>
                      <span
                        className={`status-badge ${
                          teacher.organization_id ? "success" : "danger"
                        }`}
                        style={{ marginLeft: "8px" }}
                      >
                        {teacher.organization_id ? "Org Linked" : "No Org"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}
      </div>
    );
  };

  // ===========================
  // TEACHER DETAIL VIEW
  // ===========================
  const renderTeacherDetail = () => {
    if (loadingTeacherDetail) {
      return (
        <div className="dashboard-content">
          <div className="loading-state">
            <div className="spinner-large"></div>
            <p>Loading teacher profile...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="dashboard-content">
        <div className="content-header">
          <div className="header-left">
            <button
              className="btn-text"
              onClick={() => setSelectedTeacher(null)}
            >
              <Icon
                name="chevronRight"
                size={18}
                style={{ transform: "rotate(180deg)" }}
              />{" "}
              Back to Teachers
            </button>
            <h2>Teacher Profile</h2>
          </div>
          <div className="header-actions">
            <button
              className="btn-primary"
              onClick={() => openTeacherDetail(selectedTeacher)}
            >
              <Icon name="refresh" size={18} /> Refresh
            </button>
          </div>
        </div>

        <div className="teacher-profile">
          <GlassCard className="profile-header-card">
            <div className="profile-header">
              <UserAvatar
                name={selectedTeacher.full_name}
                role="teacher"
                size="xl"
              />
              <div className="profile-info">
                <h1>{selectedTeacher.full_name}</h1>
                <div className="profile-meta">
                  <div className="meta-item">
                    <Icon name="mail" size={14} /> Email:{" "}
                    {selectedTeacher.email}
                  </div>
                  <div className="meta-item">
                    <Icon name="calendar" size={14} /> Joined:{" "}
                    {new Date(
                      selectedTeacher.created_at
                    ).toLocaleDateString()}
                  </div>
                  <div className="meta-item">
                    <Icon name="globe" size={14} /> Organization ID:{" "}
                    {selectedTeacher.organization_id ? (
                      <span style={{ color: "#10b981", fontWeight: "bold" }}>
                        ✅ {selectedTeacher.organization_id}
                      </span>
                    ) : (
                      <span style={{ color: "#ef4444", fontWeight: "bold" }}>
                        ❌ Missing
                      </span>
                    )}
                  </div>
                </div>
                <div className="profile-status">
                  <span
                    className={`status-badge large ${
                      selectedTeacher.active ? "active" : "inactive"
                    }`}
                  >
                    {selectedTeacher.active ? "Active Teacher" : "Inactive Teacher"}
                  </span>
                  <span className="attendance-badge">
                    <Icon name="trendingUp" size={14} /> Overall Attendance:{" "}
                    {selectedTeacher.attendancePercent || 0}%
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>

          <div className="profile-stats">
            <GlassCard className="stat-card">
              <div className="stat-icon">
                <Icon name="book" size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {teacherDetail?.totalClasses || 0}
                </div>
                <div className="stat-label">Total Classes</div>
              </div>
            </GlassCard>

            <GlassCard className="stat-card">
              <div className="stat-icon">
                <Icon name="users" size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {teacherDetail?.totalStudents || 0}
                </div>
                <div className="stat-label">Total Students</div>
              </div>
            </GlassCard>

            <GlassCard className="stat-card">
              <div className="stat-icon">
                <Icon name="checkCircle" size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {teacherStats.reduce(
                    (sum, stat) => sum + stat.presentSessions,
                    0
                  )}
                </div>
                <div className="stat-label">Present Sessions</div>
              </div>
            </GlassCard>

            <GlassCard className="stat-card">
              <div className="stat-icon">
                <Icon name="clock" size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {teacherStats.reduce(
                    (sum, stat) => sum + stat.totalSessions,
                    0
                  )}
                </div>
                <div className="stat-label">Total Sessions</div>
              </div>
            </GlassCard>
          </div>

          <div className="profile-content">
            <GlassCard className="attendance-card">
              <div className="card-header">
                <h3>Class-wise Details</h3>
                <div className="card-sub">
                  Click on any class to view detailed information
                </div>
              </div>

              {teacherStats.length === 0 ? (
                <div className="empty-state-small">
                  <p>Teacher is not assigned to any classes yet.</p>
                </div>
              ) : (
                <div className="attendance-grid">
                  {teacherStats.map((c) => (
                    <div
                      className="attendance-item"
                      key={c.classId}
                      onClick={() => toggleTeacherClassExpansion(c.classId)}
                    >
                      <div className="attendance-header">
                        <div className="class-info">
                          <h4>{c.name}</h4>
                          <div className="class-meta">
                            <span>{c.code}</span>
                            <span>•</span>
                            <span>{c.subject}</span>
                            <span>•</span>
                            <span>{c.section}</span>
                          </div>
                        </div>
                        <div className="attendance-percent">
                          <div
                            className={`percent-circle ${
                              c.attendancePercent >= 75
                                ? "good"
                                : c.attendancePercent >= 50
                                ? "warning"
                                : "danger"
                            }`}
                          >
                            {c.attendancePercent}%
                          </div>
                          <Icon
                            name="chevronDown"
                            size={18}
                            className={`expand-icon ${
                              expandedTeacherClasses[c.classId]
                                ? "expanded"
                                : ""
                            }`}
                          />
                        </div>
                      </div>

                      <div className="attendance-stats">
                        <div className="stat">
                          <div className="stat-value">{c.studentCount}</div>
                          <div className="stat-label">Students</div>
                        </div>
                        <div className="stat">
                          <div className="stat-value">{c.presentSessions}</div>
                          <div className="stat-label">Present</div>
                        </div>
                        <div className="stat">
                          <div className="stat-value">{c.totalSessions}</div>
                          <div className="stat-label">Total</div>
                        </div>
                      </div>

                      {expandedTeacherClasses[c.classId] && (
                        <div className="attendance-details">
                          <div className="class-details">
                            <div className="detail-item">
                              <strong>Class Code:</strong> {c.code}
                            </div>
                            <div className="detail-item">
                              <strong>Subject:</strong> {c.subject}
                            </div>
                            <div className="detail-item">
                              <strong>Section:</strong> {c.section}
                            </div>
                            <div className="detail-item">
                              <strong>Attendance Rate:</strong>{" "}
                              {c.attendancePercent}%
                            </div>
                            <div className="detail-item">
                              <strong>Student Count:</strong> {c.studentCount}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard className="recent-activity">
              <div className="card-header">
                <h3>Recent Classes</h3>
                <div className="card-sub">Teacher's assigned classes</div>
              </div>

              {teacherClasses.length === 0 ? (
                <div className="empty-state-small">
                  <p>No classes assigned to this teacher.</p>
                </div>
              ) : (
                <div className="activity-table">
                  <table className="compact-table">
                    <thead>
                      <tr>
                        <th>Class Name</th>
                        <th>Code</th>
                        <th>Subject</th>
                        <th>Section</th>
                        <th>Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teacherClasses.slice(0, 10).map((cls) => (
                        <tr key={cls.id}>
                          <td>
                            <div className="class-name">
                              {cls.name || "Unnamed Class"}
                            </div>
                          </td>
                          <td>{cls.class_code || "N/A"}</td>
                          <td>{cls.subject || "General"}</td>
                          <td>{cls.section || "N/A"}</td>
                          <td>
                            {teacherStats.find((s) => s.classId === cls.id)
                              ?.studentCount || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    );
  };

  // ===========================
  // STUDENTS TAB
  // ===========================
  const renderStudents = () => {
    return (
      <div className="dashboard-content">
        {/* Header */}
        <div className="content-header">
          <h2>Student Management</h2>
          <div className="header-actions">
            <button
              className="btn-primary"
              onClick={() => exportData("students")}
            >
              <Icon name="download" size={18} /> Export Students
            </button>
          </div>
        </div>

        {/* SIMPLE SEARCH CARD */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            padding: "18px 20px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 12px 25px rgba(0,0,0,0.08)",
            marginBottom: "18px",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "1rem",
                color: "#111827",
                fontWeight: 600,
              }}
            >
              Search Students
            </h3>
            <div
              style={{
                marginTop: "3px",
                fontSize: "0.8rem",
                color: "#9ca3af",
              }}
            >
              Type name, roll number, or email and click Search
            </div>
          </div>

          {/* 🔍 Search row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginTop: "0.7rem",
              flexWrap: "wrap",
            }}
          >
            {/* Input + icon */}
            <div
              style={{
                position: "relative",
                flex: "1 1 260px",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  opacity: 0.6,
                  pointerEvents: "none",
                }}
              >
                <Icon name="search" size={16} />
              </span>

              <input
                type="text"
                placeholder="Search by name / roll no / email"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearchStudents();
                  }
                }}
                autoComplete="off"
                style={{
                  width: "100%",
                  padding: "0.55rem 0.9rem 0.55rem 2.3rem",
                  borderRadius: "999px",
                  outline: "none",
                  fontSize: "0.9rem",
                  background: "#f9fafb",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                }}
              />
            </div>

            {/* Search button */}
            <button
              type="button"
              disabled={searchingStudents}
              onClick={() => handleSearchStudents()}
              style={{
                padding: "0.55rem 1.1rem",
                borderRadius: "999px",
                border: "none",
                background:
                  "linear-gradient(135deg, #6366f1 0%, #22c55e 50%, #0ea5e9 100%)",
                color: "#ffffff",
                fontSize: "0.9rem",
                fontWeight: 500,
                cursor: searchingStudents ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                whiteSpace: "nowrap",
              }}
            >
              {searchingStudents ? (
                <>
                  <div className="spinner-small" /> Searching...
                </>
              ) : (
                <>
                  <Icon name="search" size={16} /> Search
                </>
              )}
            </button>

            {/* Clear button */}
            <button
              type="button"
              onClick={() => {
                setStudentQuery("");
                loadStudents();
              }}
              style={{
                padding: "0.5rem 0.9rem",
                borderRadius: "999px",
                border: "1px solid rgba(148,163,184,0.5)",
                background: "transparent",
                color: "#6b7280",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              <Icon name="refresh" size={14} /> Clear
            </button>
          </div>
        </div>

        {/* RESULTS / EMPTY STATE BELOW SEARCH CARD */}
        {students.length === 0 ? (
          <GlassCard className="empty-state-card">
            <div className="empty-content">
              <div className="empty-illustration">
                <Icon name="users" size={48} />
              </div>
              <h3>No Students Found</h3>
              <p>Try searching again or clear the search.</p>
              <div className="empty-actions">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setStudentQuery("");
                    loadStudents();
                  }}
                >
                  <Icon name="refresh" size={18} /> Reset
                </button>
              </div>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="students-table">
            <div className="table-header">
              <h3>Search Results ({students.length} students)</h3>
              <div className="table-summary">
                Showing {students.length} of {overview.totalStudents} total
                students
              </div>
            </div>

            <div className="table-responsive">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll No</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Enrolled</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="student-cell">
                          <UserAvatar
                            name={student.full_name}
                            role="student"
                            size="sm"
                          />
                          <div className="student-info">
                            <div className="student-name">
                              {student.full_name}
                            </div>
                            <div className="student-email">
                              {student.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="roll-number">
                          {student.register_no || "N/A"}
                        </div>
                      </td>
                      <td>
                        <div className="contact-info">
                          <div className="contact-email">
                            {student.email}
                          </div>
                          {student.parent_email && (
                            <div className="contact-parent">
                              {student.parent_email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            student.active ? "active" : "inactive"
                          }`}
                        >
                          {student.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="date-cell">
                          {new Date(
                            student.created_at
                          ).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-icon small"
                            onClick={() => openStudentDetail(student)}
                          >
                            <Icon name="eye" size={16} />
                          </button>
                          <button
                            className="btn-icon small danger"
                            onClick={() => handleDeleteStudent(student.id)}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}
      </div>
    );
  };

  // ===========================
  // STUDENT 360 VIEW TAB
  // ===========================
  const renderStudentView = () => {
    if (!selectedStudent) {
      return (
        <div className="dashboard-content">
          <div className="empty-state-full">
            <div className="empty-illustration">
              <Icon name="users" size={64} />
            </div>
            <h2>No Student Selected</h2>
            <p>
              Please select a student first from the Students tab to view their
              360° profile
            </p>
            <button
              className="btn-primary"
              onClick={() => setActiveTab("students")}
            >
              <Icon
                name="chevronRight"
                size={18}
                style={{ transform: "rotate(180deg)" }}
              />{" "}
              Back to Students
            </button>
          </div>
        </div>
      );
    }

    if (loadingStudentDetail) {
      return (
        <div className="dashboard-content">
          <div className="loading-state">
            <div className="spinner-large"></div>
            <p>Loading student profile...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="dashboard-content">
        <div className="content-header">
          <div className="header-left">
            <button
              className="btn-text"
              onClick={() => setActiveTab("students")}
            >
              <Icon
                name="chevronRight"
                size={18}
                style={{ transform: "rotate(180deg)" }}
              />{" "}
              Back
            </button>
            <h2>Student 360° Profile</h2>
          </div>
          <div className="header-actions">
            <button
              className="btn-primary"
              onClick={() => openStudentDetail(selectedStudent)}
            >
              <Icon name="refresh" size={18} /> Refresh
            </button>
          </div>
        </div>

        <div className="student-profile">
          <GlassCard className="profile-header-card">
            <div className="profile-header">
              <UserAvatar
                name={selectedStudent.full_name}
                role="student"
                size="xl"
              />
              <div className="profile-info">
                <h1>{selectedStudent.full_name}</h1>
                <div className="profile-meta">
                  <div className="meta-item">
                    <Icon name="user" size={14} /> Roll No:{" "}
                    {selectedStudent.register_no || "N/A"}
                  </div>
                  <div className="meta-item">
                    <Icon name="mail" size={14} /> Email:{" "}
                    {selectedStudent.email}
                  </div>
                  {selectedStudent.parent_email && (
                    <div className="meta-item">
                      <Icon name="phone" size={14} /> Parent:{" "}
                      {selectedStudent.parent_email}
                    </div>
                  )}
                  <div className="meta-item">
                    <Icon name="calendar" size={14} /> Joined:{" "}
                    {new Date(
                      selectedStudent.created_at
                    ).toLocaleDateString()}
                  </div>
                </div>
                <div className="profile-status">
                  <span
                    className={`status-badge large ${
                      selectedStudent.active ? "active" : "inactive"
                    }`}
                  >
                    {selectedStudent.active ? "Active Student" : "Inactive Student"}
                  </span>
                  <span className="attendance-badge">
                    <Icon name="trendingUp" size={14} /> Overall Attendance:{" "}
                    {studentDetail?.overallPercent || 0}%
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>

          <div className="profile-stats">
            <GlassCard className="stat-card">
              <div className="stat-icon">
                <Icon name="book" size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {studentDetail?.totalClasses || 0}
                </div>
                <div className="stat-label">Enrolled Classes</div>
              </div>
            </GlassCard>

            <GlassCard className="stat-card">
              <div className="stat-icon">
                <Icon name="clock" size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {studentDetail?.logs?.length || 0}
                </div>
                <div className="stat-label">Total Sessions</div>
              </div>
            </GlassCard>

            <GlassCard className="stat-card">
              <div className="stat-icon">
                <Icon name="checkCircle" size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {studentDetail?.logs?.filter((l) => l.status === "present")
                    .length || 0}
                </div>
                <div className="stat-label">Present Days</div>
              </div>
            </GlassCard>

            <GlassCard className="stat-card">
              <div className="stat-icon">
                <Icon name="xCircle" size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {studentDetail?.logs?.filter((l) => l.status === "absent")
                    .length || 0}
                </div>
                <div className="stat-label">Absent Days</div>
              </div>
            </GlassCard>
          </div>

          <div className="profile-content">
            <GlassCard className="attendance-card">
              <div className="card-header">
                <h3>Class-wise Attendance</h3>
                <div className="card-sub">
                  Click on any class to view detailed session records
                </div>
              </div>

              {studentDetail?.classStats?.length === 0 ? (
                <div className="empty-state-small">
                  <p>Student is not enrolled in any classes yet.</p>
                </div>
              ) : (
                <div className="attendance-grid">
                  {studentDetail?.classStats?.map((c) => (
                    <div
                      className="attendance-item"
                      key={c.classId}
                      onClick={() => toggleClassExpansion(c.classId)}
                    >
                      <div className="attendance-header">
                        <div className="class-info">
                          <h4>{c.name}</h4>
                          <div className="class-meta">
                            <span>{c.code}</span>
                            <span>•</span>
                            <span>{c.subject}</span>
                            <span>•</span>
                            <span>{c.teacher}</span>
                          </div>
                        </div>
                        <div className="attendance-percent">
                          <div
                            className={`percent-circle ${
                              c.percentage >= 75
                                ? "good"
                                : c.percentage >= 50
                                ? "warning"
                                : "danger"
                            }`}
                          >
                            {c.percentage}%
                          </div>
                          <Icon
                            name="chevronDown"
                            size={18}
                            className={`expand-icon ${
                              expandedClasses[c.classId] ? "expanded" : ""
                            }`}
                          />
                        </div>
                      </div>

                      <div className="attendance-stats">
                        <div className="stat">
                          <div className="stat-value">{c.present}</div>
                          <div className="stat-label">Present</div>
                        </div>
                        <div className="stat">
                          <div className="stat-value">
                            {c.total - c.present}
                          </div>
                          <div className="stat-label">Absent</div>
                        </div>
                        <div className="stat">
                          <div className="stat-value">{c.total}</div>
                          <div className="stat-label">Total</div>
                        </div>
                      </div>

                      {expandedClasses[c.classId] && (
                        <div className="attendance-details">
                          {classAttendanceData[c.classId]?.length === 0 ? (
                            <div className="empty-details">
                              No attendance records found
                            </div>
                          ) : (
                            <div className="session-list">
                              {classAttendanceData[c.classId]
                                ?.slice(0, 5)
                                .map((log) => (
                                  <div className="session-item" key={log.id}>
                                    <div className="session-date">
                                      {formatLogDate(log)}
                                      <div className="session-time">
                                        {formatTime(
                                          log.marked_at || log.created_at
                                        )}
                                      </div>
                                    </div>
                                    <div className="session-status">
                                      <span
                                        className={`status-badge ${log.status}`}
                                      >
                                        {log.status}
                                      </span>
                                    </div>
                                    <div className="session-actions">
                                      <button
                                        className="btn-icon small"
                                        onClick={() =>
                                          handleUpdateAttendance(
                                            log.id,
                                            "present"
                                          )
                                        }
                                      >
                                        <Icon
                                          name="checkCircle"
                                          size={16}
                                        />
                                      </button>
                                      <button
                                        className="btn-icon small"
                                        onClick={() =>
                                          handleUpdateAttendance(
                                            log.id,
                                            "absent"
                                          )
                                        }
                                      >
                                        <Icon name="xCircle" size={16} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard className="recent-activity">
              <div className="card-header">
                <h3>Recent Attendance Records</h3>
                <div className="card-sub">Latest 50 attendance records</div>
              </div>

              {attendanceHistory.length === 0 ? (
                <div className="empty-state-small">
                  <p>No attendance records found.</p>
                </div>
              ) : (
                <div className="activity-table">
                  <table className="compact-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Class</th>
                        <th>Status</th>
                        <th>Recorded By</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceHistory.slice(0, 10).map((log) => {
                        const classInfo = studentDetail?.classes?.find(
                          (c) => c.id === log.class_id
                        );
                        return (
                          <tr key={log.id}>
                            <td>
                              <div className="datetime-cell">
                                <div className="date">
                                  {formatLogDate(log)}
                                </div>
                                <div className="time">
                                  {formatTime(
                                    log.marked_at || log.created_at
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              {classInfo
                                ? `${classInfo.name} (${classInfo.class_code})`
                                : `Class ID: ${log.class_id}`}
                            </td>
                            <td>
                              <span
                                className={`status-badge ${log.status}`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td>{log.recorded_by || "System"}</td>
                            <td>
                              <div className="action-buttons">
                                <button
                                  className="btn-icon small"
                                  onClick={() =>
                                    handleUpdateAttendance(log.id, "present")
                                  }
                                >
                                  <Icon name="checkCircle" size={16} />
                                </button>
                                <button
                                  className="btn-icon small"
                                  onClick={() =>
                                    handleUpdateAttendance(log.id, "absent")
                                  }
                                >
                                  <Icon name="xCircle" size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    );
  };

  // ===========================
  // ANALYTICS TAB
  // ===========================
  const renderAnalytics = () => (
    <div className="dashboard-content">
      <div className="content-header">
        <h2>Analytics Dashboard</h2>
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={loadAnalytics}
            disabled={loadingAnalytics}
          >
            {loadingAnalytics ? (
              <>
                <div className="spinner-small"></div> Analyzing...
              </>
            ) : (
              <>
                <Icon name="refresh" size={18} /> Refresh Analysis
              </>
            )}
          </button>
        </div>
      </div>

      <GlassCard className="analytics-card">
        <div className="card-header">
          <h3>Attendance Risk Analysis</h3>
          <div className="card-sub">
            Students with attendance below 75% threshold
          </div>
        </div>

        <div className="analytics-controls">
          <button
            className="btn-primary btn-block"
            onClick={loadAnalytics}
            disabled={loadingAnalytics}
          >
            {loadingAnalytics ? (
              <>
                <div className="spinner-small"></div> Loading Analysis...
              </>
            ) : (
              <>
                <Icon name="target" size={18} /> Load Students Below 75%
                Attendance
              </>
            )}
          </button>
          <div className="analytics-info">
            <Icon name="alert" size={18} /> This analysis helps identify
            students who may need additional support
          </div>
        </div>

        {lowAttendanceStudents.length > 0 ? (
          <>
            <div className="analytics-summary">
              <div className="summary-stat">
                <div className="stat-value">
                  {lowAttendanceStudents.length}
                </div>
                <div className="stat-label">Students Below 75%</div>
              </div>
              <div className="summary-stat">
                <div className="stat-value">
                  {Math.min(...lowAttendanceStudents.map((s) => s.percent))}%
                </div>
                <div className="stat-label">Lowest Attendance</div>
              </div>
              <div className="summary-stat">
                <div className="stat-value">
                  {Math.round(
                    lowAttendanceStudents.reduce(
                      (acc, s) => acc + s.percent,
                      0
                    ) / lowAttendanceStudents.length
                  )}
                  %
                </div>
                <div className="stat-label">Average</div>
              </div>
            </div>

            <div className="analytics-table">
              <div className="table-responsive">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Attendance %</th>
                      <th>Present/Total</th>
                      <th>Risk Level</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowAttendanceStudents.map((s) => (
                      <tr key={s.id} className="risk-row">
                        <td>
                          <div className="student-cell">
                            <UserAvatar
                              name={s.full_name}
                              role="student"
                              size="sm"
                            />
                            <div className="student-info">
                              <div className="student-name">{s.full_name}</div>
                              <div className="student-details">
                                <span>{s.register_no || "N/A"}</span>
                                <span>•</span>
                                <span>{s.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="attendance-meter">
                            <div className="progress-bar">
                              <div
                                className={`progress-fill ${
                                  s.percent < 50
                                    ? "danger"
                                    : s.percent < 75
                                    ? "warning"
                                    : "success"
                                }`}
                                style={{ width: `${s.percent}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="attendance-ratio">
                            {s.presentClasses}/{s.totalClasses}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`risk-badge ${
                              s.percent < 50
                                ? "high"
                                : s.percent < 75
                                ? "medium"
                                : "low"
                            }`}
                          >
                            {s.percent < 50
                              ? "High Risk"
                              : s.percent < 75
                              ? "Medium Risk"
                              : "Low Risk"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-view"
                            onClick={() => openStudentDetail(s)}
                          >
                            <Icon name="eye" size={16} /> View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="analytics-insights">
              <div className="insight-header">
                <Icon name="alert" size={18} /> Insights & Recommendations
              </div>
              <div className="insight-content">
                <p>
                  <strong>{lowAttendanceStudents.length}</strong> students have
                  attendance below the 75% threshold.
                </p>
                <p>
                  Students with consistently low attendance may need
                  intervention. Consider:
                </p>
                <ul>
                  <li>Contacting parents for high-risk cases</li>
                  <li>Scheduling counseling sessions</li>
                  <li>Reviewing class schedules</li>
                  <li>Implementing attendance improvement plans</li>
                </ul>
              </div>
            </div>
          </>
        ) : loadingAnalytics ? (
          <div className="loading-analytics">
            <div className="spinner"></div>
            <p>Analyzing student attendance data...</p>
            <div className="loading-sub">This may take a moment</div>
          </div>
        ) : (
          <div className="analytics-empty">
            <div className="empty-icon success">
              <Icon name="checkCircle" size={32} />
            </div>
            <h4>All Clear!</h4>
            <p>No students found with attendance below 75%.</p>
            <p className="empty-sub">
              All students are meeting the attendance target.
            </p>
            <button className="btn-secondary" onClick={loadAnalytics}>
              <Icon name="refresh" size={18} /> Run Analysis Again
            </button>
          </div>
        )}
      </GlassCard>
    </div>
  );

  // ===========================
  // MAIN RENDER
  // ===========================
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-container">
          <div className="loading-logo">
            <div className="logo-spinner">AT</div>
          </div>
          <p>Loading Organization Dashboard</p>
          <div className="loading-progress">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !profile || !org) {
    return (
      <div className="error-screen">
        <div className="error-container">
          <Icon name="alert" size={48} className="error-icon" />
          <h2>Failed to Load Organization</h2>
          <p>Please try refreshing the page or contact support.</p>
          <button
            className="btn-primary"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="organization-dashboard">
      <div
        className={`dashboard-overlay ${sidebarOpen ? "active" : ""}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      <SidebarNav />

      <div className={`main-container ${sidebarOpen ? "sidebar-open" : ""}`}>
        <DashboardHeader />

        {activeTab === "overview" && renderOverview()}
        {activeTab === "teachers" && renderTeachers()}
        {activeTab === "students" && renderStudents()}
        {activeTab === "studentView" && renderStudentView()}
        {activeTab === "analytics" && renderAnalytics()}
      </div>
    </div>
  );
};

export default OrganizationDashboard;