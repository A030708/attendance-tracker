// src/components/teacher/AttendanceReport.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./AttendanceReport.css";
import { checkAttendanceEditPermission, checkAndAlertAttendancePermission } from "../../utils/attendanceTimeCheck";

const AttendanceReport = () => {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionLogs, setSessionLogs] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("summary");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    minPercentage: 0,
    maxPercentage: 100,
    status: "all"
  });
  const [canEditAttendance, setCanEditAttendance] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editedStatuses, setEditedStatuses] = useState({});
  const [savingChanges, setSavingChanges] = useState(false);

  // Check attendance editing permission
  const updateAttendancePermission = () => {
    const { isAllowed, hoursRemaining, minutesRemaining } = checkAttendanceEditPermission();
    setCanEditAttendance(isAllowed);
    if (isAllowed) {
      setTimeRemaining(`Time remaining to edit: ${hoursRemaining}h ${minutesRemaining}m`);
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

  // Helper functions
  const formatDateTime = (iso) => {
    if (!iso) return "-";
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (iso) => {
    if (!iso) return "-";
    const date = new Date(iso);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportSummaryCsv = () => {
    if (!summary.length) {
      alert("No summary data to export.");
      return;
    }
    
    const header = ["S.No", "Student", "Register No", "Present", "Absent", "Total", "Attendance %", "Status"];
    const rows = filteredSummary.map((s, index) => [
      index + 1,
      s.name,
      s.register_no || "",
      s.present,
      s.absent,
      s.total,
      `${s.percentage}%`,
      s.percentage < 75 ? "Low" : s.percentage < 90 ? "Good" : "Excellent"
    ]);
    
    const csvContent = [header, ...rows]
      .map(row => row.join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportSessionCsv = () => {
    if (!sessionLogs.length) {
      alert("No session data to export.");
      return;
    }
    
    const header = ["Student", "Register No", "Status", "Date"];
    const rows = sessionLogs.map((log) => [
      log.name,
      log.register_no || "",
      log.status,
      selectedSessionId && sessions.find(s => s.id === selectedSessionId) 
        ? formatDateTime(sessions.find(s => s.id === selectedSessionId).starts_at)
        : "-"
    ]);
    
    const csvContent = [header, ...rows]
      .map(row => row.join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${selectedSessionId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Start editing a session
  const startEditingSession = (sessionId) => {
    if (!checkAndAlertAttendancePermission()) {
      return;
    }

    setEditingSessionId(sessionId);
    // Initialize edited statuses with current values
    const initialStatuses = {};
    sessionLogs.forEach(log => {
      if (log.session_id === sessionId) {
        initialStatuses[log.id] = log.status;
      }
    });
    setEditedStatuses(initialStatuses);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditedStatuses({});
  };

  // Handle status change during editing
  const handleStatusChange = (logId, newStatus) => {
    if (!checkAndAlertAttendancePermission()) {
      return;
    }
    setEditedStatuses(prev => ({
      ...prev,
      [logId]: newStatus
    }));
  };

  // Save edited attendance
  const saveEditedAttendance = async () => {
    if (!checkAndAlertAttendancePermission()) {
      return;
    }

    setSavingChanges(true);
    setError("");

    try {
      // Update each attendance log
      const updates = Object.entries(editedStatuses).map(([logId, status]) => 
        supabase
          .from("attendance_logs")
          .update({ status })
          .eq("id", logId)
      );

      // Execute all updates
      const results = await Promise.all(updates);
      
      // Check for errors
      const hasError = results.some(result => result.error);
      if (hasError) {
        throw new Error("Failed to update some attendance records");
      }

      // Refresh the session logs
      await loadSessionLogs(selectedSessionId);
      
      // Exit edit mode
      setEditingSessionId(null);
      setEditedStatuses({});
      
      alert("Attendance updated successfully!");
    } catch (err) {
      console.error("Error saving attendance changes:", err);
      setError("Failed to save changes: " + err.message);
    } finally {
      setSavingChanges(false);
    }
  };

  // Delete a session
  const deleteSession = async (sessionId) => {
    if (!checkAndAlertAttendancePermission()) {
      return;
    }

    if (!window.confirm("Are you sure you want to delete this attendance session? This action cannot be undone.")) {
      return;
    }

    setLoading(true);
    try {
      // First delete the attendance logs for this session
      const { error: logsError } = await supabase
        .from("attendance_logs")
        .delete()
        .eq("session_id", sessionId);

      if (logsError) throw logsError;

      // Then delete the session itself
      const { error: sessionError } = await supabase
        .from("attendance_sessions")
        .delete()
        .eq("id", sessionId);

      if (sessionError) throw sessionError;

      // Refresh sessions and logs
      await loadForClass();
      if (selectedSessionId === sessionId) {
        setSelectedSessionId("");
        setSessionLogs([]);
      }

      alert("Session deleted successfully!");
    } catch (err) {
      console.error("Error deleting session:", err);
      setError("Failed to delete session: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Sorting function
  const sortData = (data, key, direction) => {
    return [...data].sort((a, b) => {
      let aValue = a[key];
      let bValue = b[key];
      
      if (key === "percentage" || key === "present" || key === "absent" || key === "total") {
        return direction === "asc" ? aValue - bValue : bValue - aValue;
      }
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        return direction === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return 0;
    });
  };

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  // Filter functions
  const filteredSummary = summary
    .filter(s => {
      if (!searchTerm) return true;
      return s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             (s.register_no && s.register_no.toLowerCase().includes(searchTerm.toLowerCase()));
    })
    .filter(s => {
      if (filters.status === "all") return true;
      if (filters.status === "low") return s.percentage < 75;
      if (filters.status === "good") return s.percentage >= 75 && s.percentage < 90;
      if (filters.status === "excellent") return s.percentage >= 90;
      return true;
    })
    .filter(s => s.percentage >= filters.minPercentage && s.percentage <= filters.maxPercentage);

  // Sort the data
  const sortedSummary = sortData(filteredSummary, sortConfig.key, sortConfig.direction);
  const sortedSessionLogs = sortData(sessionLogs, "name", "asc");

  // Load user and classes
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error("getUser error:", error);
        setError(error.message || "Failed to load user");
      } else {
        setUser(user);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadClasses = async () => {
      setError("");
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, section, class_code, created_at")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("loadClasses error:", error);
        setError("Failed to load classes");
      } else {
        setClasses(data || []);
      }
    };
    loadClasses();
  }, [user]);

  // Load session logs function
  const loadSessionLogs = async (sessionId) => {
    setError("");
    const { data, error } = await supabase
      .from("attendance_logs")
      .select(
        `id, status, student_id, session_id, profiles:student_id (full_name, register_no)`
      )
      .eq("session_id", sessionId);

    if (error) {
      console.error("loadSessionLogs error:", error);
      setError("Failed to load session logs");
    } else {
      const list = data?.map((row) => ({
        id: row.id,
        session_id: row.session_id,
        student_id: row.student_id,
        name: row.profiles?.full_name || "Unknown",
        register_no: row.profiles?.register_no || "",
        status: row.status,
      })) || [];
      
      list.sort((a, b) => a.name.localeCompare(b.name));
      setSessionLogs(list);
    }
  };

  // Load data for selected class
  const loadForClass = async () => {
    if (!selectedClassId || !user) return;

    setLoading(true);
    setError("");

    try {
      // Load sessions
      const { data: sessData, error: sessErr } = await supabase
        .from("attendance_sessions")
        .select("id, code, status, starts_at, created_at")
        .eq("class_id", selectedClassId)
        .eq("teacher_id", user.id)
        .order("starts_at", { ascending: false });

      if (sessErr) throw sessErr;
      setSessions(sessData || []);
      
      // Select first session if available
      if (sessData && sessData.length > 0) {
        setSelectedSessionId(sessData[0].id);
        // Load logs for the first session
        await loadSessionLogs(sessData[0].id);
      } else {
        setSelectedSessionId("");
        setSessionLogs([]);
      }

      // Load summary
      const { data: logsData, error: logsErr } = await supabase
        .from("attendance_logs")
        .select(
          `student_id, status, profiles:student_id (full_name, register_no)`
        )
        .eq("class_id", selectedClassId);

      if (logsErr) throw logsErr;

      const summaryMap = new Map();
      (logsData || []).forEach((row) => {
        const sid = row.student_id;
        const prof = row.profiles || {};
        if (!summaryMap.has(sid)) {
          summaryMap.set(sid, {
            student_id: sid,
            name: prof.full_name || "Unknown",
            register_no: prof.register_no || "",
            total: 0,
            present: 0,
            absent: 0,
          });
        }
        const s = summaryMap.get(sid);
        s.total += 1;
        if (row.status === "present") s.present += 1;
        if (row.status === "absent") s.absent += 1;
      });

      let summaryArr = Array.from(summaryMap.values()).map((s) => ({
        ...s,
        percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
      }));
      
      summaryArr.sort((a, b) => a.name.localeCompare(b.name));
      setSummary(summaryArr);
    } catch (err) {
      console.error("loadForClass error:", err);
      setError("Failed to load report for this class");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForClass();
  }, [selectedClassId, user]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSessionLogs([]);
      return;
    }

    loadSessionLogs(selectedSessionId);
  }, [selectedSessionId]);

  // Derived data
  const totalStudents = summary.length;
  const totalSessions = sessions.length;
  const averageAttendance = summary.length > 0
    ? Math.round(summary.reduce((acc, s) => acc + s.percentage, 0) / summary.length)
    : 0;

  const lowAttendance = summary.filter((s) => s.percentage < 75);
  const highAttendance = summary.filter((s) => s.percentage >= 90);
  const goodAttendance = summary.filter((s) => s.percentage >= 75 && s.percentage < 90);

  // Get selected class details
  const selectedClass = classes.find(c => c.id === selectedClassId);
  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  return (
    <div className="attendance-report">
      {/* Header */}
      <header className="report-header">
        <div className="container">
          <div className="header-content">
            <div>
              <h1 className="report-title">Attendance Report</h1>
              <p className="report-subtitle">Comprehensive attendance analytics and management</p>
            </div>
            <div className="header-actions">
              {selectedClassId && (
                <button 
                  onClick={exportSummaryCsv}
                  className="btn btn-primary"
                  disabled={!summary.length}
                >
                  <span className="btn-icon">↓</span>
                  Export Report
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Attendance Time Status Banner */}
      <div className={`attendance-time-banner ${canEditAttendance ? 'banner-open' : 'banner-closed'}`}>
        <div className="banner-content">
          {canEditAttendance ? (
            <>
              <span className="banner-icon">✅</span>
              <span className="banner-text">{timeRemaining}</span>
            </>
          ) : (
            <>
              <span className="banner-icon">⏰</span>
              <span className="banner-text">Attendance editing is only allowed until 4:00 PM</span>
            </>
          )}
        </div>
      </div>

      <main className="report-main">
        <div className="container">
          {/* Class Selection */}
          <div className="selection-card">
            <div className="selection-header">
              <h2 className="selection-title">Class Selection</h2>
              <div className="selection-info">
                {selectedClass && (
                  <span className="class-info">
                    Selected: <strong>{selectedClass.name}</strong> {selectedClass.section && `(${selectedClass.section})`}
                  </span>
                )}
              </div>
            </div>
            
            <div className="selection-controls">
              <div className="select-group">
                <label className="select-label">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="select"
                  disabled={loading}
                >
                  <option value="">Select a class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.section && `(${cls.section})`} • {cls.class_code}
                    </option>
                  ))}
                </select>
              </div>

              {selectedClassId && (
                <div className="select-group">
                  <label className="select-label">Session</label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => {
                      setSelectedSessionId(e.target.value);
                      setEditingSessionId(null); // Exit edit mode when changing session
                      setEditedStatuses({});
                    }}
                    className="select"
                    disabled={loading || sessions.length === 0}
                  >
                    {sessions.length === 0 ? (
                      <option value="">No sessions available</option>
                    ) : (
                      sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {formatDateTime(s.starts_at)} • {s.code || "Session"}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {selectedClassId && (
                <div className="select-group">
                  <label className="select-label">View</label>
                  <div className="tab-selector">
                    <button
                      className={`tab-btn ${activeTab === "summary" ? "active" : ""}`}
                      onClick={() => setActiveTab("summary")}
                    >
                      Summary
                    </button>
                    <button
                      className={`tab-btn ${activeTab === "session" ? "active" : ""}`}
                      onClick={() => setActiveTab("session")}
                      disabled={!selectedSessionId}
                    >
                      Session
                    </button>
                    <button
                      className={`tab-btn ${activeTab === "analytics" ? "active" : ""}`}
                      onClick={() => setActiveTab("analytics")}
                    >
                      Analytics
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="alert alert-error">
              <div className="alert-content">
                <span className="alert-icon">!</span>
                <span className="alert-text">{error}</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <span>Loading attendance data...</span>
            </div>
          )}

          {/* Dashboard Stats */}
          {selectedClassId && !loading && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-icon">👥</span>
                  <span className="stat-title">Total Students</span>
                </div>
                <div className="stat-value">{totalStudents}</div>
                <div className="stat-subtitle">Enrolled in class</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-icon">📅</span>
                  <span className="stat-title">Sessions</span>
                </div>
                <div className="stat-value">{totalSessions}</div>
                <div className="stat-subtitle">Attendance records</div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-icon">📊</span>
                  <span className="stat-title">Avg Attendance</span>
                </div>
                <div className="stat-value">{averageAttendance}%</div>
                <div className="stat-subtitle">Class average</div>
              </div>

              <div className="stat-card stat-card-warning">
                <div className="stat-header">
                  <span className="stat-icon">⚠</span>
                  <span className="stat-title">Low Attendance</span>
                </div>
                <div className="stat-value">{lowAttendance.length}</div>
                <div className="stat-subtitle">&lt; 75% threshold</div>
              </div>
            </div>
          )}

          {/* Main Content */}
          {selectedClassId && !loading && (
            <div className="content-card">
              {/* Tab Content */}
              {activeTab === "summary" && (
                <div className="tab-content">
                  <div className="content-header">
                    <h3 className="content-title">Attendance Summary</h3>
                    <div className="content-controls">
                      <div className="search-box">
                        <input
                          type="text"
                          placeholder="Search students..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="search-input"
                        />
                        <span className="search-icon">🔍</span>
                      </div>
                      
                      <div className="filter-group">
                        <select 
                          value={filters.status}
                          onChange={(e) => setFilters({...filters, status: e.target.value})}
                          className="filter-select"
                        >
                          <option value="all">All Status</option>
                          <option value="low">Low (&lt;75%)</option>
                          <option value="good">Good (75-89%)</option>
                          <option value="excellent">Excellent (≥90%)</option>
                        </select>
                        
                        <div className="range-filter">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={filters.minPercentage}
                            onChange={(e) => setFilters({...filters, minPercentage: parseInt(e.target.value)})}
                            className="range-slider"
                          />
                          <span className="range-label">
                            {filters.minPercentage}% - {filters.maxPercentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {sortedSummary.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📊</div>
                      <h4>No Attendance Data</h4>
                      <p>No attendance records found for the selected filters.</p>
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th 
                              onClick={() => handleSort("name")}
                              className="sortable"
                            >
                              Student {getSortIcon("name")}
                            </th>
                            <th 
                              onClick={() => handleSort("register_no")}
                              className="sortable"
                            >
                              ID {getSortIcon("register_no")}
                            </th>
                            <th 
                              onClick={() => handleSort("present")}
                              className="sortable numeric"
                            >
                              Present {getSortIcon("present")}
                            </th>
                            <th 
                              onClick={() => handleSort("absent")}
                              className="sortable numeric"
                            >
                              Absent {getSortIcon("absent")}
                            </th>
                            <th 
                              onClick={() => handleSort("total")}
                              className="sortable numeric"
                            >
                              Total {getSortIcon("total")}
                            </th>
                            <th 
                              onClick={() => handleSort("percentage")}
                              className="sortable numeric"
                            >
                              Attendance % {getSortIcon("percentage")}
                            </th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedSummary.map((s) => (
                            <tr key={s.student_id} className={s.percentage < 75 ? 'row-warning' : ''}>
                              <td className="student-cell">
                                <div className="student-info">
                                  <div className="student-avatar">
                                    {s.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="student-details">
                                    <div className="student-name">{s.name}</div>
                                    <div className="student-email">
                                      {s.register_no || 'No ID'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="id-badge">{s.register_no || '-'}</span>
                              </td>
                              <td className="numeric">
                                <span className="count-badge count-present">{s.present}</span>
                              </td>
                              <td className="numeric">
                                <span className="count-badge count-absent">{s.absent}</span>
                              </td>
                              <td className="numeric">
                                <span className="count-badge count-total">{s.total}</span>
                              </td>
                              <td className="numeric">
                                <div className="percentage-cell">
                                  <div className="percentage-value">
                                    {s.percentage}%
                                  </div>
                                  <div className="progress-bar">
                                    <div 
                                      className={`progress-fill ${
                                        s.percentage < 75 ? 'progress-low' : 
                                        s.percentage < 90 ? 'progress-medium' : 
                                        'progress-high'
                                      }`}
                                      style={{ width: `${s.percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`status-badge ${
                                  s.percentage < 75 ? 'status-low' : 
                                  s.percentage < 90 ? 'status-medium' : 
                                  'status-high'
                                }`}>
                                  {s.percentage < 75 ? 'Low' : s.percentage < 90 ? 'Good' : 'Excellent'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="table-footer">
                    <div className="summary-info">
                      Showing {sortedSummary.length} of {summary.length} students
                      {searchTerm && ` matching "${searchTerm}"`}
                    </div>
                    <div className="summary-stats">
                      <span className="stat-item">
                        <span className="stat-dot stat-high"></span>
                        High: {highAttendance.length}
                      </span>
                      <span className="stat-item">
                        <span className="stat-dot stat-medium"></span>
                        Good: {goodAttendance.length}
                      </span>
                      <span className="stat-item">
                        <span className="stat-dot stat-low"></span>
                        Low: {lowAttendance.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "session" && (
                <div className="tab-content">
                  <div className="content-header">
                    <h3 className="content-title">Session Details</h3>
                    <div className="content-controls">
                      {selectedSession && (
                        <div className="session-info">
                          <span className="session-code">
                            {selectedSession?.code}
                          </span>
                          <span className="session-date">
                            • {formatDateTime(selectedSession?.starts_at)}
                          </span>
                        </div>
                      )}
                      
                      <div className="session-actions">
                        {selectedSessionId && (
                          <>
                            {editingSessionId === selectedSessionId ? (
                              <>
                                <button 
                                  onClick={cancelEditing}
                                  className="btn btn-secondary"
                                  disabled={savingChanges}
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={saveEditedAttendance}
                                  className="btn btn-primary"
                                  disabled={savingChanges || !canEditAttendance}
                                >
                                  {savingChanges ? "Saving..." : "Save Changes"}
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => startEditingSession(selectedSessionId)}
                                  className="btn btn-primary"
                                  disabled={!canEditAttendance}
                                >
                                  Edit Attendance
                                </button>
                                <button 
                                  onClick={exportSessionCsv}
                                  className="btn btn-secondary"
                                  disabled={!sessionLogs.length}
                                >
                                  Export Session
                                </button>
                                <button 
                                  onClick={() => deleteSession(selectedSessionId)}
                                  className="btn btn-danger"
                                  disabled={!canEditAttendance}
                                >
                                  Delete Session
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {sortedSessionLogs.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📝</div>
                      <h4>No Session Data</h4>
                      <p>No attendance recorded for this session.</p>
                    </div>
                  ) : (
                    <>
                      <div className="session-stats">
                        <div className="session-stat">
                          <div className="session-stat-value">
                            {sortedSessionLogs.filter(l => l.status === 'present').length}
                          </div>
                          <div className="session-stat-label">Present</div>
                        </div>
                        <div className="session-stat">
                          <div className="session-stat-value">
                            {sortedSessionLogs.filter(l => l.status === 'absent').length}
                          </div>
                          <div className="session-stat-label">Absent</div>
                        </div>
                        <div className="session-stat">
                          <div className="session-stat-value">{sortedSessionLogs.length}</div>
                          <div className="session-stat-label">Total</div>
                        </div>
                        <div className="session-stat">
                          <div className="session-stat-value">
                            {Math.round(
                              (sortedSessionLogs.filter(l => l.status === 'present').length / 
                              sortedSessionLogs.length) * 100
                            )}%
                          </div>
                          <div className="session-stat-label">Attendance Rate</div>
                        </div>
                      </div>

                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Register No</th>
                              <th>Status</th>
                              {editingSessionId === selectedSessionId && <th>Actions</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedSessionLogs.map((log) => (
                              <tr key={log.id}>
                                <td className="student-cell">
                                  <div className="student-info">
                                    <div className="student-avatar">
                                      {log.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="student-details">
                                      <div className="student-name">{log.name}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className="id-badge">{log.register_no || '-'}</span>
                                </td>
                                <td>
                                  {editingSessionId === selectedSessionId ? (
                                    <div className="status-edit">
                                      <select
                                        value={editedStatuses[log.id] || log.status}
                                        onChange={(e) => handleStatusChange(log.id, e.target.value)}
                                        className="status-select"
                                        disabled={!canEditAttendance || savingChanges}
                                      >
                                        <option value="present">Present</option>
                                        <option value="absent">Absent</option>
                                        <option value="late">Late</option>
                                        <option value="excused">Excused</option>
                                      </select>
                                      <span className={`status-preview ${
                                        (editedStatuses[log.id] || log.status) === 'present' ? 'status-high' : 
                                        (editedStatuses[log.id] || log.status) === 'late' ? 'status-medium' : 
                                        'status-low'
                                      }`}>
                                        {(editedStatuses[log.id] || log.status).charAt(0).toUpperCase() + 
                                         (editedStatuses[log.id] || log.status).slice(1)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className={`status-badge ${
                                      log.status === 'present' ? 'status-high' : 
                                      log.status === 'late' ? 'status-medium' : 
                                      'status-low'
                                    }`}>
                                      {log.status === 'present' ? 'Present' : 
                                       log.status === 'late' ? 'Late' : 
                                       log.status === 'excused' ? 'Excused' : 'Absent'}
                                    </span>
                                  )}
                                </td>
                                {editingSessionId === selectedSessionId && (
                                  <td>
                                    <button
                                      onClick={() => handleStatusChange(log.id, 'present')}
                                      className="btn-status-present"
                                      disabled={!canEditAttendance || savingChanges}
                                    >
                                      Present
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(log.id, 'absent')}
                                      className="btn-status-absent"
                                      disabled={!canEditAttendance || savingChanges}
                                    >
                                      Absent
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {editingSessionId === selectedSessionId && (
                        <div className="edit-actions">
                          <button 
                            onClick={cancelEditing}
                            className="btn btn-secondary"
                            disabled={savingChanges}
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={saveEditedAttendance}
                            className="btn btn-primary"
                            disabled={savingChanges || !canEditAttendance}
                          >
                            {savingChanges ? "Saving Changes..." : "Save All Changes"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === "analytics" && (
                <div className="tab-content">
                  <div className="content-header">
                    <h3 className="content-title">Attendance Analytics</h3>
                    <div className="content-controls">
                      <div className="date-range">
                        <span>Overall Statistics</span>
                      </div>
                    </div>
                  </div>

                  {summary.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📈</div>
                      <h4>No Analytics Data</h4>
                      <p>Start marking attendance to see analytics.</p>
                    </div>
                  ) : (
                    <div className="analytics-grid">
                      <div className="analytics-card">
                        <h4 className="analytics-title">Attendance Distribution</h4>
                        <div className="distribution-chart">
                          <div className="distribution-bar">
                            <div 
                              className="distribution-segment segment-high"
                              style={{ width: `${(highAttendance.length / summary.length) * 100}%` }}
                            >
                              <span className="segment-label">Excellent ({highAttendance.length})</span>
                            </div>
                            <div 
                              className="distribution-segment segment-medium"
                              style={{ width: `${(goodAttendance.length / summary.length) * 100}%` }}
                            >
                              <span className="segment-label">Good ({goodAttendance.length})</span>
                            </div>
                            <div 
                              className="distribution-segment segment-low"
                              style={{ width: `${(lowAttendance.length / summary.length) * 100}%` }}
                            >
                              <span className="segment-label">Low ({lowAttendance.length})</span>
                            </div>
                          </div>
                          <div className="distribution-legend">
                            <div className="legend-item">
                              <span className="legend-dot dot-high"></span>
                              <span>Excellent (≥90%)</span>
                            </div>
                            <div className="legend-item">
                              <span className="legend-dot dot-medium"></span>
                              <span>Good (75-89%)</span>
                            </div>
                            <div className="legend-item">
                              <span className="legend-dot dot-low"></span>
                              <span>Low (&lt;75%)</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="analytics-card">
                        <h4 className="analytics-title">Low Attendance Students</h4>
                        {lowAttendance.length === 0 ? (
                          <div className="no-data">
                            <span className="no-data-icon">✅</span>
                            <p>All students have satisfactory attendance.</p>
                          </div>
                        ) : (
                          <div className="low-attendance-list">
                            {lowAttendance.slice(0, 5).map((s) => (
                              <div key={s.student_id} className="low-attendance-item">
                                <div className="low-attendance-info">
                                  <div className="student-avatar-small">
                                    {s.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="student-name-small">{s.name}</div>
                                    <div className="student-id-small">{s.register_no || 'No ID'}</div>
                                  </div>
                                </div>
                                <div className="low-attendance-percentage">
                                  <span className="percentage-value-low">{s.percentage}%</span>
                                  <div className="progress-bar-small">
                                    <div 
                                      className="progress-fill-low"
                                      style={{ width: `${s.percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {lowAttendance.length > 5 && (
                              <div className="more-items">
                                +{lowAttendance.length - 5} more students
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {!selectedClassId && !loading && (
        <div className="empty-dashboard">
          <div className="empty-content">
            <div className="empty-icon-large">📊</div>
            <h3>Select a Class</h3>
            <p>Choose a class from the dropdown to view attendance reports and analytics.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceReport;