"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LogoUpload } from '@/components/ui/logo-upload'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { toast } from 'sonner'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Please enter your first name"),
  lastName: z.string().trim().min(1, "Please enter your last name"),
  jobTitle: z.string().trim().optional(),
  email: z.string().email("Please enter a valid email address"),
})

type ProfileFormData = z.infer<typeof profileSchema>

export default function ProfilePage() {
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "Zen",
      lastName: "Rae",
      jobTitle: "Head of Account Management",
      email: "zen.rae@exastudio.com",
    },
  })

  const watchedValues = form.watch()
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
      // Simulate API call to save profile
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Show success toast
      toast.success("Profile updated successfully")
      
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error("Failed to save profile. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-[552px] space-y-10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          {/* Profile Picture Upload */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
              Avatar
            </label>
            <LogoUpload
              onLogoChange={(file) => setProfilePicture(file)}
              initialLogoUrl=""
              uploadText="Upload photo"
              changeText="Click to change photo"
            />
          </div>

          {/* First Name */}
          <FormField
            control={form.control}
            name="firstName"
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
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Last Name */}
          <FormField
            control={form.control}
            name="lastName"
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
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Job Title / Role */}
          <FormField
            control={form.control}
            name="jobTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  Job title / role
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter your job title"
                    className="h-10 px-4 py-2 text-sm"
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
  )
}