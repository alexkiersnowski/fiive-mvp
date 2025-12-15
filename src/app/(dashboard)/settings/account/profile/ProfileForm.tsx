"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ImageUpload } from '@/components/ui/image-upload'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { toast } from 'sonner'
import { updateProfile } from '../../actions'
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const profileSchema = z.object({
  first_name: z.string().trim().min(1, "Please enter your first name"),
  last_name: z.string().trim().min(1, "Please enter your last name"),
  job_title: z.string().trim().optional(),
  email: z.string().email("Please enter a valid email address"),
})

type ProfileFormData = z.infer<typeof profileSchema>

interface ProfileFormProps {
  initialValues: {
    first_name: string
    last_name: string
    job_title: string
    email: string
    avatar_url: string
  }
  userId: string
  context: EnhancedModeContext
}

export default function ProfileForm({ initialValues, userId, context }: ProfileFormProps) {
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: initialValues.first_name,
      last_name: initialValues.last_name,
      job_title: initialValues.job_title,
      email: initialValues.email,
    },
  })

  const isFormChanged = form.formState.isDirty || profilePicture !== null

  const handleSubmit = async (data: ProfileFormData) => {
    // Don't save if nothing has changed
    if (!isFormChanged) {
      return
    }

    // Trigger validation
    const isValid = await form.trigger()
    if (!isValid) {
      return
    }

    setIsSaving(true)
    
    try {
      // Call server action to update profile
      const result = await updateProfile({
        userId,
        first_name: data.first_name,
        last_name: data.last_name,
        job_title: data.job_title,
        avatar_file: profilePicture || undefined,
      })
      
      if (result.ok) {
        // Show success toast
        toast.success("Profile updated successfully")
        
        // Reset form dirty state and clear profile picture
        form.reset(data)
        setProfilePicture(null)
      } else {
        // Handle validation errors
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              form.setError(field as keyof ProfileFormData, {
                message: messages[0]
              })
            }
          })
        } else if (result.message) {
          toast.error(result.message)
        }
      }
      
    } catch (error) {
      console.error('Error saving profile:', error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save profile. Please try again."
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="display-9-medium mb-2" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          Profile
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-base-text-secondary, rgba(3, 9, 26, 0.72))' }}>
          {context.variant === 'agency' 
            ? 'What your clients and team see when they work with you'
            : 'What your agencies and team see when they work with you'
          }
        </p>
      </div>

      {/* Form Content */}
      <div className="max-w-[552px] space-y-10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          {/* Profile Picture Upload */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
              Avatar
            </label>
            <ImageUpload
              onLogoChange={(file) => setProfilePicture(file)}
              initialLogoUrl={initialValues.avatar_url}
              uploadText="Upload photo"
              changeText="Click to change photo"
            />
          </div>

          {/* First Name */}
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  First name
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter your first name"
                    className="h-10 px-4 py-2 text-sm"
                    maxLength={255}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Last Name */}
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  Last name
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter your last name"
                    className="h-10 px-4 py-2 text-sm"
                    maxLength={255}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Job Title / Role */}
          <FormField
            control={form.control}
            name="job_title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  Job title
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter your job title"
                    className="h-10 px-4 py-2 text-sm"
                    maxLength={255}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email (Read-only) */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    readOnly
                    className="h-10 px-4 py-2 text-sm cursor-default [&:focus]:outline-none [&:focus]:ring-0 [&:focus]:border-[var(--color-neutral-5)]"
                    maxLength={255}
                    style={{
                      background: 'var(--color-neutral-alpha-2, rgba(0, 0, 85, 0.02))',
                      color: 'var(--color-base-text-primary, #1C2024)',
                      userSelect: 'text'
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Save Button */}
          <div className="pt-4">
            <Button
              type="submit"
              variant="default"
              size="lg"
              className="cursor-pointer text-sm relative"
              disabled={isSaving || !isFormChanged}
            >
              <span className={isSaving ? "invisible" : ""}>Save</span>
              {isSaving && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner size={16} />
                </div>
              )}
            </Button>
          </div>
        </form>
      </Form>
      </div>
    </div>
  )
}
