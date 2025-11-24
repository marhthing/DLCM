import { google } from 'googleapis';
import type { AttendanceRecord, InsertAttendanceRecord, StreamSettings, InsertStreamSettings } from "@shared/schema";
import { randomUUID } from "crypto";
import type { IStorage } from "./storage";

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

async function getUncachableGoogleSheetClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

export class GoogleSheetsStorage implements IStorage {
  private spreadsheetId: string;
  private attendanceSheetName = 'Attendance Records';
  private settingsSheetName = 'Stream Settings';
  private initPromise: Promise<void>;

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || '';
    
    if (!this.spreadsheetId) {
      console.error('❌ Missing GOOGLE_SPREADSHEET_ID environment variable!');
      console.error('Please add GOOGLE_SPREADSHEET_ID to your environment variables.');
      console.error('This should be the ID from your Google Sheet URL.');
      throw new Error('Missing required GOOGLE_SPREADSHEET_ID environment variable.');
    }

    this.initPromise = this.initializeSheets();
  }

  private async initializeSheets(): Promise<void> {
    try {
      const sheets = await getUncachableGoogleSheetClient();
      
      // Get existing sheets
      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const existingSheets = response.data.sheets?.map(s => s.properties?.title) || [];

      // Create Attendance Records sheet if it doesn't exist
      if (!existingSheets.includes(this.attendanceSheetName)) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: this.attendanceSheetName,
                  },
                },
              },
            ],
          },
        });

        // Add headers
        await sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.attendanceSheetName}!A1:G1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['ID', 'Name', 'Email', 'Start Time', 'End Time', 'Duration (seconds)', 'Timestamp']],
          },
        });
      }

      // Create Stream Settings sheet if it doesn't exist
      if (!existingSheets.includes(this.settingsSheetName)) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: this.settingsSheetName,
                  },
                },
              },
            ],
          },
        });

        // Add headers
        await sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.settingsSheetName}!A1:C1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['ID', 'YouTube URL', 'Updated At']],
          },
        });
      }
    } catch (error) {
      console.error('Error initializing Google Sheets:', error);
    }
  }

  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    await this.initPromise;
    try {
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.attendanceSheetName}!A2:G`,
      });

      const rows = response.data.values || [];
      
      return rows.map(row => ({
        id: row[0] || '',
        name: row[1] || '',
        email: row[2] || '',
        startTime: row[3] || '',
        endTime: row[4] || '',
        durationSeconds: parseInt(row[5] || '0', 10),
        timestamp: row[6] || '',
      })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      return [];
    }
  }

  async createAttendanceRecord(insertRecord: InsertAttendanceRecord): Promise<AttendanceRecord> {
    await this.initPromise;
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    
    const record: AttendanceRecord = {
      id,
      name: insertRecord.name,
      email: insertRecord.email,
      startTime: insertRecord.startTime,
      endTime: insertRecord.endTime,
      durationSeconds: insertRecord.durationSeconds,
      timestamp,
    };

    try {
      const sheets = await getUncachableGoogleSheetClient();
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.attendanceSheetName}!A2:G`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            record.id,
            record.name,
            record.email,
            record.startTime,
            record.endTime || '',
            record.durationSeconds,
            record.timestamp,
          ]],
        },
      });

      return record;
    } catch (error) {
      console.error('Error creating attendance record:', error);
      throw new Error('Failed to create attendance record');
    }
  }

  async getStreamSettings(): Promise<StreamSettings | undefined> {
    await this.initPromise;
    try {
      const sheets = await getUncachableGoogleSheetClient();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.settingsSheetName}!A2:C2`,
      });

      const rows = response.data.values || [];
      
      if (rows.length === 0) {
        return undefined;
      }

      const row = rows[0];
      return {
        id: row[0] || '',
        youtubeUrl: row[1] || '',
        updatedAt: row[2] || '',
      };
    } catch (error) {
      console.error('Error fetching stream settings:', error);
      return undefined;
    }
  }

  async updateStreamSettings(insertSettings: InsertStreamSettings): Promise<StreamSettings> {
    await this.initPromise;
    const existingSettings = await this.getStreamSettings();
    const id = existingSettings?.id || randomUUID();
    const updatedAt = new Date().toISOString();

    const settings: StreamSettings = {
      id,
      youtubeUrl: insertSettings.youtubeUrl,
      updatedAt,
    };

    try {
      const sheets = await getUncachableGoogleSheetClient();
      
      // Update or create the first row of settings
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${this.settingsSheetName}!A2:C2`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            settings.id,
            settings.youtubeUrl,
            settings.updatedAt,
          ]],
        },
      });

      return settings;
    } catch (error) {
      console.error('Error updating stream settings:', error);
      throw new Error('Failed to update stream settings');
    }
  }
}
