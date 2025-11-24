import type { AttendanceRecord, InsertAttendanceRecord, StreamSettings, InsertStreamSettings } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Attendance Records
  getAttendanceRecords(): Promise<AttendanceRecord[]>;
  createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  
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

export const storage = new MemStorage();
