# Attendance Tracker App

A full-stack attendance management system built with React, Vite, and Supabase.

## Features

- Multi-role authentication (Admin, Teacher, Student)
- Two-factor authentication (2FA)
- Real-time attendance tracking
- Class management
- Attendance reports & exports (PDF, CSV)
- Email notifications

---

## Screenshots

### Main Login
![Main Login](images/screenshorts/main%20login%20page.png)

### Admin Panel
![Admin Dashboard](images/screenshorts/admin/admin%20dashboard.png)
![Admin Panel](images/screenshorts/admin/admin%20pannel.png)
![Teacher Registration](images/screenshorts/admin/teacher%20register%20.png)
![Multi-Factor Authentication](images/screenshorts/admin/multi%20factor%20authentication.png)
![Student Management](images/screenshorts/admin/stundent%20management.png)
![Analysis](images/screenshorts/admin/analysis.png)

### Teacher Dashboard
![Teacher Dashboard](images/screenshorts/teacher/teachers%20dashboard.png)
![Create Class](images/screenshorts/teacher/create%20class.png)
![Manage Students](images/screenshorts/teacher/Manage%20Student%20in%20class.png)
![Attendance Report](images/screenshorts/teacher/Attendence%20Report.png)

### Student Dashboard
![Student Dashboard](images/screenshorts/student%20dashboard.png)
![Student Classes](images/screenshorts/student%20classes.png)

### Database Structure
![Database Schema](images/screenshorts/database.png)

---

## Tech Stack

- **Frontend**: React, Vite
- **Backend**: Node.js, Express
- **Database**: Supabase
- **Authentication**: JWT, 2FA (Speakeasy)
- **Email**: Nodemailer
- **Exports**: jsPDF, csv-writer

---

## Getting Started

```bash
# Install dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Run frontend
npm run dev

# Run backend
cd backend
node server.js
```

---

## Environment Variables

Create a `.env` file in the root and backend folder with your Supabase credentials.