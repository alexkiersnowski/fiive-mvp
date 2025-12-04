import { redirect } from "next/navigation"
import { getActiveContext } from '@/lib/mode/getActiveContext'

export default async function Home() {
  // Check if user is authenticated with an active organization session
  const context = await getActiveContext()
  
  // Redirect authenticated users to /home, unauthenticated users to /signin
  if (context) {
    redirect('/home')
  } else {
    redirect('/signin')
  }
}
