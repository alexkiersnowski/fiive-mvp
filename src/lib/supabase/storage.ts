import { createClient } from '@/app/utils/supabase/server'

/**
 * Upload a logo file to public storage
 * @param file - The file to upload
 * @param organizationId - The organization ID (UUID)
 * @returns Promise<string> - The public URL of the uploaded file
 */
export async function uploadLogo(file: File, organizationId: string): Promise<string> {
  const supabase = await createClient()

  // Test Supabase client connection
  console.log('Supabase client created:', !!supabase)
  
  // Generate unique filename with timestamp to ensure fresh upload
  const fileExt = file.name.split('.').pop()
  const timestamp = Date.now()
  const fileName = `logo-${timestamp}.${fileExt}`
  const filePath = `${organizationId}/${fileName}`

  console.log('Storage upload attempt:', { fileName, filePath, organizationId, bucket: 'logos' })
  
  // Test bucket access first
  try {
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
    console.log('Available buckets:', buckets, 'Bucket error:', bucketError)
  } catch (bucketTestError) {
    console.error('Bucket test failed:', bucketTestError)
  }

  // Upload file to public logos bucket (unique filename ensures no conflicts)
  const { data, error } = await supabase.storage
    .from('logos')
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type // Ensure proper content type
    })

  console.log('Storage upload result:', { data, error })

  if (error) {
    console.error('Storage upload error:', error)
    throw new Error(`Upload failed: ${error.message}`)
  }

  // Return the public URL for the uploaded file
  const { data: publicUrl } = supabase.storage
    .from('logos')
    .getPublicUrl(filePath)

  console.log('Generated public URL:', publicUrl)

  return publicUrl.publicUrl
}
