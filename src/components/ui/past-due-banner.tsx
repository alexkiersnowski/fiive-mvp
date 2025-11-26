"use client"

import { useState } from 'react'
import { Warning } from '@phosphor-icons/react'
import { ArrowRight } from '@phosphor-icons/react'

interface PastDueBannerProps {
  onManagePayment: () => Promise<void>
}

export function PastDueBanner({ onManagePayment }: PastDueBannerProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (isLoading) return
    
    setIsLoading(true)
    try {
      await onManagePayment()
    } catch (error) {
      console.error('Failed to open payment portal:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div 
      className="w-full py-3 px-4 border-b-0 past-due-banner"
    >
      <div className="flex items-center justify-between max-w-full">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Warning 
            weight="fill" 
            className="flex-shrink-0 w-5 h-5 past-due-banner-icon"
          />
          <span 
            className="text-sm flex-1 font-normal past-due-banner-text"
          >
            Payment overdue. Please update your payment method to avoid losing access to clients.
          </span>
        </div>
        <button
          onClick={handleClick}
          disabled={isLoading}
          className="flex items-center gap-1 flex-shrink-0 ml-4 hover:opacity-80 transition-opacity disabled:opacity-50 cursor-pointer bg-transparent border-none p-0 text-sm underline past-due-banner-button"
        >
          <span>Manage payment</span>
          <ArrowRight 
            weight="regular"
            className="w-4 h-4 past-due-banner-icon"
          />
        </button>
      </div>
    </div>
  )
}

