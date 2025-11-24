import { NextResponse } from 'next/server'
import { GoogleSheetsStorage } from '@/lib/google-sheets-storage'

const storage = new GoogleSheetsStorage()

export async function GET() {
  try {
    const records = await storage.getAttendanceRecords()
    return NextResponse.json(records)
  } catch (error) {
    console.error('Get attendance records error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
