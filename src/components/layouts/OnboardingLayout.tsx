"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from 'next/image'
import { z } from "zod"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { RadioCards, RadioCard, AgencyIcon, ClientIcon } from '@/components/ui/radio-cards'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { ArrowLeft } from '@phosphor-icons/react'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const authSchema = z.object({
  email: z
    .string()
    .min(1, "Please enter your work email")
    .email("Enter a valid email address")
})

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  jobTitle: z.string().optional()
})

const organizationSchema = z.object({
  name: z.string().min(1, "Please enter your organization name"),
  agencyType: z.string().optional(),
  industry: z.string().optional(),
  logoUrl: z.string().optional(),
})

const agencySchema = z.object({
  name: z.string().min(1, "Please enter your agency name"),
  agencyType: z.string().min(1, "Please select an agency type"),
})

const clientSchema = z.object({
  name: z.string().min(1, "Please enter your company name"),
  industry: z.string().min(1, "Please select an industry"),
})

const accountTypeSchema = z.object({
  accountType: z.string().min(1, "Please select an account type")
})

type AuthFormData = z.infer<typeof authSchema>
type ProfileFormData = z.infer<typeof profileSchema>
type OrganizationFormData = z.infer<typeof organizationSchema>
type AccountTypeFormData = z.infer<typeof accountTypeSchema>

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

const industryTypes: ComboboxOption[] = [
  { value: "Education & Training", label: "Education & Training" },
  { value: "Finance & Insurance", label: "Finance & Insurance" },
  { value: "Healthcare & Wellness", label: "Healthcare & Wellness" },
  { value: "Manufacturing & Industrial", label: "Manufacturing & Industrial" },
  { value: "Media & Entertainment", label: "Media & Entertainment" },
  { value: "Non-Profit, Public Sector & Government", label: "Non-Profit, Public Sector & Government" },
  { value: "Real Estate & Construction", label: "Real Estate & Construction" },
  { value: "Retail & E-Commerce", label: "Retail & E-Commerce" },
  { value: "Sports & Fitness", label: "Sports & Fitness" },
  { value: "Technology & Software", label: "Technology & Software" },
  { value: "Travel, Leisure & Hospitality", label: "Travel, Leisure & Hospitality" },
]

interface OnboardingLayoutProps {
  title: string
  subtitle?: string
  description?: string
  buttonText: string
  placeholder?: string
  onSubmit?: (data: AuthFormData | ProfileFormData | OrganizationFormData | AccountTypeFormData) => Promise<void>
  formKey?: string
  showForm?: boolean
  formType?: 'auth' | 'profile' | 'organization' | 'accountType'
  showBackButton?: boolean
  logoUpload?: React.ReactNode
  accountType?: 'agency' | 'client'
  urlAccountType?: string // Account type from URL parameter
  initialLogoUrl?: string // Existing logo URL when editing
  initialData?: {
    firstName?: string
    lastName?: string
    jobTitle?: string
    accountType?: string
    name?: string
    agencyType?: string
    industry?: string
  }
}

