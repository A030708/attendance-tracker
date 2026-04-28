// src/utils/sendEmail.js

export async function sendAttendanceEmail(payload) {
  // ✅ LOCALHOST MODE: just log to console
  console.log("📧 EMAIL MOCK (localhost):", payload);

  // When deployed, we will switch this ON
  return Promise.resolve();
}
