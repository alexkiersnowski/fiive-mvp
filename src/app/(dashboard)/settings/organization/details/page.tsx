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
  website: z.string().trim().url("Please enter a valid website URL").optional().or(z.literal("")),
  about: z.string().trim().optional(),
  agencyType: z.string().trim().min(1, "Please select an agency type"),
  currency: z.string().trim().min(1, "Please select a currency"),
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

export default function OrganizationDetailsPage() {
  const [connectionCode] = useState('mon-84J2-7QW9-1a6f3c')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<AgencyDetailsFormData>({
    resolver: zodResolver(agencyDetailsSchema),
    defaultValues: {
      name: "exa. studio",
      website: "",
      about: "",
      agencyType: "Creative Agency",
      currency: "EUR",
    },
  })

  const watchedValues = form.watch()
  const isFormChanged = form.formState.isDirty || logoFile !== null

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
      // Simulate API call to save agency details
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Show success toast
      toast.success("Agency details updated successfully")
      
    } catch (error) {
      console.error('Error saving agency details:', error)
      toast.error("Failed to save agency details. Please try again.")
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
            <ImageUpload
              onLogoChange={(file) => setLogoFile(file)}
              initialLogoUrl=""
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
            name="about"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  About
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Tell clients about your agency..."
                    className="min-h-[100px]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Agency Type */}
          <FormField
            control={form.control}
            name="agencyType"
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
                            placeholder="example.com"
                            className="h-10 px-4 py-2 text-sm"
                          />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Currency */}
          <FormField
            control={form.control}
            name="currency"
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