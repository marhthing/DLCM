import { createClient } from '@supabase/supabase-js';
import type { AttendanceRecord, InsertAttendanceRecord, StreamSettings, InsertStreamSettings } from "@/shared/schema";
import { randomUUID } from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Secrets.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export class SupabaseStorage {
  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching attendance records:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    return data.map(record => ({
      id: record.id,
      name: record.name,
      email: record.email,
      branch: record.branch || 'Pontypridd',
      streamSessionId: record.stream_session_id,
      streamTitle: record.stream_title || 'Live Service',
      startTime: record.start_time,
      endTime: record.end_time || null,
      lastSeenAt: record.last_seen_at,
      durationSeconds: record.duration_seconds || 0,
      timestamp: record.timestamp,
    }));
  }

  async createAttendanceRecord(insertRecord: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const lastSeenAt = insertRecord.endTime || new Date().toISOString();

    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        id,
        name: insertRecord.name,
        email: insertRecord.email,
        stream_session_id: insertRecord.streamSessionId,
        stream_title: insertRecord.streamTitle,
        start_time: insertRecord.startTime,
        end_time: insertRecord.endTime,
        last_seen_at: lastSeenAt,
        duration_seconds: insertRecord.durationSeconds,
        timestamp,
      })
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
      streamSessionId: data.stream_session_id,
      streamTitle: data.stream_title,
      startTime: data.start_time,
      endTime: data.end_time,
      lastSeenAt: data.last_seen_at,
      durationSeconds: data.duration_seconds,
      timestamp: data.timestamp,
    };
  }

  async upsertAttendanceRecord(
    email: string,
    streamSessionId: string,
    data: { name: string; branch: string; streamTitle: string; startTime: string; durationSeconds: number }
  ): Promise<AttendanceRecord> {
    // Try to find existing record for this email, session, AND branch
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('email', email)
      .eq('stream_session_id', streamSessionId)
      .eq('branch', data.branch)
      .single();

    const lastSeenAt = new Date().toISOString();

    if (existing) {
      // Update existing record
      const { data: updated, error } = await supabase
        .from('attendance_records')
        .update({
          name: data.name,
          stream_title: data.streamTitle,
          duration_seconds: data.durationSeconds,
          last_seen_at: lastSeenAt,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating attendance record:', error);
        throw error;
      }

      return {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        branch: updated.branch || 'Pontypridd',
        streamSessionId: updated.stream_session_id,
        streamTitle: updated.stream_title,
        startTime: updated.start_time,
        endTime: updated.end_time,
        lastSeenAt: updated.last_seen_at,
        durationSeconds: updated.duration_seconds,
        timestamp: updated.timestamp,
      };
    }

    // Create new record
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    const { data: created, error } = await supabase
      .from('attendance_records')
      .insert({
        id,
        name: data.name,
        email,
        branch: data.branch,
        stream_session_id: streamSessionId,
        stream_title: data.streamTitle,
        start_time: data.startTime,
        last_seen_at: lastSeenAt,
        duration_seconds: data.durationSeconds,
        timestamp,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating attendance record:', error);
      throw error;
    }

    return {
      id: created.id,
      name: created.name,
      email: created.email,
      branch: created.branch || 'Pontypridd',
      streamSessionId: created.stream_session_id,
      streamTitle: created.stream_title,
      startTime: created.start_time,
      endTime: created.end_time,
      lastSeenAt: created.last_seen_at,
      durationSeconds: created.duration_seconds,
      timestamp: created.timestamp,
    };
  }

  async getStreamSettings(): Promise<StreamSettings | undefined> {
    const { data, error } = await supabase
      .from('stream_settings')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching stream settings:', error);
      return undefined;
    }

    if (!data) {
      return undefined;
    }

    return {
      id: data.id,
      youtubeUrl: data.youtube_url,
      isAttendanceActive: data.is_attendance_active || 'false',
      updatedAt: data.updated_at,
    };
  }

  async toggleAttendance(isActive: boolean): Promise<StreamSettings | undefined> {
    const settings = await this.getStreamSettings();

    if (!settings) {
      return undefined;
    }

    const { data, error } = await supabase
      .from('stream_settings')
      .update({
        is_attendance_active: isActive ? 'true' : 'false',
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
      .select()
      .single();

    if (error) {
      console.error('Error toggling attendance:', error);
      return undefined;
    }

    return {
      id: data.id,
      youtubeUrl: data.youtube_url,
      isAttendanceActive: data.is_attendance_active || 'false',
      updatedAt: data.updated_at,
    };
  }

  async updateStreamSettings(insertSettings: InsertStreamSettings): Promise<StreamSettings> {
    const existing = await this.getStreamSettings();
    const id = existing?.id || randomUUID();
    const updatedAt = new Date().toISOString();

    // Fix for YouTube URL parsing
    let youtubeUrl = insertSettings.youtubeUrl;
    if (youtubeUrl && youtubeUrl.includes('/live/')) {
        const videoId = youtubeUrl.split('/live/')[1].split('?')[0];
        youtubeUrl = `https://www.youtube.com/embed/${videoId}`;
    }

    const { data, error } = await supabase
      .from('stream_settings')
      .upsert({
        id,
        youtube_url: youtubeUrl, // Use the corrected URL
        updated_at: updatedAt,
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating stream settings:', error);
      throw new Error('Failed to update stream settings');
    }

    return {
      id: data.id,
      youtubeUrl: data.youtube_url,
      isAttendanceActive: data.is_attendance_active || 'false',
      updatedAt: data.updated_at,
    };
  }

  async getActiveViewersCount(timeoutMs: number = 120000, branch?: string): Promise<number> {
    const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();
    
    let query = supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen_at', cutoffTime);
    
    if (branch) {
      query = query.eq('branch', branch);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error getting active viewers count:', error);
      return 0;
    }

    return count || 0;
  }

  async getAttendanceRecordsByBranch(branch: string): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('branch', branch)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching attendance records by branch:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    return data.map(record => ({
      id: record.id,
      name: record.name,
      email: record.email,
      branch: record.branch || 'Pontypridd',
      streamSessionId: record.stream_session_id,
      streamTitle: record.stream_title || 'Live Service',
      startTime: record.start_time,
      endTime: record.end_time || null,
      lastSeenAt: record.last_seen_at,
      durationSeconds: record.duration_seconds || 0,
      timestamp: record.timestamp,
    }));
  }
}