# Church Live Stream Attendance Tracker

## Overview
A web application that allows church members to watch live-streamed services and automatically tracks their attendance based on viewing duration. Features admin controls for managing the stream URL and viewing attendance reports.

## Purpose
- Enable remote church attendance tracking
- Provide easy access to live-streamed church services
- Allow administrators to monitor attendance and export data for records

## Current State
Production-ready MVP with all core features implemented and functional.

## Recent Changes (November 24, 2025)
- Initial implementation of the church attendance tracking system
- Four main pages: User Login, Stream Viewer, Admin Login, Admin Dashboard
- In-memory storage for attendance records
- YouTube stream URL management
- CSV export functionality for attendance data

## User Preferences
- Clean, modern UI with indigo color scheme
- Simple user flow - no complex authentication for viewers
- Admin password protection: `admin123` (change in production)
- Responsive design for mobile and desktop viewing

## Project Architecture

### Frontend (React + Wouter)
- **Login Page** (`/`) - Users enter name and email to join stream
- **Stream Page** (`/stream`) - YouTube embed with attendance tracking
- **Admin Login** (`/admin/login`) - Password-protected admin access
- **Admin Dashboard** (`/admin/dashboard`) - Stream management and attendance records

### Backend (Express API)
- **GET `/api/stream/settings`** - Fetch current YouTube URL
- **PUT `/api/stream/settings`** - Update YouTube URL (admin)
- **GET `/api/attendance/records`** - Get all attendance records (admin)
- **POST `/api/attendance/record`** - Record user attendance
- **POST `/api/admin/login`** - Authenticate admin user

### Data Models
- **AttendanceRecord**: name, email, startTime, endTime, durationSeconds, timestamp
- **StreamSettings**: youtubeUrl, updatedAt
- **ViewerSession**: name, email (stored in localStorage)

### Storage
- In-memory storage (MemStorage) for development
- Data persists during server runtime
- Can be upgraded to PostgreSQL for production persistence

## Key Features
1. **No-friction user entry** - Just name and email, no password required
2. **Automatic attendance tracking** - Tracks viewing duration from join to leave
3. **YouTube stream integration** - Supports multiple URL formats (watch, short links, embed)
4. **Admin controls** - Update stream URL, view all attendance records
5. **CSV export** - Download attendance data for external processing
6. **Responsive design** - Works on mobile, tablet, and desktop
7. **SEO optimized** - Proper meta tags for search engines and social sharing

## User Journeys
### Viewer Flow
1. Visit home page → Enter name and email → Join stream
2. Watch service (attendance tracked automatically)
3. Close tab when done (attendance recorded with duration)

### Admin Flow
1. Click "Admin Access" → Enter password (`admin123`)
2. View dashboard with attendance records
3. Update YouTube stream URL as needed
4. Export attendance to CSV for records

## Technical Notes
- Uses localStorage to persist user session across page refreshes
- beforeunload event captures viewing duration on tab close
- YouTube URLs automatically converted to embed format
- Dark theme on stream page for comfortable viewing
- Gradient backgrounds on login pages for visual appeal
