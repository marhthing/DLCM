import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  branch: text("branch").notNull().default("Pontypridd"),
  streamSessionId: text("stream_session_id").notNull(),
  streamTitle: text("stream_title").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  lastSeenAt: text("last_seen_at").notNull(),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  timestamp: text("timestamp").notNull(),
});

export const streamSettings = pgTable("stream_settings", {
  id: varchar("id").primaryKey(),
  youtubeUrl: text("youtube_url").notNull(),
  isAttendanceActive: text("is_attendance_active").notNull().default("false"),
  updatedAt: text("updated_at").notNull(),
  youtubeChannelId: text("youtube_channel_id").default(""),
  checkDay: text("check_day").default("Monday"),
  checkStartTime: text("check_start_time").default("15:00"),
  checkEndTime: text("check_end_time").default("17:00"),
  autoAttendanceDurationHours: integer("auto_attendance_duration_hours").default(4),
  lastLiveCheckDate: text("last_live_check_date").default(""),
  autoDetectedUrl: text("auto_detected_url").default(""),
  attendanceAutoStopAt: text("attendance_auto_stop_at"),
  checkIntervalMinutes: integer("check_interval_minutes").default(5),
  lastApiCheckTime: text("last_api_check_time"),
});

export const insertAttendanceRecordSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  branch: z.string().min(1),
  streamSessionId: z.string().min(1),
  streamTitle: z.string().min(1),
  startTime: z.string(),
  endTime: z.string().optional(),
  durationSeconds: z.number().int().min(0),
});

export const heartbeatAttendanceSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  branch: z.string().min(1),
  streamSessionId: z.string().min(1),
  streamTitle: z.string().min(1),
  startTime: z.string(),
  durationSeconds: z.number().int().min(0),
});

export const insertStreamSettingsSchema = z.object({
  youtubeUrl: z.string().optional(),
  youtubeChannelId: z.string().optional(),
  checkDay: z.string().optional(),
  checkStartTime: z.string().optional(),
  checkEndTime: z.string().optional(),
  autoAttendanceDurationHours: z.number().optional(),
  lastLiveCheckDate: z.string().optional(),
  autoDetectedUrl: z.string().optional(),
  attendanceAutoStopAt: z.string().optional(),
  checkIntervalMinutes: z.number().optional(),
  lastApiCheckTime: z.string().optional(),
});

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type HeartbeatAttendance = z.infer<typeof heartbeatAttendanceSchema>;
export type StreamSettings = typeof streamSettings.$inferSelect;
export type InsertStreamSettings = z.infer<typeof insertStreamSettingsSchema>;

// Viewer session schema (for tracking active sessions)
export const viewerSessionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  branch: z.string().min(1, "Branch is required"),
});

// Available branches
export const BRANCHES = [
  "Pontypridd",
  "Cardiff",
  "Newport",
  "Swansea"
] as const;

export type Branch = typeof BRANCHES[number];

export type ViewerSession = z.infer<typeof viewerSessionSchema>;

// Admin login schema
export const adminLoginSchema = z.object({
  branch: z.string().min(1, "Branch is required"),
  password: z.string().min(1, "Password is required"),
});

export type AdminLogin = z.infer<typeof adminLoginSchema>;

// YouTube URL update schema
export const youtubeUrlUpdateSchema = z.object({
  url: z.string().min(1, "YouTube URL is required"),
});

export type YoutubeUrlUpdate = z.infer<typeof youtubeUrlUpdateSchema>;
