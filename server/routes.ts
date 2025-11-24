import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAttendanceRecordSchema, youtubeUrlUpdateSchema, adminLoginSchema } from "@shared/schema";

const ADMIN_PASSWORD = "admin123";

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
