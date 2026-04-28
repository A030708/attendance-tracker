// backend/server.js
require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// =============================
// SUPABASE (SERVICE ROLE)
// =============================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =============================
// MAIL ENV VARIABLES
// =============================
const SMTP_USER = (process.env.MAIL_USER || process.env.SMTP_USER || "").trim();
const SMTP_PASS = (process.env.MAIL_PASS || process.env.SMTP_PASS || "").trim();

console.log("SMTP_USER:", SMTP_USER || "<EMPTY>");
console.log("SMTP_PASS set?", !!SMTP_PASS);

// =============================
// NODEMAILER TRANSPORTER
// =============================
let transporter = null;

if (!SMTP_USER || !SMTP_PASS) {
  console.warn("⚠️  Email sending is DISABLED because SMTP_USER / SMTP_PASS are missing.");
} else {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  transporter.verify((err) => {
    if (err) {
      console.error("❌ SMTP verification failed:", err);
    } else {
      console.log("✅ SMTP server is ready to take messages");
    }
  });
}

// =============================
// HELPERS
// =============================
function classSentence(classes) {
  if (!classes || classes.length === 0) return "no classes recorded";
  if (classes.length === 1) return classes[0];
  if (classes.length === 2) return `${classes[0]} and ${classes[1]}`;
  return `${classes.slice(0, -1).join(", ")} and ${classes.at(-1)}`;
}

// 🔔 Daily absence email
async function sendMail(info) {
  if (!transporter) {
    console.warn("⚠️ Tried to send email but SMTP is not configured. Skipping.");
    return;
  }

  const text = `
Dear Parent,

Your child ${info.studentName} (Roll No: ${info.rollNo})
was absent today (${info.date}) for:
${classSentence(info.classes)}.

Regards,
Attendance Monitoring System
`.trim();

  await transporter.sendMail({
    from: `"Attendance System" <${SMTP_USER}>`,
    to: info.parentEmail,
    subject: `Absence Notice – ${info.studentName}`,
    text,
  });

  console.log(`📧 Sent absence email to ${info.parentEmail} for ${info.studentName}`);
}

// 🔔 Subject-wise low attendance email (last 21 days, ≥15 classes, <75%)
async function sendLowAttendanceMail({ parentEmail, studentName, rollNo, subjects }) {
  if (!transporter) {
    console.warn("⚠️ Tried to send LOW attendance email but SMTP is not configured. Skipping.");
    return;
  }

  const lines = subjects
    .map(
      (s) =>
        `- ${s.name}: ${s.percentage}% (${s.present}/${s.total} classes attended)`
    )
    .join("\n");

  const text = `
Dear Parent,

This is to inform you that your child ${studentName} (Roll No: ${rollNo})
currently has LOW attendance (< 75%) in the following subjects
(considering the last 21 days, with at least 15 classes in each subject):

${lines}

We request you to kindly ensure better attendance in the coming days.

Regards,
Attendance Monitoring System
`.trim();

  await transporter.sendMail({
    from: `"Attendance System" <${SMTP_USER}>`,
    to: parentEmail,
    subject: `Low Attendance Alert – ${studentName} (Subject-wise)`,
    text,
  });

  console.log(
    `📧 Sent LOW attendance email (subject-wise) to ${parentEmail} for ${studentName}`
  );
}

// =============================
// CRON BATCH JOB 1: DAILY ABSENTEES
// Runs daily at 14:55 IST
// =============================
cron.schedule(
  "21 15 * * *",
  async () => {
    console.log("⏰ 2:55 PM – Running absence batch...");

    if (!transporter) {
      console.warn("⚠️ Skipping absence cron: SMTP not configured.");
      return;
    }

    const now = new Date();
    const startIST = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    startIST.setHours(0, 0, 0, 0);
    const endIST = new Date(startIST);
    endIST.setDate(endIST.getDate() + 1);

    console.log(
      "📅 Absence window (IST):",
      startIST.toISOString(),
      "→",
      endIST.toISOString()
    );

    const { data: logs, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("status", "absent")
      .eq("notified", false)
      .gte("marked_at", startIST.toISOString())
      .lt("marked_at", endIST.toISOString());

    if (error) {
      console.error("❌ Error fetching absence logs:", error.message);
      return;
    }

    if (!logs || !logs.length) {
      console.log("ℹ️ No absentees today");
      return;
    }

    console.log(`📊 Found ${logs.length} absence logs`);

    const students = {};
    for (const l of logs) {
      students[l.student_id] ??= [];
      students[l.student_id].push(l);
    }

    for (const studentId in students) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", studentId)
        .single();

      if (profileError) {
        console.error(
          `❌ Error fetching profile for student ${studentId}:`,
          profileError.message
        );
        continue;
      }

      console.log("📄 Absence profile for student", studentId, ":", profile);

      if (!profile?.parent_email) {
        console.warn(
          `⚠️ No parent_email for student ${studentId}, skipping email.`
        );
        continue;
      }

      const rollNo =
        profile.register_no ??
        profile.roll_no ??
        profile.rollno ??
        profile.roll_number ??
        profile.roll ??
        "N/A";

      const classes = [];

      for (const log of students[studentId]) {
        const { data: session, error: sessionError } = await supabase
          .from("attendance_sessions")
          .select("class_id")
          .eq("id", log.session_id)
          .single();

        if (sessionError || !session) {
          console.error(
            `❌ Error fetching session ${log.session_id}:`,
            sessionError?.message
          );
          continue;
        }

        const { data: classObj, error: classError } = await supabase
          .from("classes")
          .select("name")
          .eq("id", session.class_id)
          .single();

        if (classError) {
          console.error(
            `❌ Error fetching class ${session.class_id}:`,
            classError.message
          );
          continue;
        }

        if (classObj?.name) classes.push(classObj.name);
      }

      await sendMail({
        parentEmail: profile.parent_email,
        studentName: profile.full_name,
        rollNo,
        date: startIST.toISOString().slice(0, 10),
        classes,
      });

      const ids = students[studentId].map((l) => l.id);

      const { error: updateError } = await supabase
        .from("attendance_logs")
        .update({ notified: true })
        .in("id", ids);

      if (updateError) {
        console.error(
          `❌ Error marking notified for student ${studentId}:`,
          updateError.message
        );
      } else {
        console.log(
          `✅ Marked ${ids.length} logs notified for student ${studentId}`
        );
      }
    }

    console.log("✅ Absence batch processed");
  },
  { timezone: "Asia/Kolkata" }
);

