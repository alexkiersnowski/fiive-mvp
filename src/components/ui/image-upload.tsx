'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { UploadIcon } from 'lucide-react'

interface ImageUploadProps {
  onLogoChange?: (file: File | null) => void
  onError?: (error: string) => void // Callback for validation/upload errors
  currentLogo?: string
  initialLogoUrl?: string
  className?: string
  uploadText?: string
  changeText?: string
  useSessionStorage?: boolean // Only use sessionStorage during onboarding flows
  readOnly?: boolean // When true, shows preview only without upload functionality
  size?: number // Custom size in pixels (default: 96px for h-24 w-24)
  iconSize?: number // Custom icon size in pixels (default: auto-calculated based on size)
}

export function ImageUpload({ onLogoChange, onError, currentLogo, initialLogoUrl, className, uploadText = "Upload image", changeText = "Click to change image", useSessionStorage = false, readOnly = false, size = 96, iconSize }: ImageUploadProps) {
  const [files, setFiles] = useState<File[] | undefined>()
  const [logoPreview, setLogoPreview] = useState<string | undefined>(currentLogo || initialLogoUrl)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  // Store base64 data for instant preview
  const [base64Preview, setBase64Preview] = useState<string | null>(null)
  
  // Rate limiting state
  const [lastUploadTime, setLastUploadTime] = useState<number>(0)
  
  // Check for stored preview data on mount (only if sessionStorage is enabled)
  useEffect(() => {
    if (useSessionStorage) {
      const storedPreview = sessionStorage.getItem('logoPreview')
      if (storedPreview) {
        setLogoPreview(storedPreview)
        setBase64Preview(storedPreview)
      } else if (currentLogo) {
        setLogoPreview(currentLogo)
      }
    } else if (currentLogo) {
      setLogoPreview(currentLogo)
    }
  }, [useSessionStorage, currentLogo])

  // Update preview when currentLogo changes (but don't overwrite base64)
  useEffect(() => {
    if (currentLogo && !base64Preview) {
      setLogoPreview(currentLogo)
    }
  }, [currentLogo, base64Preview])

  const handleDrop = async (files: File[]) => {
    setFiles(files)
    setError(null) // Clear any previous errors
    
    if (files.length === 0) {
      return
    }
    
    // Rate limiting: prevent uploads more than once every 2 seconds
    const now = Date.now()
    if (now - lastUploadTime < 2000) {
      const errorMessage = 'Please wait a moment before uploading another file.'
      setError(errorMessage)
      onError?.(errorMessage)
      return
    }
    
    setIsUploading(true)
    setLastUploadTime(now)
    const file = files[0]
    
    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      const errorMessage = 'Please choose an image smaller than 5MB.'
      setError(errorMessage)
      onError?.(errorMessage)
      setIsUploading(false)
      return
    }
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      const errorMessage = 'Please choose a PNG, JPG, JPEG, or SVG file.'
      setError(errorMessage)
      onError?.(errorMessage)
      setIsUploading(false)
      return
    }
    
    // Create preview immediately and store base64
    const reader = new FileReader()
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        setLogoPreview(e.target.result)
        setBase64Preview(e.target.result)
        // Store in sessionStorage only if enabled (for onboarding flows)
        if (useSessionStorage) {
          const sessionKey = `logoPreview_${Date.now()}`
          sessionStorage.setItem('logoPreview', e.target.result)
          sessionStorage.setItem('logoPreviewKey', sessionKey)
        }
      }
    }
    reader.readAsDataURL(file)
    
    // Only pass the file if validation passed - upload will happen in parent
    onLogoChange?.(file)
    setIsUploading(false)
  }


  const handleError = (error: Error) => {
    let errorMessage: string
    
    // Add user-friendly error messages based on react-dropzone error messages
    if (error.message.includes('larger than') || error.message.includes('File too large') || error.message.includes('bytes') || error.message.includes('5242880')) {
      errorMessage = 'Please choose an image smaller than 5MB'
    } else if (error.message.includes('File type not supported') || error.message.includes('Invalid file type') || error.message.includes('file type must be')) {
      errorMessage = 'Please choose a PNG, JPG, JPEG, or SVG file'
    } else {
      errorMessage = 'Upload failed. Please try again.'
    }
    
    setError(errorMessage)
    onError?.(errorMessage)
  }

  const sizeStyle = { width: `${size}px`, height: `${size}px` };
  const calculatedIconSize = iconSize ?? Math.max(16, Math.min(20, size * 0.33)); // Scale icon between 16-24px based on size, or use custom size
  
  if (readOnly) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-6">
          {/* Read-only Logo Preview */}
          <div className="flex-shrink-0">
            <div className="relative">
              <div className="rounded-full border border-gray-200 bg-[var(--color-base-surface-page-background)] flex items-center justify-center overflow-hidden" style={sizeStyle}>
                {logoPreview ? (
                  <Image
                    src={logoPreview}
                    alt="Organization logo"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center">
                    <UploadIcon style={{ width: `${calculatedIconSize}px`, height: `${calculatedIconSize}px` }} className="text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Read-only Text */}
          <div className="flex-1 flex flex-col justify-center text-left">
            <p className="text-sm font-medium text-gray-900">
              
            </p>
            <p className="text-xs text-gray-500 mt-1">
              
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-6">
        {/* Circular Drop Area */}
        <div className="flex-shrink-0" style={sizeStyle}>
          <div className="relative" style={sizeStyle}>
            <Dropzone
              accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.svg'] }}
              maxFiles={1}
              maxSize={5 * 1024 * 1024} // 5MB
              onDrop={handleDrop}
              onError={handleError}
              src={files}
              className="!h-full !w-full rounded-full border border-dashed border-gray-300 bg-[var(--color-base-surface-page-background)] hover:border-gray-400 hover:bg-gray-100 transition-all duration-200 cursor-pointer flex items-center justify-center overflow-hidden !p-0"
            >
              <DropzoneEmptyState>
                <div className="flex flex-col items-center justify-center text-center">
                  <UploadIcon style={{ width: `${calculatedIconSize}px`, height: `${calculatedIconSize}px` }} className="text-gray-400" />
                </div>
              </DropzoneEmptyState>
              <DropzoneContent>
                <div className="flex flex-col items-center justify-center text-center">
                  <UploadIcon style={{ width: `${calculatedIconSize}px`, height: `${calculatedIconSize}px` }} className="text-gray-400" />
                </div>
              </DropzoneContent>
            </Dropzone>
            
            {/* Image Preview Overlay */}
            {logoPreview && (
              <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                <Image
                  src={logoPreview}
                  alt="Image preview"
                  fill
                  className="object-cover"
                  unoptimized
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
