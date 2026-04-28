// src/utils/attendanceTimeCheck.js
/**
 * Checks if current time is before 4:00 PM
 * @returns {Object} { isAllowed: boolean, remainingHours: number, remainingMinutes: number, message: string }
 */
export const checkAttendanceEditPermission = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Set cutoff time to 4:00 PM (16:00)
  const cutoffHour = 16; // 4 PM
  const cutoffMinute = 0;
  
  const isAllowed = currentHour < cutoffHour || 
                   (currentHour === cutoffHour && currentMinute < cutoffMinute);
  
  // Calculate time remaining
  let hoursRemaining = cutoffHour - currentHour;
  let minutesRemaining = cutoffMinute - currentMinute;
  
  if (minutesRemaining < 0) {
    hoursRemaining -= 1;
    minutesRemaining += 60;
  }
  
  let message = "";
  if (!isAllowed) {
    message = "Attendance editing is only allowed until 4:00 PM. Please contact admin for changes.";
  }
  
  return {
    isAllowed,
    hoursRemaining,
    minutesRemaining,
    message,
    cutoffTime: `${cutoffHour}:${cutoffMinute.toString().padStart(2, '0')}`
  };
};

/**
 * Checks if attendance editing is allowed and shows alert if not
 * @returns {boolean} true if allowed, false if not
 */
export const checkAndAlertAttendancePermission = () => {
  const { isAllowed, message } = checkAttendanceEditPermission();
  if (!isAllowed) {
    alert(message);
  }
  return isAllowed;
};

/**
 * Gets formatted time remaining string
 * @returns {string} Formatted time remaining
 */
export const getTimeRemainingString = () => {
  const { isAllowed, hoursRemaining, minutesRemaining } = checkAttendanceEditPermission();
  if (!isAllowed) return "Editing closed (after 4:00 PM)";
  return `Time remaining to edit: ${hoursRemaining}h ${minutesRemaining}m`;
};