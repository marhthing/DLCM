
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AttendanceRecord, InsertAttendanceRecord, StreamSettings, InsertStreamSettings } from "@shared/schema";
import { randomUUID } from "crypto";
import type { IStorage } from "./storage";

const SUPABASE_URL = "https://ubkfowniejcaxrmgsujh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVia2Zvd25pZWpjYXhybWdzdWpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMTg2NzAsImV4cCI6MjA3ODY5NDY3MH0.MG0rNqksB0NX8cqleP_AGorB04c-2REjVyfO_O-FHiw";

export class SupabaseStorage implements IStorage {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    this.initializeTables();
  }

  private async initializeTables() {
    try {
      // Create attendance_records table if not exists
      const { error: attendanceError } = await this.supabase.rpc('create_attendance_table', {});
      
      // Create stream_settings table if not exists
      const { error: settingsError } = await this.supabase.rpc('create_stream_settings_table', {});

      // If RPC doesn't exist, we'll create tables using raw SQL
      // Check if tables exist by trying to select from them
      const { error: checkAttendance } = await this.supabase
        .from('attendance_records')
        .select('id')
        .limit(1);

      const { error: checkSettings } = await this.supabase
        .from('stream_settings')
        .select('id')
        .limit(1);

      if (checkAttendance || checkSettings) {
        console.log('Note: Please create the following tables in Supabase SQL Editor:');
        console.log(`
CREATE TABLE IF NOT EXISTS attendance_records (
  id VARCHAR PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stream_settings (
  id VARCHAR PRIMARY KEY,
  youtube_url TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
        `);
      }
    } catch (error) {
      console.error('Error initializing tables:', error);
    }
  }

  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    const { data, error } = await this.supabase
      .from('attendance_records')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching attendance records:', error);
      return [];
    }

    return data.map(record => ({
      id: record.id,
      name: record.name,
      email: record.email,
      startTime: record.start_time,
      endTime: record.end_time,
      durationSeconds: record.duration_seconds,
      timestamp: record.timestamp,
    }));
  }

  async createAttendanceRecord(insertRecord: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    
    const record = {
      id,
      name: insertRecord.name,
      email: insertRecord.email,
      start_time: insertRecord.startTime,
      end_time: insertRecord.endTime,
      duration_seconds: insertRecord.durationSeconds,
      timestamp,
    };

    const { data, error } = await this.supabase
      .from('attendance_records')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Error creating attendance record:', error);
      throw new Error('Failed to create attendance record');
    }

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      startTime: data.start_time,
      endTime: data.end_time,
      durationSeconds: data.duration_seconds,
      timestamp: data.timestamp,
    };
  }

  async getStreamSettings(): Promise<StreamSettings | undefined> {
    const { data, error } = await this.supabase
      .from('stream_settings')
      .select('*')
      .limit(1)
      .single();

    if (error || !data) {
      return undefined;
    }

    return {
      id: data.id,
      youtubeUrl: data.youtube_url,
      updatedAt: data.updated_at,
    };
  }

  async updateStreamSettings(insertSettings: InsertStreamSettings): Promise<StreamSettings> {
    const existingSettings = await this.getStreamSettings();
    const id = existingSettings?.id || randomUUID();
    const updatedAt = new Date().toISOString();

    const settings = {
      id,
      youtube_url: insertSettings.youtubeUrl,
      updated_at: updatedAt,
    };

    const { data, error } = await this.supabase
      .from('stream_settings')
      .upsert(settings, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating stream settings:', error);
      throw new Error('Failed to update stream settings');
    }

    return {
      id: data.id,
      youtubeUrl: data.youtube_url,
      updatedAt: data.updated_at,
    };
  }
}
