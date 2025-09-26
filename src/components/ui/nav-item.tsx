"use client"

import Link from 'next/link'
import { ReactNode, useEffect, useState, useMemo } from 'react'
import { SquaresFour } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

interface NavItemProps {
  href: string
  children: React.ReactNode
  icon?: ReactNode
  className?: string
  isSelected?: boolean
  isCollapsed?: boolean
  disableTextAnimation?: boolean
}

function NavItem({ href, children, icon, className = '', isSelected = false, isCollapsed = false, disableTextAnimation = false }: NavItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showText, setShowText] = useState(!isCollapsed)

  useEffect(() => {
    if (isCollapsed) {
      // Hide text immediately when collapsing
      setShowText(false)
    } else {
      if (disableTextAnimation) {
        // Snap immediately, no flicker
        setShowText(true)
      } else {
        // Show text with 50ms delay when expanding
        const timer = setTimeout(() => {
          setShowText(true)
        }, 50)
        
        return () => clearTimeout(timer)
      }
    }
  }, [isCollapsed, disableTextAnimation])

  // Memoize background color class to prevent recalculation
  const backgroundColorClass = useMemo(() => {
    if (isSelected) return 'bg-interactive-surface-selected'
    if (isHovered) return 'bg-interactive-surface-hover'
    return 'bg-transparent'
  }, [isSelected, isHovered])

  const linkElement = (
    <Link 
      href={href}
      prefetch={true}
      className={`block w-full flex items-center text-left rounded-md transition-all duration-75 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] text-nav-regular ${backgroundColorClass} ${className}`}
      style={{
        color: 'var(--color-base-text-primary)',
        height: 'auto', // Remove fixed height
        padding: 'var(--spacing-2)', // 8px
        justifyContent: 'flex-start' // Always keep content left-aligned
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="flex-shrink-0 flex items-center justify-center w-[18px] h-[18px] mr-3">
        {icon || <SquaresFour size={18} className="fill-base-icons-primary" />}
      </span>
      <span 
        className={disableTextAnimation 
          ? (showText ? 'opacity-100' : 'opacity-0')
          : `transition-opacity duration-100 ${showText ? 'opacity-100' : 'opacity-0'}`
        }
      >
        {children}
      </span>
    </Link>
  )

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {linkElement}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {children}
        </TooltipContent>
      </Tooltip>
    )
  }

  return linkElement
}

export default NavItem
