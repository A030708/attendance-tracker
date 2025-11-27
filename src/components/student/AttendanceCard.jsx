    import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './AttendanceCard.css';

const AttendanceCard = ({ classData }) => {
  const [attendanceDetails, setAttendanceDetails] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (showDetails) {
      loadAttendanceDetails();
    }
  }, [showDetails]);

  const loadAttendanceDetails = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('class_id', classData.id)
      .eq('student_id', user.id)
      .order('date', { ascending: false });

    setAttendanceDetails(data || []);
  };

  const getPercentageColor = (percentage) => {
    if (percentage >= 75) return '#10b981';
    if (percentage >= 60) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="attendance-card">
      <div className="card-header">
        <h3>{classData.name}</h3>
        <span className="subject-badge">{classData.subject}</span>
      </div>

      <div className="attendance-stats">
        <div className="stat-row">
          <span>Total Classes:</span>
          <strong>{classData.totalClasses}</strong>
        </div>
        <div className="stat-row">
          <span>Present:</span>
          <strong className="present">{classData.presentClasses}</strong>
        </div>
        <div className="stat-row">
          <span>Absent:</span>
          <strong className="absent">
            {classData.totalClasses - classData.presentClasses}
          </strong>
        </div>
      </div>

      <div className="percentage-display">
        <div className="percentage-circle">
          <svg width="120" height="120">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={getPercentageColor(classData.percentage)}
              strokeWidth="10"
              strokeDasharray={`${classData.percentage * 3.14} 314`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="percentage-text">
            <span className="percentage-value">{classData.percentage}%</span>
          </div>
        </div>
      </div>

      <button 
        className="btn-details"
        onClick={() => setShowDetails(!showDetails)}
      >
        {showDetails ? 'Hide Details' : 'View Details'}
      </button>

      {showDetails && (
        <div className="attendance-details">
          <h4>Attendance History</h4>
          {attendanceDetails.length === 0 ? (
            <p>No attendance records yet.</p>
          ) : (
            <div className="attendance-list">
              {attendanceDetails.map((record) => (
                <div key={record.id} className="attendance-record">
                  <span className="date">
                    {new Date(record.date).toLocaleDateString()}
                  </span>
                  <span className={`status ${record.status}`}>
                    {record.status === 'present' ? '✓ Present' : '✗ Absent'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceCard;