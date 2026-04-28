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
![Main Login](images/screenshots/main%20login%20page.png)

### Admin Panel
![Admin Dashboard](images/screenshots/admin/admin%20dashboard.png)
![Admin Panel](images/screenshots/admin/admin%20pannel.png)
![Teacher Registration](images/screenshots/admin/teacher%20register%20.png)
![Multi-Factor Authentication](images/screenshots/admin/multi%20factor%20authentication.png)
![Student Management](images/screenshots/admin/stundent%20management.png)
![Analysis](images/screenshots/admin/analysis.png)

### Teacher Dashboard
![Teacher Dashboard](images/screenshots/teacher/teachers%20dashboard.png)
![Create Class](images/screenshots/teacher/create%20class.png)
![Manage Students](images/screenshots/teacher/Manage%20Student%20in%20class.png)
![Attendance Report](images/screenshots/teacher/Attendence%20Report.png)

### Student Dashboard
![Student Dashboard](images/screenshots/student%20dashboard.png)
![Student Classes](images/screenshots/student%20classes.png)

### Database Structure
![Database Schema](images/screenshots/database.png)

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