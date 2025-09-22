import { createClient } from '@/lib/supabase/server'

/**
 * Upload a logo file to public storage
 * @param file - The file to upload
 * @param organizationId - The organization ID (UUID)
 * @returns Promise<string> - The public URL of the uploaded file
 */
export async function uploadLogo(file: File, organizationId: string): Promise<string> {
  const supabase = await createClient()

  // Generate unique filename with timestamp to ensure fresh upload
  const fileExt = file.name.split('.').pop()
  const timestamp = Date.now()
  const fileName = `logo-${timestamp}.${fileExt}`
  const filePath = `${organizationId}/${fileName}`

  // Upload file to public logos bucket (unique filename ensures no conflicts)
  const { data, error } = await supabase.storage
    .from('logos')
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type // Ensure proper content type
    })


  if (error) {
    console.error('Storage upload error:', error)
    throw new Error(`Upload failed: ${error.message}`)
  }

  // Return the public URL for the uploaded file
  const { data: publicUrl } = supabase.storage
    .from('logos')
    .getPublicUrl(filePath)


  return publicUrl.publicUrl
}