export default function OnboardingLayout({ 
  title, 
  subtitle,
  description,
  buttonText,
  placeholder = "Enter your email address",
  onSubmit,
  formKey = "auth-form",
  showForm = true,
  formType = 'auth',
  showBackButton = false,
  logoUpload,
  accountType,
  urlAccountType,
  initialLogoUrl,
  initialData
}: OnboardingLayoutProps) {
  const router = useRouter()
  const isProfileForm = formType === 'profile'
  const isOrganizationForm = formType === 'organization'
  const isAccountTypeForm = formType === 'accountType'
  const [logoFile, setLogoFile] = useState<File | null>(() => {
    // If there's an existing logo URL, create a fake File object to represent it
    if (initialLogoUrl && isOrganizationForm) {
      // Create a fake File object that represents the existing logo
      const fakeFile = new File([''], 'existing-logo', { type: 'image/png' })
      // Add a custom property to track that this is an existing logo
      ;(fakeFile as any).existingLogoUrl = initialLogoUrl
      return fakeFile
    }
    return null
  })
  
  // Read session storage synchronously during initial render
  const [sessionAccountType, setSessionAccountType] = useState<string>(() => {
    if (typeof window !== 'undefined' && isAccountTypeForm) {
      return sessionStorage.getItem('onboarding_account_type') || ''
    }
    return ''
  })

  const schema = isAccountTypeForm 
    ? accountTypeSchema 
    : isOrganizationForm 
      ? (accountType === 'agency' ? agencySchema : accountType === 'client' ? clientSchema : organizationSchema)
      : isProfileForm 
        ? profileSchema 
        : authSchema
  
  // Debug logging for initialData
  console.log('OnboardingLayout received initialData:', {
    initialData,
    isOrganizationForm,
    isAccountTypeForm,
    isProfileForm
  })

  const form = useForm<AuthFormData | ProfileFormData | OrganizationFormData | AccountTypeFormData>({
    resolver: zodResolver(schema),
    defaultValues: isAccountTypeForm ? {
      accountType: initialData?.accountType || sessionAccountType || "",
    } : isOrganizationForm ? {
      name: initialData?.name || "",
      agencyType: initialData?.agencyType || "",
      industry: initialData?.industry || "",
    } : isProfileForm ? {
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      jobTitle: initialData?.jobTitle || "",
    } : {
      email: "",
    },
    mode: "onSubmit",
  })

  // Handle URL parameter for account type (only when URL parameter is provided)
  useEffect(() => {
    if (isAccountTypeForm && urlAccountType) {
      // Store URL account type in session storage and update state
      sessionStorage.setItem('onboarding_account_type', urlAccountType)
      setSessionAccountType(urlAccountType)
    }
  }, [isAccountTypeForm, urlAccountType])

  // Reset form when session account type changes
  useEffect(() => {
    if (isAccountTypeForm && sessionAccountType) {
      form.setValue('accountType', sessionAccountType)
    }
  }, [sessionAccountType, isAccountTypeForm, form])

  // Reset form when formKey changes to prevent stale state
  useEffect(() => {
    form.reset()
  }, [formKey, form])

  const handleSubmit = async (data: AuthFormData | ProfileFormData | OrganizationFormData | AccountTypeFormData) => {
    try {
      console.log('Form submission started:', { 
        isOrganizationForm, 
        hasLogoFile: !!logoFile, 
        logoFile, 
        data 
      })
      
      if (onSubmit) {
        // For organization forms, include logo file or existing logo URL
        if (isOrganizationForm && logoFile) {
          console.log('Including logo file in submission:', logoFile)
          
          // Check if this is an existing logo (has existingLogoUrl property)
          if ((logoFile as any).existingLogoUrl) {
            // This is an existing logo, pass the URL instead of the File object
            console.log('Using existing logo URL:', (logoFile as any).existingLogoUrl)
            const orgData = { ...data, logoUrl: (logoFile as any).existingLogoUrl } as any
            console.log('About to call onSubmit with existing logo URL:', orgData)
            await onSubmit(orgData)
          } else {
            // This is a new logo file
            const orgData = { ...data, logoUrl: logoFile } as any
            console.log('About to call onSubmit with new logo file:', orgData)
            await onSubmit(orgData)
          }
          console.log('onSubmit completed successfully')
        } else {
          console.log('No logo file, submitting without logo')
          console.log('About to call onSubmit with data:', data)
          await onSubmit(data)
          console.log('onSubmit completed successfully')
        }
      } else {
        console.log('Form submitted (no handler):', data)
      }
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-neutral-1)' }}>
      {/* Left side - Form content (2/3 width) */}
      <div className="flex-1" style={{ width: '66.67%' }}>
        {/* Navigation */}
        <div className="py-5 px-10">
          <Image 
            src="/logos/fiive-logo.svg" 
            alt="Fiive" 
            width={96}
            height={24}
            style={{ height: '24px' }}
            draggable={false}
          />
        </div>

        {/* Main content container */}
        <div className="flex items-start justify-center" style={{ padding: '40px 32px 32px 32px' }}>
            <div className="w-full space-y-8" style={{ maxWidth: '520px' }}>
              {/* Title and description - left aligned */}
              <div className="text-left">
                <div className="mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-auto p-2 text-xs-bold cursor-pointer back-button ${!showBackButton ? 'invisible' : ''}`}
                    onClick={() => {
                      if (isAccountTypeForm) {
                        router.push('/profile')
                      } else if (isOrganizationForm && accountType) {
                        // Preserve account type when going back to account type page
                        router.push(`/account-type?type=${accountType}`)
                      } else {
                        window.history.back()
                      }
                    }}
                  >
                    <ArrowLeft size={16} weight="regular" />
                    <span className="ml-1">Back</span>
                  </Button>
                </div>
                <h1 className="display-8-medium" style={{ marginBottom: '16px' }}>{title}</h1>
                {subtitle && (
                  <p className="text-md-regular" style={{ 
                    color: 'var(--color-base-text-primary)',
                    marginBottom: 'var(--scale-7)'
                  }}>
                    {subtitle}
                  </p>
                )}
              </div>
              
              {/* Form content - left aligned */}
              <div className="space-y-6">
                {showForm ? (
                  <>
                    <Form {...form}>
                      <form key={formKey} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                        {/* Logo Upload */}
                        {logoUpload && (
                          <div className="mb-6">
                            {React.cloneElement(logoUpload as React.ReactElement<any>, {
                              onLogoChange: (file: File | null) => {
                                console.log('onLogoChange called with file:', file)
                                setLogoFile(file)
                              }
                            })}
                          </div>
                        )}

                        {isAccountTypeForm ? (
                          <FormField
                            control={form.control}
                            name="accountType"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <RadioCards
                                    value={field.value}
                                    onValueChange={(value) => {
                                      // Update form field
                                      field.onChange(value)
                                      // Store in session storage immediately
                                      if (value) {
                                        sessionStorage.setItem('onboarding_account_type', value)
                                        setSessionAccountType(value)
                                      }
                                    }}
                                  >
                                    <RadioCard value="agency" icon={<AgencyIcon />}>
                                      <h3 className="display-5-medium mb-2">
                                        Agency
                                      </h3>
                                      <p className="text-sm-regular text-left" style={{ color: 'var(--color-base-text-secondary)' }}>
                                        I provide services to multiple clients
                                      </p>
                                    </RadioCard>
                                    <RadioCard value="client" icon={<ClientIcon />}>
                                      <h3 className="display-5-medium mb-2">
                                        Client
                                      </h3>
                                      <p className="text-sm-regular text-left" style={{ color: 'var(--color-base-text-secondary)' }}>
                                        I work with one or more agencies
                                      </p>
                                    </RadioCard>
                                  </RadioCards>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : isOrganizationForm ? (
                          <>
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Name</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      value={field.value || ""}
                                      placeholder={accountType === 'agency' ? "E.g. exa. studio" : "E.g. Atlas Supply"}
                                      className="h-10 px-4 py-2 text-sm"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            {accountType === 'agency' ? (
                              <FormField
                                control={form.control}
                                name="agencyType"
                                render={({ field, fieldState }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium">Agency type</FormLabel>
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
                            ) : (
                              <FormField
                                control={form.control}
                                name="industry"
                                render={({ field, fieldState }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium">Industry</FormLabel>
                                    <FormControl>
                                      <Combobox
                                        options={industryTypes}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder="Select industry..."
                                        searchPlaceholder="Search industries..."
                                        emptyText="No industry found."
                                        hasError={!!fieldState.error}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                          </>
                        ) : isProfileForm ? (
                          <>
                            <FormField
                              control={form.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">First name</FormLabel>
                                  <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  autoComplete="given-name"
                                  placeholder="Enter your first name"
                                  className="h-10 px-4 py-2 text-sm"
                                />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="lastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Last name</FormLabel>
                                  <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  autoComplete="family-name"
                                  placeholder="Enter your last name"
                                  className="h-10 px-4 py-2 text-sm"
                                />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="jobTitle"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Job title or role</FormLabel>
                                  <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  autoComplete="organization-title"
                                  placeholder="E.g. Account Manager"
                                  className="h-10 px-4 py-2 text-sm"
                                />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </>
                        ) : (
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="sr-only">Email address</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    autoComplete="email"
                                    placeholder={placeholder}
                                    className="h-10 px-4 py-2 text-sm"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <div style={{ marginTop: '40px' }}>
                          <Button 
                            type="submit" 
                            size="lg" 
                            className="w-full cursor-pointer text-sm"
                            disabled={form.formState.isSubmitting}
                          >
                            {form.formState.isSubmitting ? (
                              <Spinner size={16} />
                            ) : (
                              buttonText
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                    
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>

      {/* Right side - Graphic container (1/3 width) */}
      <div className="flex items-center justify-center" style={{ width: '33.33%' }}>
        <div className="w-full h-full p-2">
          <div className="w-full h-full bg-brand-gradient-1 rounded-sm flex items-center justify-center">
            <Image 
              src="/logos/brand-watermark.svg" 
              alt="Fiive" 
              width={240}
              height={240}
              className="max-w-full h-60 object-contain"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
