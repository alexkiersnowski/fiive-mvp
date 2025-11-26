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
  const { data: _data, error } = await supabase.storage
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

/**
 * Upload an avatar file to public storage
 * @param file - The file to upload
 * @param profileId - The profile ID (UUID)
 * @returns Promise<string> - The public URL of the uploaded file
 */
export async function uploadAvatar(file: File, profileId: string): Promise<string> {
  const supabase = await createClient()

  // Generate unique filename with timestamp to ensure fresh upload
  const fileExt = file.name.split('.').pop()
  const timestamp = Date.now()
  const fileName = `avatar-${timestamp}.${fileExt}`
  const filePath = `${profileId}/${fileName}`

  // Upload file to public avatars bucket (unique filename ensures no conflicts)
  const { data: _data, error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type // Ensure proper content type
    })

  if (error) {
    console.error('Avatar upload error:', error)
    throw new Error(`Avatar upload failed: ${error.message}`)
  }

  // Return the public URL for the uploaded file
  const { data: publicUrl } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  return publicUrl.publicUrl
}

/**
 * Delete all logo files for an organization from storage
 * Uses regular client with RLS policy that checks user has permission via agency membership
 * Must be called BEFORE organization is deleted so RLS can verify organization exists
 * @param organizationId - The organization ID (UUID)
 * @returns Promise<{ success: boolean; error?: string }> - Success status and optional error message
 */
export async function deleteLogoFolder(organizationId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    // List files in the organization's folder (with trailing slash for folder path)
    const { data: files, error: listError } = await supabase.storage
      .from('logos')
      .list(`${organizationId}/`, {
        limit: 1000 // Reasonable limit for logo files per organization
      })

    // Handle "not found" errors gracefully - empty folder is success
    if (listError) {
      const errorMessage = listError.message?.toLowerCase() || ''
      const errorCode = (listError as { statusCode?: string; code?: string })?.statusCode || 
                       (listError as { statusCode?: string; code?: string })?.code || ''
      
      // Check if error indicates folder doesn't exist (which is fine)
      if (
        errorMessage.includes('not found') || 
        errorMessage.includes('does not exist') ||
        errorMessage.includes('no such file') ||
        errorCode === '404' ||
        errorCode === 'PGRST301'
      ) {
        return { success: true }
      }
      
      // Real error - log and return failure
      console.error('Error listing logo files:', {
        error: listError.message,
        code: errorCode,
        organizationId
      })
      return { 
        success: false, 
        error: `Failed to list logo files: ${listError.message}` 
      }
    }

    // Early return if no files to delete
    if (!files || files.length === 0) {
      return { success: true }
    }

    // Construct full paths for all files (filter out any folder entries)
    const filePaths = files
      .filter(file => file.id !== null) // Exclude folder entries (if any)
      .map(file => `${organizationId}/${file.name}`)

    // Early return if no valid file paths after filtering
    if (filePaths.length === 0) {
      return { success: true }
    }

    // Delete all files in one batch operation
    const { error: deleteError } = await supabase.storage
      .from('logos')
      .remove(filePaths)

    if (deleteError) {
      console.error('Error deleting logo files:', {
        error: deleteError.message,
        fileCount: filePaths.length,
        organizationId
      })
      return { 
        success: false, 
        error: `Failed to delete logo files: ${deleteError.message}` 
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error deleting logo folder:', {
      error: error instanceof Error ? error.message : String(error),
      organizationId
    })
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

/**
 * Delete all avatar files for a profile from storage
 * Must be called BEFORE profile is deleted so RLS can verify profile exists
 * @param profileId - The profile ID (UUID)
 * @returns Promise<{ success: boolean; error?: string }> - Success status and optional error message
 */
export async function deleteAvatarFolder(profileId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    // List files in the profile's folder (with trailing slash for folder path)
    const { data: files, error: listError } = await supabase.storage
      .from('avatars')
      .list(`${profileId}/`, {
        limit: 1000 // Reasonable limit for avatar files per profile
      })

    // Handle "not found" errors gracefully - empty folder is success
    if (listError) {
      const errorMessage = listError.message?.toLowerCase() || ''
      const errorCode = (listError as { statusCode?: string; code?: string })?.statusCode || 
                       (listError as { statusCode?: string; code?: string })?.code || ''
      
      // Check if error indicates folder doesn't exist (which is fine)
      if (
        errorMessage.includes('not found') || 
        errorMessage.includes('does not exist') ||
        errorMessage.includes('no such file') ||
        errorCode === '404' ||
        errorCode === 'PGRST301'
      ) {
        return { success: true }
      }
      
      // Real error - log and return failure
      console.error('Error listing avatar files:', {
        error: listError.message,
        code: errorCode,
        profileId
      })
      return { 
        success: false, 
        error: `Failed to list avatar files: ${listError.message}` 
      }
    }

    // Early return if no files to delete
    if (!files || files.length === 0) {
      return { success: true }
    }

    // Construct full paths for all files (filter out any folder entries)
    const filePaths = files
      .filter(file => file.id !== null) // Exclude folder entries (if any)
      .map(file => `${profileId}/${file.name}`)

    // Early return if no valid file paths after filtering
    if (filePaths.length === 0) {
      return { success: true }
    }

    // Delete all files in one batch operation
    const { error: deleteError } = await supabase.storage
      .from('avatars')
      .remove(filePaths)

    if (deleteError) {
      console.error('Error deleting avatar files:', {
        error: deleteError.message,
        fileCount: filePaths.length,
        profileId
      })
      return { 
        success: false, 
        error: `Failed to delete avatar files: ${deleteError.message}` 
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error deleting avatar folder:', {
      error: error instanceof Error ? error.message : String(error),
      profileId
    })
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}
