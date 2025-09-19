"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useEffect } from "react"
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
  { value: "advertising", label: "Advertising Agency" },
  { value: "brand", label: "Brand Agency" },
  { value: "content-social", label: "Content & Social Media Agency" },
  { value: "creative", label: "Creative Agency" },
  { value: "event", label: "Events Agency" },
  { value: "marketing", label: "Marketing Agency" },
  { value: "media", label: "Media Agency" },
  { value: "performance", label: "Performance Marketing Agency" },
  { value: "pr-communications", label: "PR & Communications Agency" },
  { value: "seo", label: "SEO Agency" },
  { value: "web-digital", label: "Web & Digital Agency" },
]

const industryTypes: ComboboxOption[] = [
  { value: "education", label: "Education & Training" },
  { value: "finance", label: "Finance & Insurance" },
  { value: "healthcare", label: "Healthcare & Wellness" },
  { value: "manufacturing", label: "Manufacturing & Industrial" },
  { value: "media", label: "Media & Entertainment" },
  { value: "nonprofit", label: "Non-Profit, Public Sector & Government" },
  { value: "real-estate", label: "Real Estate & Construction" },
  { value: "retail", label: "Retail & E-Commerce" },
  { value: "sports", label: "Sports & Fitness" },
  { value: "technology", label: "Technology & Software" },
  { value: "travel", label: "Travel, Leisure & Hospitality" },
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
  initialData?: {
    firstName?: string
    lastName?: string
    jobTitle?: string
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
  initialData
}: OnboardingLayoutProps) {
  const router = useRouter()
  const isProfileForm = formType === 'profile'
  const isOrganizationForm = formType === 'organization'
  const isAccountTypeForm = formType === 'accountType'
  const schema = isAccountTypeForm 
    ? accountTypeSchema 
    : isOrganizationForm 
      ? (accountType === 'agency' ? agencySchema : accountType === 'client' ? clientSchema : organizationSchema)
      : isProfileForm 
        ? profileSchema 
        : authSchema
  
  const form = useForm<AuthFormData | ProfileFormData | OrganizationFormData | AccountTypeFormData>({
    resolver: zodResolver(schema),
    defaultValues: isAccountTypeForm ? {
      accountType: "",
    } : isOrganizationForm ? {
      name: "",
      agencyType: "",
      industry: "",
    } : isProfileForm ? {
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      jobTitle: initialData?.jobTitle || "",
    } : {
      email: "",
    },
    mode: "onSubmit",
  })

  // Reset form when formKey changes to prevent stale state
  useEffect(() => {
    form.reset()
  }, [formKey, form])

  const handleSubmit = async (data: AuthFormData | ProfileFormData | OrganizationFormData | AccountTypeFormData) => {
    try {
      if (onSubmit) {
        await onSubmit(data)
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
                {showBackButton && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-4 h-auto p-2 text-xs-bold cursor-pointer back-button"
                    onClick={() => {
                      if (isAccountTypeForm) {
                        router.push('/profile')
                      } else {
                        window.history.back()
                      }
                    }}
                  >
                    <ArrowLeft size={16} weight="regular" />
                    <span className="ml-1">Back</span>
                  </Button>
                )}
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
                            {logoUpload}
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
                                    onValueChange={field.onChange}
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
                                  placeholder="Enter your job title"
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
