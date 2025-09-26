"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ImageUpload } from '@/components/ui/image-upload'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { updateOrganizationDetails } from '../../actions'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const agencyDetailsSchema = z.object({
  name: z.string().trim().min(1, "Please enter your agency name"),
  website: z.string().trim().optional().or(z.literal("")).refine((val) => {
    if (!val || val.trim() === '') return true // Empty is allowed
    
    const trimmed = val.trim()
    let cleanDomain = trimmed
    
    // Remove protocol if present
    if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.replace('http://', '')
    } else if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.replace('https://', '')
    }
    
    // Remove www. if present
    if (cleanDomain.startsWith('www.')) {
      cleanDomain = cleanDomain.replace('www.', '')
    }
    
    // Basic domain validation - must have at least one dot and valid TLD
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
    return domainRegex.test(cleanDomain)
  }, {
    message: "Please enter a valid domain"
  }),
  description: z.string().trim().optional(),
  industry: z.string().trim().min(1, "Please select an agency type"),
  currency_code: z.string().trim().min(1, "Please select a currency"),
})

const agencyTypes: ComboboxOption[] = [
  { value: "Advertising Agency", label: "Advertising Agency" },
  { value: "Brand Agency", label: "Brand Agency" },
  { value: "Content & Social Media Agency", label: "Content & Social Media Agency" },
  { value: "Creative Agency", label: "Creative Agency" },
  { value: "Events Agency", label: "Events Agency" },
  { value: "Marketing Agency", label: "Marketing Agency" },
  { value: "Media Agency", label: "Media Agency" },
  { value: "Performance Marketing Agency", label: "Performance Marketing Agency" },
  { value: "PR & Communications Agency", label: "PR & Communications Agency" },
  { value: "SEO Agency", label: "SEO Agency" },
  { value: "Web & Digital Agency", label: "Web & Digital Agency" },
]

const currencyOptions: ComboboxOption[] = [
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
  { value: "GBP", label: "GBP" },
]

type AgencyDetailsFormData = z.infer<typeof agencyDetailsSchema>

interface DetailsFormProps {
  initialValues: {
    name: string
    website: string
    description: string
    industry: string
    currency_code: string
    logo_url: string
  }
  connectionCode: string
  organizationId: string
}

export default function DetailsForm({ initialValues, connectionCode, organizationId }: DetailsFormProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Display website URL without protocol (clean, modern look)
  const displayWebsite = (url: string): string => {
    if (!url) return ''
    
    let cleanDomain = url
    
    // Remove protocol
    if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.replace('http://', '')
    } else if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.replace('https://', '')
    }
    
    // Remove www. for display
    if (cleanDomain.startsWith('www.')) {
      cleanDomain = cleanDomain.replace('www.', '')
    }
    
    return cleanDomain
  }

  const form = useForm<AgencyDetailsFormData>({
    resolver: zodResolver(agencyDetailsSchema),
    defaultValues: {
      name: initialValues.name,
      website: displayWebsite(initialValues.website || ""),
      description: initialValues.description || "",
      industry: initialValues.industry,
      currency_code: initialValues.currency_code,
    },
  })

  const watchedValues = form.watch()
  const isFormChanged = form.formState.isDirty || logoFile !== null

  // Normalize website URL for storage (adds https://, removes www.)
  const normalizeWebsiteForStorage = (url: string): string | undefined => {
    if (!url || url.trim() === '') return undefined
    
    const trimmed = url.trim()
    let cleanDomain = trimmed
    
    // Remove protocol if present
    if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.replace('http://', '')
    } else if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.replace('https://', '')
    }
    
    // Remove www. if present
    if (cleanDomain.startsWith('www.')) {
      cleanDomain = cleanDomain.replace('www.', '')
    }
    
    // Return standardized format: https://domain.com
    return `https://${cleanDomain}`
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(connectionCode)
      toast("Copied to clipboard")
    } catch (err) {
      console.error('Failed to copy text: ', err)
      toast("Failed to copy", {
        description: "Please try again"
      })
    }
  }

  const handleSubmit = async (data: AgencyDetailsFormData) => {
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
      // Call server action to update organization details
      const result = await updateOrganizationDetails({
        organizationId,
        name: data.name,
        website: normalizeWebsiteForStorage(data.website || ''),
        description: data.description || undefined,
        industry: data.industry,
        currency_code: data.currency_code,
        logo_file: logoFile || undefined,
      })
      
      if (result.ok) {
        // Show success toast
        toast.success("Agency details updated successfully")
        
        // Reset form dirty state and clear logo file
        // Update the website field to show clean display
        const updatedData = {
          ...data,
          website: displayWebsite(normalizeWebsiteForStorage(data.website || '') || '')
        }
        form.reset(updatedData)
        setLogoFile(null)
      } else {
        // Handle validation errors
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              form.setError(field as keyof AgencyDetailsFormData, {
                message: messages[0]
              })
            }
          })
        } else if (result.message) {
          toast.error(result.message)
        }
      }
      
    } catch (error) {
      console.error('Error saving agency details:', error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save agency details. Please try again."
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-[552px] space-y-10">
      {/* Section 1: Connection Code */}
      <div 
        className="rounded-lg border py-10 px-6"
        style={{
          backgroundColor: 'var(--color-base-surface-page-background)',
          borderColor: 'var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))'
        }}
      >
        <h3 className="text-sm-medium mb-2" style={{ color: 'var(--color-base-text-high-contrast, #1C2024)' }}>
          Connection code
        </h3>
        
        <div className="flex gap-2 mb-2">
          <Input
            value={connectionCode}
            readOnly
            className="flex-1 h-10 px-4 py-2 text-sm"
          />
          <Button
            onClick={handleCopy}
            variant="default"
            size="lg"
            className="cursor-pointer text-sm"
          >
            Copy
          </Button>
        </div>
        
        <p className="text-xs-regular" style={{ color: '#71757E' }}>
          Share this code with clients on Fiive to connect your accounts
        </p>
      </div>

      {/* Section 2: Agency Details Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          {/* Logo Upload */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
              Logo
            </label>
            <ImageUpload
              onLogoChange={(file) => setLogoFile(file)}
              initialLogoUrl={initialValues.logo_url}
            />
          </div>

          {/* Agency Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  Name
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="E.g. exa. studio"
                    className="h-10 px-4 py-2 text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* About */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  About
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Tell clients about your agency..."
                    className="h-[120px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Agency Type */}
          <FormField
            control={form.control}
            name="industry"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  Agency type
                </FormLabel>
                <FormControl>
                  <Combobox
                    options={agencyTypes}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Select agency type..."
                    searchPlaceholder="Search agency types..."
                    emptyText="No agency type found."
                    hasError={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Website */}
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  Website
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ""}
                    placeholder="exastudio.com"
                    className="h-10 px-4 py-2 text-sm"
                  />
                </FormControl>
                <p className="text-xs-regular" style={{ color: '#71757E' }}>
                  We format websites for consistency (e.g. exastudio.com)
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Currency */}
          <FormField
            control={form.control}
            name="currency_code"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  Currency
                </FormLabel>
                <FormControl>
                  <Combobox
                    options={currencyOptions}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Select currency..."
                    searchPlaceholder=""
                    emptyText="No currency found."
                    hasError={!!fieldState.error}
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
