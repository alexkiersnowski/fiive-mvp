"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from '@/lib/supabase/server'

const ProfileSchema = z.object({
  userId: z.string().uuid(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  job_title: z.string().optional(),
})

export async function updateProfile(data: {
  userId: string
  first_name: string
  last_name: string
  job_title?: string
}) {
  // Validate input data
  const parsed = ProfileSchema.safeParse(data)
  if (!parsed.success) {
    return { 
      ok: false, 
      errors: parsed.error.flatten().fieldErrors 
    }
  }

  const { userId, ...values } = parsed.data

  const supabase = await createClient()

  // Verify the user is authenticated and matches the userId
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user || user.id !== userId) {
    return { 
      ok: false, 
      message: "Unauthorized" 
    }
  }

  // Update the profile
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: values.first_name,
      last_name: values.last_name,
      job_title: values.job_title,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId)

  if (error) {
    console.error('Profile update error:', error)
    return { 
      ok: false, 
      message: error.message 
    }
  }

  // Revalidate the profile page to show fresh data
  revalidatePath("/settings/account/profile")
  
  return { ok: true }
}
