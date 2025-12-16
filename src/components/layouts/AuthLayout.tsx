"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useEffect } from "react"
import { z } from "zod"
import Image from "next/image"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
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

type AuthFormData = z.infer<typeof authSchema>

interface AuthLayoutProps {
  title: string
  subtitle: string
  description?: string
  linkText: string
  linkHref: string
  linkLabel: string
  buttonText: string
  placeholder?: string
  onSubmit: (data: AuthFormData) => Promise<void>
  formKey?: string
  showForm?: boolean
}

export default function AuthLayout({ 
  title, 
  subtitle, 
  description,
  linkText, 
  linkHref, 
  linkLabel,
  buttonText,
  placeholder = "Enter your email address",
  onSubmit,
  formKey = "auth-form",
  showForm = true
}: AuthLayoutProps) {
  const form = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
    },
    mode: "onSubmit",
  })

  // Reset form when formKey changes to prevent stale state
  useEffect(() => {
    form.reset()
  }, [formKey, form])

  const handleSubmit = async (data: AuthFormData) => {
    try {
      await onSubmit(data)
    } catch (error) {
      // Next.js redirect() throws a special error - don't treat it as an error
      if (error && typeof error === 'object' && 'digest' in error) {
        const digest = (error as { digest?: unknown }).digest
        if (typeof digest === 'string' && digest.includes('NEXT_REDIRECT')) {
          // This is a redirect - let it propagate
          throw error
        }
      }
      
      // Extract error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred. Please try again.'
      
      // Set error on form field for inline display only
      form.setError('email', {
        type: 'server',
        message: errorMessage
      })
    }
  }
  return (
    <div className="min-h-screen flex relative" style={{ backgroundColor: 'var(--color-neutral-1)' }}>
      {/* Navigation bar */}
      <div className="absolute top-0 left-0 w-full z-10 px-5 sm:px-5 lg:px-10" style={{ 
        paddingTop: '24px', 
        paddingBottom: '24px' 
      }}>
        <Image 
          src="/logos/fiive-logo.svg" 
          alt="Fiive" 
          width={96}
          height={24}
          style={{ height: '24px' }}
          draggable={false}
          priority
        />
      </div>

      {/* Left side - Form content (full width below lg, 2/3 width at lg+) */}
      <div className="w-full lg:w-[66.67%] relative">
        {/* Main content container - full height with relative positioning */}
        <div className="h-full relative">
          {/* Main content - centered with bottom offset */}
          <div className="h-full flex items-center justify-center px-5 py-8 sm:px-5 lg:px-8">
            <div className="w-full space-y-8 mb-6" style={{ maxWidth: 'var(--max-width-auth)' }}>
              <div className="text-center">
                <h1 className="display-8-medium" style={{ marginBottom: 'var(--scale-4)' }}>{title}</h1>
                <p className="text-md-regular" style={{ 
                  color: 'var(--color-base-text-primary)',
                  marginBottom: description ? '4px' : 'var(--scale-7)'
                }}>
                  {subtitle}
                </p>
                {description && (
                  <p className="text-md-regular" style={{ 
                    color: 'var(--color-base-text-primary)',
                    marginBottom: 'var(--scale-7)'
                  }}>
                    {description}
                  </p>
                )}
              </div>
              <div className="space-y-6">
                {showForm ? (
                  <>
                    <Form {...form}>
                      <form key={formKey} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="sr-only">Email address</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  autoComplete="email"
                                  placeholder={placeholder}
                                  className="h-10 px-4 py-2 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

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
                      </form>
                    </Form>
                    
                    <div className="text-center">
                      <p className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                        By proceeding you agree to the{' '}
                        <a 
                          href="https://www.fiive.co/legal/terms" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm-regular underline"
                          style={{ color: 'var(--color-base-text-secondary)' }}
                        >
                          Terms of Service
                        </a>
                        {' '}and{' '}
                        <a 
                          href="https://www.fiive.co/legal/privacy" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm-regular underline"
                          style={{ color: 'var(--color-base-text-secondary)' }}
                        >
                          Privacy Policy
                        </a>
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          
          {/* Bottom text - absolutely positioned at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-8" style={{ paddingBottom: '24px' }}>
            <div className="text-center">
              <p className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                {linkText}{' '}
                <a 
                  href={linkHref} 
                  className="text-sm-regular underline"
                  style={{ color: 'var(--color-base-text-secondary)' }}
                >
                  {linkLabel}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Graphic container (1/3 width) - Hidden below lg */}
      <div className="hidden lg:flex items-center justify-center" style={{ width: '33.33%' }}>
        <div className="w-full h-full p-2">
          <div 
            className="w-full h-full rounded-sm flex items-center justify-center relative overflow-hidden"
            style={{ backgroundColor: 'var(--color-neutral-3)' }}
          >
            {/* Circular gradient blur element */}
            <div
              className="absolute"
              suppressHydrationWarning
              style={{
                background: 'linear-gradient(180deg, #FF8C1A 0%, #FF8985 40%, #51D9CC 100%)',
                borderRadius: '50%',
                width: '250%',
                height: '150%',
                
                filter: 'blur(100px)',
                right: '-125%',
                top: '-5%',
                opacity: 1,
              }}
            />
            {/* Watermark image on top */}
            <Image 
              src="/logos/brand-watermark.svg" 
              alt="Fiive" 
              width={240}
              height={240}
              className="max-w-full h-60 object-contain relative z-10"
              style={{ opacity: 0.78 }}
              draggable={false}
              loading="eager"
              suppressHydrationWarning
            />
          </div>
        </div>
      </div>
    </div>
  )
}
