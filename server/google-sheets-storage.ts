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
          range: `${this.attendanceSheetName}!A1:I1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['ID', 'Name', 'Email', 'Stream Session ID', 'Start Time', 'End Time', 'Last Seen At', 'Duration (seconds)', 'Timestamp']],
          },
        });
      } else {
        // Check if we need to migrate from old schema (7 columns) to new schema (9 columns)
        const headerResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.attendanceSheetName}!A1:I1`,
        });

        const headers = headerResponse.data.values?.[0] || [];
        
        // If we have old 7-column format, migrate to new 9-column format
        if (headers.length === 7 && !headers.includes('Stream Session ID')) {
          console.log('Migrating Attendance Records sheet from old schema to new schema...');
          
          // Update headers
          await sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${this.attendanceSheetName}!A1:I1`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [['ID', 'Name', 'Email', 'Stream Session ID', 'Start Time', 'End Time', 'Last Seen At', 'Duration (seconds)', 'Timestamp']],
            },
          });

          // Get all existing data rows
          const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${this.attendanceSheetName}!A2:G`,
          });

          const oldRows = dataResponse.data.values || [];
          
          if (oldRows.length > 0) {
            // Migrate each row: backfill streamSessionId with a unique identifier to prevent collisions
            const migratedRows = oldRows.map((row, index) => {
              // Use row ID if available, otherwise use row index for truly unique legacy session ID
              const rowId = row[0] || `row${index}`;
              const legacySessionId = `legacy-${rowId}`;
              
              return [
                row[0] || '', // ID
                row[1] || '', // Name
                row[2] || '', // Email
                legacySessionId, // Stream Session ID (backfilled with unique legacy placeholder)
                row[3] || '', // Start Time
                row[4] || '', // End Time
                row[4] || new Date().toISOString(), // Last Seen At (use endTime or now)
                row[5] || '0', // Duration (seconds)
                row[6] || '', // Timestamp
              ];
            });

            // Write migrated data back
            await sheets.spreadsheets.values.update({
              spreadsheetId: this.spreadsheetId,
              range: `${this.attendanceSheetName}!A2:I${oldRows.length + 1}`,
              valueInputOption: 'RAW',
              requestBody: {
                values: migratedRows,
              },
            });

            console.log(`Migrated ${oldRows.length} attendance records to new schema.`);
          }
        }
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
        range: `${this.attendanceSheetName}!A2:I`,
      });

      const rows = response.data.values || [];
      
      return rows.map(row => ({
        id: row[0] || '',
        name: row[1] || '',
        email: row[2] || '',
        streamSessionId: row[3] || '',
        startTime: row[4] || '',
        endTime: row[5] || '',
        lastSeenAt: row[6] || '',
        durationSeconds: parseInt(row[7] || '0', 10),
        timestamp: row[8] || '',
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
    const lastSeenAt = insertRecord.endTime || new Date().toISOString();
    
    const record: AttendanceRecord = {
      id,
      name: insertRecord.name,
      email: insertRecord.email,
      streamSessionId: insertRecord.streamSessionId,
      startTime: insertRecord.startTime,
      endTime: insertRecord.endTime,
      lastSeenAt,
      durationSeconds: insertRecord.durationSeconds,
      timestamp,
    };

    try {
      const sheets = await getUncachableGoogleSheetClient();
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.attendanceSheetName}!A2:I`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            record.id,
            record.name,
            record.email,
            record.streamSessionId,
            record.startTime,
            record.endTime || '',
            record.lastSeenAt,
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

  async upsertAttendanceRecord(email: string, streamSessionId: string, data: { name: string; startTime: string; durationSeconds: number }): Promise<AttendanceRecord> {
    await this.initPromise;
    
    try {
      const sheets = await getUncachableGoogleSheetClient();
      
      // Fetch all records to find existing one
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.attendanceSheetName}!A2:I`,
      });

      const rows = response.data.values || [];
      let existingRowIndex = -1;
      let existingRecord: AttendanceRecord | null = null;

      // Find existing record by email + streamSessionId
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row[2] === email && row[3] === streamSessionId) {
          existingRowIndex = i + 2; // +2 because sheet rows are 1-indexed and we start from row 2
          existingRecord = {
            id: row[0] || '',
            name: row[1] || '',
            email: row[2] || '',
            streamSessionId: row[3] || '',
            startTime: row[4] || '',
            endTime: row[5] || '',
            lastSeenAt: row[6] || '',
            durationSeconds: parseInt(row[7] || '0', 10),
            timestamp: row[8] || '',
          };
          break;
        }
      }

      // No legacy fallback - only match by exact streamSessionId
      // Legacy records are preserved as historical data with their own unique streamSessionId

      if (existingRecord && existingRowIndex > 0) {
        // Update existing record
        const lastSeenAt = new Date().toISOString();
        const updated: AttendanceRecord = {
          ...existingRecord,
          name: data.name,
          durationSeconds: data.durationSeconds,
          lastSeenAt,
        };

        await sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.attendanceSheetName}!A${existingRowIndex}:I${existingRowIndex}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[
              updated.id,
              updated.name,
              updated.email,
              updated.streamSessionId,
              updated.startTime,
              updated.endTime || '',
              updated.lastSeenAt,
              updated.durationSeconds,
              updated.timestamp,
            ]],
          },
        });

        return updated;
      }

      // Create new record
      const id = randomUUID();
      const timestamp = new Date().toISOString();
      const lastSeenAt = new Date().toISOString();

      const record: AttendanceRecord = {
        id,
        name: data.name,
        email,
        streamSessionId,
        startTime: data.startTime,
        endTime: undefined,
        lastSeenAt,
        durationSeconds: data.durationSeconds,
        timestamp,
      };

      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.attendanceSheetName}!A2:I`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            record.id,
            record.name,
            record.email,
            record.streamSessionId,
            record.startTime,
            record.endTime || '',
            record.lastSeenAt,
            record.durationSeconds,
            record.timestamp,
          ]],
        },
      });

      return record;
    } catch (error) {
      console.error('Error upserting attendance record:', error);
      throw new Error('Failed to upsert attendance record');
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
