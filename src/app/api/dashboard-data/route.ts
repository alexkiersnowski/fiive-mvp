import { getDashboardData } from '@/lib/supabase/dashboard-data'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const data = await getDashboardData()
    
    if (!data) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
