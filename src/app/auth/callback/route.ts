import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // TODO: Handle magic link callback
  // This will be implemented when we add Supabase auth
  return NextResponse.redirect('/user-details')
}