// =============================
// CRON BATCH JOB 2: SUBJECT-WISE LOW ATTENDANCE
// Last 21 days, only subjects with ≥15 classes and <75%
// Runs daily at 5:00 PM IST
// =============================
cron.schedule(
  "23 15 * * *",
  async () => {
    console.log("⏰ 5:00 PM – Running SUBJECT-WISE LOW attendance check...");

    if (!transporter) {
      console.warn("⚠️ Skipping LOW attendance cron: SMTP not configured.");
      return;
    }

    const now = new Date();
    const nowIST = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const startIST = new Date(nowIST);
    // ✅ last 21 days window
    startIST.setDate(startIST.getDate() - 21);

    console.log(
      "📅 LOW attendance window (IST):",
      startIST.toISOString(),
      "→",
      nowIST.toISOString()
    );

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .not("parent_email", "is", null);

    if (profilesError) {
      console.error(
        "❌ Error fetching profiles for LOW attendance:",
        profilesError.message
      );
      return;
    }

    if (!profiles || !profiles.length) {
      console.log("ℹ️ No profiles found for LOW attendance check");
      return;
    }

    console.log(
      `👨‍🎓 Checking LOW attendance (subject-wise) for ${profiles.length} students`
    );

    for (const profile of profiles) {
      const studentId = profile.id;

      const { data: logs, error: logsError } = await supabase
        .from("attendance_logs")
        .select("status, marked_at, session_id")
        .eq("student_id", studentId)
        .gte("marked_at", startIST.toISOString())
        .lte("marked_at", nowIST.toISOString());

      if (logsError) {
        console.error(
          `❌ Error fetching logs for LOW attendance (student ${studentId}):`,
          logsError.message
        );
        continue;
      }

      if (!logs || !logs.length) {
        continue;
      }

      const sessionIds = [
        ...new Set(logs.map((l) => l.session_id).filter(Boolean)),
      ];
      if (!sessionIds.length) continue;

      const { data: sessions, error: sessionsError } = await supabase
        .from("attendance_sessions")
        .select("id, class_id")
        .in("id", sessionIds);

      if (sessionsError || !sessions?.length) {
        console.error(
          `❌ Error fetching sessions for student ${studentId}:`,
          sessionsError?.message
        );
        continue;
      }

      const sessionById = {};
      for (const s of sessions) sessionById[s.id] = s;

      const classIds = [
        ...new Set(
          sessions.map((s) => s.class_id).filter((cid) => cid !== null)
        ),
      ];
      if (!classIds.length) continue;

      const { data: classes, error: classesError } = await supabase
        .from("classes")
        .select("id, name")
        .in("id", classIds);

      if (classesError || !classes?.length) {
        console.error(
          `❌ Error fetching classes for LOW attendance (student ${studentId}):`,
          classesError?.message
        );
        continue;
      }

      const classById = {};
      for (const c of classes) classById[c.id] = c;

      const subjectStats = {}; // { classId: { present, total } }

      for (const log of logs) {
        const sess = sessionById[log.session_id];
        if (!sess) continue;
        const classId = sess.class_id;
        if (!classId) continue;

        subjectStats[classId] ??= { present: 0, total: 0 };
        subjectStats[classId].total += 1;
        if (log.status === "present") {
          subjectStats[classId].present += 1;
        }
      }

      const lowSubjects = [];

      for (const classId in subjectStats) {
        const { present, total } = subjectStats[classId];
        if (!total) continue;

        const percentage = Math.round((present / total) * 100);

        // ✅ your rule: at least 15 classes in last 21 days AND <75%
        if (total < 15) continue;
        if (percentage >= 75) continue;

        const subjectName = classById[classId]?.name || "Unknown Subject";

        lowSubjects.push({
          name: subjectName,
          present,
          total,
          percentage,
        });
      }

      if (!lowSubjects.length) continue;

      const rollNo =
        profile.register_no ??
        profile.roll_no ??
        profile.rollno ??
        profile.roll_number ??
        profile.roll ??
        "N/A";

      console.log(
        `📊 LOW SUBJECTS – Student ${studentId} (${profile.full_name}) –`,
        lowSubjects
      );

      await sendLowAttendanceMail({
        parentEmail: profile.parent_email,
        studentName: profile.full_name,
        rollNo,
        subjects: lowSubjects,
      });
    }

    console.log("✅ SUBJECT-WISE LOW attendance check completed");
  },
  { timezone: "Asia/Kolkata" }
);

// =============================
// SIMPLE HEALTH CHECK
// =============================
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Attendance backend running" });
});

// =============================
// START SERVER
// =============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Backend running on http://localhost:${PORT}`)
);
