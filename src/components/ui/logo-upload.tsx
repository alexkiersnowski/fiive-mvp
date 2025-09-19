'use client'

import { useState } from 'react'
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/ui/shadcn-io/dropzone'
import { UploadIcon } from 'lucide-react'

interface LogoUploadProps {
  onLogoChange?: (file: File | null) => void
  currentLogo?: string
  className?: string
}

export function LogoUpload({ onLogoChange, currentLogo, className }: LogoUploadProps) {
  const [files, setFiles] = useState<File[] | undefined>()
  const [logoPreview, setLogoPreview] = useState<string | undefined>(currentLogo)

  const handleDrop = (files: File[]) => {
    console.log('Logo uploaded:', files)
    setFiles(files)
    
    if (files.length > 0) {
      const file = files[0]
      onLogoChange?.(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          setLogoPreview(e.target.result)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleError = (error: Error) => {
    console.error('Logo upload error:', error)
    // You could add toast notifications here
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
                  alt="Organization logo"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>
        </div>

        {/* Upload Text */}
        <div className="flex-1 flex flex-col justify-center text-left">
          <p className="text-sm font-medium text-gray-900">
            {logoPreview ? 'Click to change logo' : 'Upload logo'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Drag and drop or click to upload
          </p>
        </div>
      </div>
    </div>
  )
}
