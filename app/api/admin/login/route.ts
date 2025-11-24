import { NextResponse } from 'next/server'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { password } = body
    
    if (password === ADMIN_PASSWORD) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ message: 'Incorrect password' }, { status: 401 })
    }
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
