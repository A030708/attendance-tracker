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
![Main Login](docs/screenshorts/main%20login%20page.png)

### Admin Panel
![Admin Dashboard](docs/screenshorts/admin/admin%20dashboard.png)
![Admin Panel](docs/screenshorts/admin/admin%20pannel.png)
![Teacher Registration](docs/screenshorts/admin/teacher%20register%20.png)
![Multi-Factor Authentication](docs/screenshorts/admin/multi%20factor%20authentication.png)
![Student Management](docs/screenshorts/admin/stundent%20management.png)
![Analysis](docs/screenshorts/admin/analysis.png)

### Teacher Dashboard
![Teacher Dashboard](docs/screenshorts/teacher/teachers%20dashboard.png)
![Create Class](docs/screenshorts/teacher/create%20class.png)
![Manage Students](docs/screenshorts/teacher/Manage%20Student%20in%20class.png)
![Attendance Report](docs/screenshorts/teacher/Attendence%20Report.png)

### Student Dashboard
![Student Dashboard](docs/screenshorts/student%20dashboard.png)
![Student Classes](docs/screenshorts/student%20classes.png)

### Database Structure
![Database Schema](docs/screenshorts/database.png)

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