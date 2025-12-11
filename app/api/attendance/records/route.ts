import { NextResponse } from 'next/server'
import { SupabaseStorage } from '@/lib/supabase-storage'

const storage = new SupabaseStorage()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get('branch')
    
    // console.log('Fetching attendance records...', branch ? `for branch: ${branch}` : 'all branches')
    
    let records
    if (branch) {
      records = await storage.getAttendanceRecordsByBranch(branch)
    } else {
      records = await storage.getAttendanceRecords()
    }
    
    // console.log(`Found ${records.length} attendance records`)
    return NextResponse.json(records)
  } catch (error) {
    console.error('Get attendance records error:', error)
    return NextResponse.json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
