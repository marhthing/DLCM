# Church Live Stream Attendance Tracker

## Overview
A Next.js web application that allows church members to watch live-streamed services and automatically tracks their attendance based on viewing duration. Features admin controls for managing the stream URL and viewing attendance reports.

## Purpose
- Enable remote church attendance tracking
- Provide easy access to live-streamed church services
- Allow administrators to monitor attendance and export data for records

## Current State
Production-ready for Vercel deployment. Successfully migrated from Express to Next.js App Router.

## Recent Changes (December 11, 2025)
- **LATEST**: Check Live Now button now checks immediately without schedule restrictions
- **LATEST**: Added check interval setting for auto-detect (1, 3, 5, 10, 15, or 30 minutes) to manage API quota
- **LATEST**: Cron endpoint now respects check interval and throttles API calls accordingly
- Added YouTube API integration for automatic live stream detection
- New admin settings: YouTube Channel ID, check day/time, auto-attendance duration, check interval
- When a live stream is detected, attendance automatically starts for configured duration (default 4 hours)
- Manual URL setting still available as fallback
- New cron endpoint `/api/cron/youtube-check` for scheduled live stream checks

## Previous Changes (December 10, 2025)
- Separated Stream Settings from Attendance functionality
- Created new Attendance Record section for branch-specific attendance management
- Admin section now shows Stream Settings + combined attendance from all branches with branch filter
- Login page now has two buttons: "Attendance Record" and "Admin"

## Previous Changes (November 24, 2025)
- Migrated from Express backend to Next.js App Router for Vercel deployment
- Converted all Express API routes to Next.js route handlers
- Added React Query provider for state management across admin pages
- Implemented shared active viewer tracking using lib/active-viewers.ts
- Secured admin password using ADMIN_PASSWORD environment variable
- Migrated from in-memory/Supabase to Google Sheets storage with race-condition-safe initialization
- Implemented heartbeat-based attendance system (30-second intervals) to prevent auto-refresh issues
- Added session-based tracking with streamSessionId (videoId + date) for preventing duplicate records
- Real-time UI showing start time, elapsed duration, and remaining time with live counters
- Auto-migration system for backward compatibility (upgrades old 7-column sheets to 9-column format)
- Fixed start time accuracy using refs and explicit parameter passing to avoid closure capture

## User Preferences
- Clean, modern UI with indigo color scheme
- Simple user flow - no complex authentication for viewers
- Admin password protection: `admin123` (change in production)
- Responsive design for mobile and desktop viewing

## Project Architecture

### Frontend (Next.js App Router)
- **Login Page** (`app/page.tsx`) - Users enter name, email, and branch to join stream; has two staff access buttons
- **Stream Page** (`app/stream/page.tsx`) - YouTube embed with attendance tracking
- **Attendance Login** (`app/attendance/login/page.tsx`) - Branch-specific access for attendance management
- **Attendance Dashboard** (`app/attendance/dashboard/page.tsx`) - Branch-specific start/stop attendance and view records
- **Admin Login** (`app/admin/login/page.tsx`) - Password-protected admin access (no branch required)
- **Admin Dashboard** (`app/admin/dashboard/page.tsx`) - Stream Settings, start/stop attendance, and combined attendance records from all branches with branch filter

### Backend (Next.js API Routes)
- **GET `/api/stream/settings`** - Fetch current stream settings
- **PUT `/api/stream/settings`** - Update stream settings including YouTube API config (admin)
- **GET `/api/attendance/records`** - Get all attendance records (admin)
- **POST `/api/attendance/heartbeat`** - Record user attendance heartbeat
- **GET `/api/attendance/active-count`** - Get count of active viewers
- **POST `/api/admin/login`** - Authenticate admin user
- **POST `/api/youtube/check-live`** - Manually trigger live stream check
- **GET `/api/youtube/check-live`** - Get YouTube API settings and check auto-stop
- **GET `/api/cron/youtube-check`** - Cron endpoint for scheduled live stream detection

### Data Models
- **AttendanceRecord**: id, name, email, streamSessionId, startTime, endTime, lastSeenAt, durationSeconds, timestamp
- **StreamSettings**: youtubeUrl, isAttendanceActive, updatedAt, youtubeChannelId, checkDay, checkStartTime, checkEndTime, autoAttendanceDurationHours, lastLiveCheckDate, autoDetectedUrl, attendanceAutoStopAt
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
- **Next.js Framework**: Using App Router with React Server Components where appropriate
- **Session Management**: localStorage persists user data + lastStreamSessionId across refreshes
- **Heartbeat System**: 30-second intervals update attendance without causing page refreshes
- **Session ID Format**: `${videoId}_${YYYY-MM-DD}` uniquely identifies each stream session
- **Start Time Accuracy**: Uses refs and explicit parameters to avoid React closure capture issues
- **Final Flush**: sendBeacon on beforeunload/pagehide/visibilitychange ensures last update
- **Auto-Migration**: Google Sheets storage automatically detects and upgrades old 7-column format
- **Legacy Preservation**: Old records backfilled with `legacy-${rowId}` session IDs, never overwritten
- **Upsert Logic**: Matches by exact streamSessionId only (no legacy fallback)
- **Active Viewers**: In-memory tracking works locally; for production on Vercel consider adding persistent storage
- YouTube URLs automatically converted to embed format
- Dark theme on stream page for comfortable viewing
- Gradient backgrounds on login pages for visual appeal

## Deployment to Vercel
1. Set environment variables in Vercel dashboard:
   - `GOOGLE_SPREADSHEET_ID` - Your Google Sheet ID
   - `ADMIN_PASSWORD` - Secure admin password (do NOT use default)
2. Deploy using `vercel` CLI or connect GitHub repository
3. Note: Active viewer count uses in-memory Map (resets on serverless function cold starts)
   - For accurate production counts, consider implementing persistent storage (Redis, Upstash, etc.)

## Environment Variables Required
- `GOOGLE_SPREADSHEET_ID`: ID of the Google Sheet for attendance data (required for production)
- `ADMIN_PASSWORD`: Admin password for dashboard access (defaults to "admin123" if not set - **MUST be set in production**)
- `YOUTUBE_API_KEY`: YouTube Data API v3 key for live stream detection (optional - only needed for auto-detection feature)
