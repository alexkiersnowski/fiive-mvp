"use client"

import * as React from "react"
import { Check } from '@phosphor-icons/react'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

export interface PlanCardProps {
  // Plan identification
  title: string
  
  // Pricing
  price: string | number  // e.g., "€0" or 0, "€99" or 99
  currency?: string  // Default: "€"
  billedAnnually?: boolean  // Show annual billing info (deprecated, use billingToggle instead)
  annualPrice?: string | number  // Annual price for display (deprecated, use billingToggle instead)
  
  // Billing toggle (optional)
  billingToggle?: {
    isAnnual: boolean
    onToggle: (isAnnual: boolean) => void
    monthlyPrice: string | number
    annualPrice: string | number
  }
  
  // Renewal date (optional) - displayed instead of "Billed annually" text
  renewalDate?: string | null
  
  // Status & Actions
  isActive?: boolean  // Determines button state and text
  buttonText?: string  // Optional custom button text (overrides isActive logic)
  onButtonClick?: () => void  // Button click handler
  buttonDisabled?: boolean  // Disable button (e.g., during loading)
  description?: React.ReactNode  // Optional description text shown below the button
  
  // Badge (optional)
  badge?: {
    text?: string
    children?: React.ReactNode
    variant?: 'default' | 'secondary' | 'outline' | 'neutral'
    className?: string
    style?: React.CSSProperties
  }
  
  // Features (required if featureSections not provided)
  features?: Array<{
    text: string
  }>
  
  // Feature sections with headings (for Starter card)
  featureSections?: Array<{
    heading: string
    features: Array<{ text: string }>
  }>
  
  // Styling
  maxWidth?: string  // Default: '410px'
  className?: string
}

export function PlanCard({
  title,
  price,
  currency = '€',
  billedAnnually = false,
  annualPrice,
  isActive = false,
  buttonText,
  onButtonClick,
  buttonDisabled = false,
  description,
  badge,
  features,
  featureSections,
  maxWidth = '410px',
  className,
  billingToggle,
  renewalDate
}: PlanCardProps) {
  // Format price display - use billingToggle price if provided, otherwise use price prop
  const displayPrice = billingToggle 
    ? (billingToggle.isAnnual ? billingToggle.annualPrice : billingToggle.monthlyPrice)
    : price
  const formattedPrice = typeof displayPrice === 'number' ? displayPrice.toString() : displayPrice
  const formattedAnnualPrice = annualPrice ? (typeof annualPrice === 'number' ? annualPrice.toString() : annualPrice) : null
  
  // Determine button text and state
  const getButtonText = () => {
    if (buttonText) return buttonText
    if (isActive) return 'Current plan'
    return 'Get early access'
  }
  
  const buttonTextFinal = getButtonText()
  const isButtonNonInteractive = isActive && !buttonText
  
  // Determine if we should show feature sections or flat features
  const hasFeatureSections = featureSections && featureSections.length > 0
  
  // Validate that either features or featureSections is provided
  if (!hasFeatureSections && (!features || features.length === 0)) {
    console.warn('PlanCard: Either features or featureSections must be provided')
  }

  return (
    <div
      className={className}
      style={{
        width: '100%',
        maxWidth,
        flex: '1 1 auto',
        padding: 'var(--spacing-5, 24px)',
        borderRadius: 'var(--radius-5, 12px)',
        border: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
        background: 'var(--color-base-surface-page-background, #ffffff)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header with title and badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="display-5-medium" style={{ color: 'var(--color-base-text-primary)' }}>
          {title}
        </h3>
        {badge && (
          <Badge 
            variant={badge.variant || 'secondary'}
            className={badge.className}
            style={badge.style}
          >
            {badge.children || badge.text}
          </Badge>
        )}
      </div>

      {/* Pricing section */}
      <div 
        style={{ 
          marginTop: 'var(--spacing-5, 24px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-2, 8px)'
        }}
      >
        <div style={{ 
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--spacing-2, 8px)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'baseline', 
            gap: 'var(--spacing-2, 8px)',
            flexShrink: 0
          }}>
            <span className="display-8-medium" style={{ color: 'var(--color-base-text-primary)' }}>
              {currency}{formattedPrice}
            </span>
            <span className="text-xl-medium" style={{ color: 'var(--color-base-text-tertiary)' }}>
              / month
            </span>
          </div>
          {billingToggle && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 'var(--spacing-2, 8px)',
              flexShrink: 0
            }}>
              <label 
                htmlFor="billing-toggle"
                className="text-xs-regular"
                style={{ color: 'var(--color-base-text-tertiary)', cursor: 'pointer' }}
              >
                Billed annually
              </label>
              <Switch
                id="billing-toggle"
                checked={billingToggle.isAnnual}
                onCheckedChange={billingToggle.onToggle}
                style={{ cursor: 'pointer' }}
              />
            </div>
          )}
        </div>
        {billedAnnually && formattedAnnualPrice && !billingToggle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <span 
              className="text-xs-regular" 
              style={{ 
                color: 'var(--color-base-text-tertiary)'
              }}
            >
              Billed annually ({currency}{formattedAnnualPrice})
            </span>
            {renewalDate && (
              <span 
                className="text-xs-regular" 
                style={{ 
                  color: 'var(--color-base-text-tertiary)'
                }}
              >
                {renewalDate}
              </span>
            )}
          </div>
        )}
        {!billedAnnually && renewalDate && (
          <span 
            className="text-xs-regular" 
            style={{ 
              color: 'var(--color-base-text-tertiary)'
            }}
          >
            {renewalDate}
          </span>
        )}
      </div>

      {/* Separator */}
      <div style={{ marginTop: '40px' }}>
        <Separator />
      </div>

      {/* Features section */}
      <div style={{ marginTop: '40px', flexGrow: 1 }}>
        {hasFeatureSections ? (
          // Render features grouped by sections
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-5, 24px)' }}>
            {featureSections.map((section, sectionIndex) => (
              <div key={sectionIndex} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2, 8px)' }}>
                <h4 className="text-sm-medium" style={{ color: 'var(--color-base-text-primary)', marginBottom: 'var(--spacing-1, 4px)' }}>
                  {section.heading}
                </h4>
                {section.features.map((feature, featureIndex) => (
                  <div key={featureIndex} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
                    <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
                    <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          // Render flat features list
          features && features.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2, 8px)' }}>
              {features.map((feature, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2, 8px)' }}>
                  <Check size={16} style={{ color: 'var(--color-base-text-secondary)' }} />
                  <span className="text-sm-regular" style={{ color: 'var(--color-base-text-secondary)' }}>
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
          ) : null
        )}
      </div>

      {/* Button */}
      <div style={{ marginTop: 'auto', paddingTop: '40px' }}>
        <Button 
          variant={isButtonNonInteractive ? "outline" : "default"}
          className={`w-full ${isButtonNonInteractive ? 'hover:bg-transparent hover:border-current shadow-none' : ''}`}
          onClick={isButtonNonInteractive ? undefined : onButtonClick}
          disabled={buttonDisabled}
          style={{
            ...(isButtonNonInteractive ? {
              pointerEvents: 'none',
              cursor: 'default',
              boxShadow: 'none',
            } : {
              cursor: 'pointer',
            }),
            height: '40px'
          }}
        >
          {buttonTextFinal}
        </Button>
        {description && (
          <div style={{ marginTop: '32px' }}>
            {description}
          </div>
        )}
      </div>
    </div>
  )
}

