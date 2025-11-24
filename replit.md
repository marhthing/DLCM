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
- **LATEST**: Migrated from in-memory/Supabase to Google Sheets storage with race-condition-safe initialization
- **LATEST**: Implemented heartbeat-based attendance system (30-second intervals) to prevent auto-refresh issues
- **LATEST**: Added session-based tracking with streamSessionId (videoId + date) for preventing duplicate records
- **LATEST**: Real-time UI showing start time, elapsed duration, and remaining time with live counters
- **LATEST**: Auto-migration system for backward compatibility (upgrades old 7-column sheets to 9-column format)
- **LATEST**: Fixed start time accuracy using refs and explicit parameter passing to avoid closure capture
- Initial implementation of the church attendance tracking system
- Four main pages: User Login, Stream Viewer, Admin Login, Admin Dashboard
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
- **AttendanceRecord**: id, name, email, streamSessionId, startTime, endTime, lastSeenAt, durationSeconds, timestamp
- **StreamSettings**: youtubeUrl, updatedAt
- **ViewerSession**: name, email, startTime, lastStreamSessionId (stored in localStorage)

### Storage
- **Google Sheets** (primary) with automatic schema migration and upsert logic
  - Auto-detects old 7-column format and upgrades to 9-column format
  - Backfills legacy records with unique `legacy-${rowId}` session IDs
  - Session-based deduplication: matches by email + streamSessionId
- In-memory storage (MemStorage) available as fallback
- Requires GOOGLE_SPREADSHEET_ID environment variable for Sheets integration

## Key Features
1. **No-friction user entry** - Just name and email, no password required
2. **Heartbeat-based tracking** - 30-second intervals prevent auto-refresh, updates duration live
3. **Session-based deduplication** - Same user + same stream + same day = UPDATE (not duplicate)
4. **Real-time UI** - Shows formatted start time (h:mm a) and live duration counter (Xh Xm Xs)
5. **Automatic session detection** - New stream or new day creates new record; same session updates existing
6. **YouTube stream integration** - Supports multiple URL formats (watch, short links, embed)
7. **Admin controls** - Update stream URL, view all attendance records
8. **CSV export** - Download attendance data for external processing
9. **Google Sheets storage** - All data persists in user's own spreadsheet with automatic schema migration
10. **Responsive design** - Works on mobile, tablet, and desktop
11. **SEO optimized** - Proper meta tags for search engines and social sharing

## User Journeys
### Viewer Flow
1. Visit home page → Enter name and email → Join stream
2. Watch service (heartbeat sends update every 30 seconds)
3. See real-time start time and duration counter on screen
4. Close tab when done (final attendance sent via sendBeacon)
5. Return to same stream: existing record updates (no duplicate created)
6. Join different stream or different day: new record created

### Admin Flow
1. Click "Admin Access" → Enter password (`admin123`)
2. View dashboard with attendance records from Google Sheets
3. Update YouTube stream URL as needed
4. Export attendance to CSV for records

## Technical Notes
- **Session Management**: localStorage persists user data + lastStreamSessionId across refreshes
- **Heartbeat System**: 30-second intervals update attendance without causing page refreshes
- **Session ID Format**: `${videoId}_${YYYY-MM-DD}` uniquely identifies each stream session
- **Start Time Accuracy**: Uses refs and explicit parameters to avoid React closure capture issues
- **Final Flush**: sendBeacon on beforeunload/pagehide/visibilitychange ensures last update
- **Auto-Migration**: Google Sheets storage automatically detects and upgrades old 7-column format
- **Legacy Preservation**: Old records backfilled with `legacy-${rowId}` session IDs, never overwritten
- **Upsert Logic**: Matches by exact streamSessionId only (no legacy fallback)
- YouTube URLs automatically converted to embed format
- Dark theme on stream page for comfortable viewing
- Gradient backgrounds on login pages for visual appeal

## Environment Variables Required
- `GOOGLE_SPREADSHEET_ID`: ID of the Google Sheet for attendance data (required for production)
