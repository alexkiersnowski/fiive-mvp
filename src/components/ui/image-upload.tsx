'use client'

import { useState, useEffect } from 'react'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { UploadIcon } from 'lucide-react'

interface ImageUploadProps {
  onLogoChange?: (file: File | null) => void
  currentLogo?: string
  initialLogoUrl?: string
  className?: string
  uploadText?: string
  changeText?: string
}

export function ImageUpload({ onLogoChange, currentLogo, initialLogoUrl, className, uploadText = "Upload image", changeText = "Click to change image" }: ImageUploadProps) {
  const [files, setFiles] = useState<File[] | undefined>()
  const [logoPreview, setLogoPreview] = useState<string | undefined>(currentLogo || initialLogoUrl)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  // Store base64 data for instant preview
  const [base64Preview, setBase64Preview] = useState<string | null>(null)
  
  // Rate limiting state
  const [lastUploadTime, setLastUploadTime] = useState<number>(0)
  
  // Check for stored preview data on mount
  useEffect(() => {
    const storedPreview = sessionStorage.getItem('logoPreview')
    if (storedPreview) {
      setLogoPreview(storedPreview)
      setBase64Preview(storedPreview)
    } else if (currentLogo) {
      setLogoPreview(currentLogo)
    }
  }, [])

  // Update preview when currentLogo changes (but don't overwrite base64)
  useEffect(() => {
    if (currentLogo && !base64Preview) {
      setLogoPreview(currentLogo)
    }
  }, [currentLogo, base64Preview])

  const handleDrop = async (files: File[]) => {
    setFiles(files)
    setError(null) // Clear any previous errors
    
    // Rate limiting: prevent uploads more than once every 2 seconds
    const now = Date.now()
    if (now - lastUploadTime < 2000) {
      setError('Please wait a moment before uploading another file.')
      return
    }
    
    if (files.length > 0) {
      setIsUploading(true)
      setLastUploadTime(now)
      const file = files[0]
      
      // Validate file size
      if (file.size > 5 * 1024 * 1024) {
        setError('Please choose an image smaller than 5MB.')
        return
      }
      
      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
      if (!allowedTypes.includes(file.type)) {
        setError('Please choose a PNG, JPG, JPEG, or SVG file.')
        return
      }
      
      // Create preview immediately and store base64
      const reader = new FileReader()
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          setLogoPreview(e.target.result)
          setBase64Preview(e.target.result)
          // Store in sessionStorage with a unique key for this session
          const sessionKey = `logoPreview_${Date.now()}`
          sessionStorage.setItem('logoPreview', e.target.result)
          sessionStorage.setItem('logoPreviewKey', sessionKey)
        }
      }
      reader.readAsDataURL(file)
      
      // Just pass the file - upload will happen on form submit
      onLogoChange?.(file)
    }
    setIsUploading(false)
  }


  const handleError = (error: Error) => {
    
    // Add user-friendly error messages based on react-dropzone error messages
    if (error.message.includes('larger than') || error.message.includes('File too large') || error.message.includes('bytes') || error.message.includes('5242880')) {
      setError('Please choose an image smaller than 5MB')
    } else if (error.message.includes('File type not supported') || error.message.includes('Invalid file type') || error.message.includes('file type must be')) {
      setError('Please choose a PNG, JPG, JPEG, or SVG file')
    } else {
      setError('Upload failed. Please try again.')
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-6">
        {/* Circular Drop Area */}
        <div className="flex-shrink-0">
          <div className="relative">
            <Dropzone
              accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.svg'] }}
              maxFiles={1}
              maxSize={5 * 1024 * 1024} // 5MB
              onDrop={handleDrop}
              onError={handleError}
              src={files}
              className="h-24 w-24 rounded-full border border-dashed border-gray-300 bg-[var(--color-base-surface-page-background)] hover:border-gray-400 hover:bg-gray-100 transition-all duration-200 cursor-pointer flex items-center justify-center overflow-hidden"
            >
              <DropzoneEmptyState>
                <div className="flex flex-col items-center justify-center text-center">
                  <UploadIcon className="h-8 w-8 text-gray-400" />
                </div>
              </DropzoneEmptyState>
              <DropzoneContent>
                <div className="flex flex-col items-center justify-center text-center">
                  <UploadIcon className="h-8 w-8 text-gray-400" />
                </div>
              </DropzoneContent>
            </Dropzone>
            
            {/* Image Preview Overlay */}
            {logoPreview && (
              <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                <img
                  src={logoPreview}
                  alt="Image preview"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>
        </div>

        {/* Upload Text */}
        <div className="flex-1 flex flex-col justify-center text-left">
          <p className="text-sm font-medium text-gray-900">
            {logoPreview ? changeText : uploadText}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Drag and drop or click to upload
          </p>
          {error && (
            <p className="text-xs text-red-500 mt-1">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
