import type { AttendanceRecord, InsertAttendanceRecord, StreamSettings, InsertStreamSettings } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Attendance Records
  getAttendanceRecords(): Promise<AttendanceRecord[]>;
  createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  upsertAttendanceRecord(email: string, streamSessionId: string, data: { name: string; streamTitle: string; startTime: string; durationSeconds: number }): Promise<AttendanceRecord>;

  // Stream Settings
  getStreamSettings(): Promise<StreamSettings | undefined>;
  updateStreamSettings(settings: InsertStreamSettings): Promise<StreamSettings>;
}

export class MemStorage implements IStorage {
  private attendanceRecords: Map<string, AttendanceRecord>;
  private streamSettings: StreamSettings | undefined;

  constructor() {
    this.attendanceRecords = new Map();
    // Initialize with empty settings - admin will configure
    this.streamSettings = undefined;
  }

  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    return Array.from(this.attendanceRecords.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async createAttendanceRecord(insertRecord: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const id = randomUUID();
    const record: AttendanceRecord = {
      ...insertRecord,
      id,
      lastSeenAt: insertRecord.endTime || new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };
    this.attendanceRecords.set(id, record);
    return record;
  }

  async upsertAttendanceRecord(email: string, streamSessionId: string, data: { name: string; streamTitle: string; startTime: string; durationSeconds: number }): Promise<AttendanceRecord> {
    // Find existing record for this email and stream session
    const existing = Array.from(this.attendanceRecords.values()).find(
      r => r.email === email && r.streamSessionId === streamSessionId
    );

    if (existing) {
      // Update existing record
      const updated: AttendanceRecord = {
        ...existing,
        name: data.name,
        streamTitle: data.streamTitle,
        durationSeconds: data.durationSeconds,
        lastSeenAt: new Date().toISOString(),
      };
      this.attendanceRecords.set(existing.id, updated);
      return updated;
    }

    // Create new record
    const id = randomUUID();
    const record: AttendanceRecord = {
      id,
      name: data.name,
      email,
      streamSessionId,
      streamTitle: data.streamTitle,
      startTime: data.startTime,
      endTime: undefined,
      lastSeenAt: new Date().toISOString(),
      durationSeconds: data.durationSeconds,
      timestamp: new Date().toISOString(),
    };
    this.attendanceRecords.set(id, record);
    return record;
  }

  async getStreamSettings(): Promise<StreamSettings | undefined> {
    return this.streamSettings;
  }

  async updateStreamSettings(insertSettings: InsertStreamSettings): Promise<StreamSettings> {
    const settings: StreamSettings = {
      id: this.streamSettings?.id || randomUUID(),
      ...insertSettings,
      updatedAt: new Date().toISOString(),
    };
    this.streamSettings = settings;
    return settings;
  }
}

import { GoogleSheetsStorage } from "./google-sheets-storage";

// Using Google Sheets storage
// Make sure GOOGLE_SPREADSHEET_ID is set in environment variables
export const storage = new GoogleSheetsStorage();