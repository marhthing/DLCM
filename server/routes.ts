import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAttendanceRecordSchema, heartbeatAttendanceSchema, youtubeUrlUpdateSchema, adminLoginSchema } from "@shared/schema";

const ADMIN_PASSWORD = "admin123";

// Track active viewers (email -> last heartbeat timestamp)
const activeViewers = new Map<string, number>();
const VIEWER_TIMEOUT_MS = 60000; // 1 minute timeout

export async function registerRoutes(app: Express): Promise<Server> {
  // Get stream settings
  app.get("/api/stream/settings", async (_req, res) => {
    try {
      const settings = await storage.getStreamSettings();
      if (!settings) {
        return res.status(404).json({ message: "Stream settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update stream settings
  app.put("/api/stream/settings", async (req, res) => {
    try {
      const result = youtubeUrlUpdateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid request", errors: result.error.errors });
      }

      const settings = await storage.updateStreamSettings({ youtubeUrl: result.data.url });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all attendance records
  app.get("/api/attendance/records", async (_req, res) => {
    try {
      const records = await storage.getAttendanceRecords();
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Record attendance
  app.post("/api/attendance/record", async (req, res) => {
    try {
      const result = insertAttendanceRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid request", errors: result.error.errors });
      }

      const record = await storage.createAttendanceRecord(result.data);
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Heartbeat for updating attendance
  app.post("/api/attendance/heartbeat", async (req, res) => {
    try {
      const result = heartbeatAttendanceSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid request", errors: result.error.errors });
      }

      const { email, streamSessionId, name, startTime, durationSeconds } = result.data;
      
      // Update active viewers
      activeViewers.set(email, Date.now());
      
      const record = await storage.upsertAttendanceRecord(email, streamSessionId, {
        name,
        startTime,
        durationSeconds,
      });

      res.json(record);
    } catch (error) {
      console.error('Heartbeat error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get active viewers count
  app.get("/api/attendance/active-count", async (_req, res) => {
    try {
      const now = Date.now();
      // Remove stale viewers (no heartbeat in last minute)
      for (const [email, lastSeen] of activeViewers.entries()) {
        if (now - lastSeen > VIEWER_TIMEOUT_MS) {
          activeViewers.delete(email);
        }
      }
      
      res.json({ count: activeViewers.size });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin login
  app.post("/api/admin/login", async (req, res) => {
    try {
      const result = adminLoginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid request", errors: result.error.errors });
      }

      if (result.data.password === ADMIN_PASSWORD) {
        res.json({ success: true });
      } else {
        res.status(401).json({ message: "Incorrect password" });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
