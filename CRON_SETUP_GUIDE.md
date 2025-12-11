# Cron Job Setup Guide for YouTube Live Auto-Detection

This guide explains how to set up automatic YouTube live stream detection for your attendance system. The cron job will automatically check for live streams and start attendance tracking.

## Your API Endpoint

Your cron job needs to call this URL:

**Development URL:**
```
https://456ecae8-faeb-4f91-aad6-c0a85f1cfe6e-00-roc162rigiqa.worf.replit.dev/api/cron/youtube-check
```

**After Publishing (Production URL):**
```
https://your-app-name.replit.app/api/cron/youtube-check
```

**Method:** `GET`

---

## Option 1: cron-job.org (Recommended - Best Free Option)

**Why this is recommended:**
- Unlimited free cron jobs
- Can run every 1 minute
- 30-second timeout (plenty for API calls)
- Completely free (donation-funded)

### Step-by-Step Setup:

1. **Go to** [https://cron-job.org](https://cron-job.org/en/)

2. **Create a free account** (click "Sign Up" or "Register")

3. **Verify your email** address

4. **Log in** to your dashboard

5. **Click "CREATE CRONJOB"** (green button)

6. **Fill in the form:**

   | Field | Value |
   |-------|-------|
   | **Title** | YouTube Live Check |
   | **URL** | `https://your-app-url/api/cron/youtube-check` |
   | **Schedule** | Choose your preferred schedule (see recommendations below) |
   | **Request Method** | GET |
   | **Enabled** | Yes (toggle on) |

7. **Click "CREATE"** to save

### Recommended Schedule Settings:

For checking during your service time window (e.g., Monday 3-5 PM London time):

- **Days of week:** Select only "Monday" (or your service day)
- **Hours:** Select 15, 16, 17 (3 PM to 5 PM)
- **Minutes:** Select 0, 5, 10, 15... (every 5 minutes)

Or use a cron expression:
```
*/5 15-17 * * 1
```
This means: Every 5 minutes, between 3-5 PM, on Mondays only.

**Important:** Set the timezone to "Europe/London" in the settings!

---

## Option 2: FastCron (More Reliable)

**Free tier limits:**
- 5 cron jobs
- Minimum 5-minute intervals
- More reliable timing (no random delays)

### Step-by-Step Setup:

1. **Go to** [https://www.fastcron.com](https://www.fastcron.com/)

2. **Sign up** for a free account

3. **Click "Add cronjob"**

4. **Configure:**
   - **URL:** Your API endpoint
   - **When to call:** Set your schedule
   - **Timezone:** Europe/London

5. **Save** the cron job

---

## Option 3: EasyCron (Simple)

**Free tier limits:**
- 200 executions per day
- Minimum 20-minute intervals
- 5-second timeout (might be too short)

### Setup:

1. **Go to** [https://www.easycron.com](https://www.easycron.com/)
2. **Create account**
3. **Add new cron job** with your URL
4. Set schedule and timezone

---

## Option 4: Replit Scheduled Deployments (Paid)

If you prefer keeping everything in Replit:

1. **Open the Publishing tool** (left sidebar > All tools > Publishing)
2. **Select "Scheduled"** deployment type
3. **Configure:**
   - **Schedule:** "Every Monday at 3 PM" or use cron: `0 15 * * 1`
   - **Build Command:** `npm install`
   - **Run Command:** `curl https://your-app-url/api/cron/youtube-check`
4. **Deploy**

Note: This uses Replit credits based on compute time.

---

## How the Cron Job Works

When the cron endpoint is called, it will:

1. **Check if it's the scheduled day** (configured in Admin Dashboard)
2. **Check if it's within the time window** (e.g., 3-5 PM London time)
3. **Check the interval** (respects the configured check interval to save API quota)
4. **Search for live streams** on your YouTube channel
5. **If a live stream is found:**
   - Automatically updates the stream URL
   - Starts attendance tracking
   - Sets auto-stop timer based on configured duration

---

## Testing Your Cron Job

You can test the endpoint manually:

```bash
curl https://your-app-url/api/cron/youtube-check
```

**Expected responses:**

- **Outside scheduled day:**
  ```json
  {"message":"Not scheduled day. Current: Thursday, Scheduled: Monday","action":"skipped"}
  ```

- **Outside time window:**
  ```json
  {"message":"Outside check window. Current: 10:30, Window: 15:00 - 17:00","action":"skipped"}
  ```

- **Live stream found:**
  ```json
  {"message":"Live stream detected and attendance started!","action":"live_detected","videoId":"..."}
  ```

- **No live stream:**
  ```json
  {"message":"No live stream found","action":"no_live"}
  ```

---

## Quick Comparison Table

| Service | Free Jobs | Min Interval | Timeout | Best For |
|---------|-----------|--------------|---------|----------|
| **cron-job.org** | Unlimited | 1 minute | 30s | Most flexible |
| **FastCron** | 5 | 5 minutes | 30s | Reliability |
| **EasyCron** | 200/day | 20 minutes | 5s | Simple needs |
| **Replit Scheduled** | N/A | 1 minute | Custom | All-in-one |

---

## My Recommendation

**Use cron-job.org** because:
- Completely free with unlimited jobs
- Can check every minute during your service window
- Easy to set up
- No credit card required

Set it to check every 5 minutes during your service time window (e.g., 3-5 PM on Mondays). This balances YouTube API quota usage with quick live stream detection.

---

## Admin Dashboard Settings

Make sure to configure these in your Admin Dashboard before setting up the cron job:

1. **YouTube Channel ID** - Your channel's ID (starts with UC...)
2. **Check Day** - The day of your service (e.g., Monday)
3. **Check Start Time** - When to start looking (e.g., 15:00)
4. **Check End Time** - When to stop looking (e.g., 17:00)
5. **Auto Attendance Duration** - How long attendance stays active (e.g., 4 hours)
6. **Check Interval** - Minutes between API checks (e.g., 5 minutes)

All times are in **London timezone (Europe/London)**.
