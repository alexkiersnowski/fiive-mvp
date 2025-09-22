"use client"

import Link from 'next/link'
import { ReactNode, useEffect, useState } from 'react'
import { SquaresFour } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

interface NavItemProps {
  href: string
  children: React.ReactNode
  icon?: ReactNode
  className?: string
  isSelected?: boolean
  isCollapsed?: boolean
}

export default function NavItem({ href, children, icon, className = '', isSelected = false, isCollapsed = false }: NavItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showText, setShowText] = useState(!isCollapsed)

  useEffect(() => {
    if (isCollapsed) {
      // Hide text immediately when collapsing
      setShowText(false)
    } else {
      // Show text with 100ms delay when expanding
      const timer = setTimeout(() => {
        setShowText(true)
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [isCollapsed])

  const getBackgroundColor = () => {
    if (isSelected) return 'var(--color-interactive-surface-selected)'
    if (isHovered) return 'var(--color-interactive-surface-hover)'
    return 'transparent'
  }

  const linkElement = (
    <Link 
      href={href}
      className={`block w-full flex items-center text-left rounded-md transition-all duration-200 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${className}`}
      style={{
        padding: '8px',
        height: '36px',
        width: isCollapsed ? '36px' : '100%',
        backgroundColor: getBackgroundColor(),
        color: 'var(--color-base-text-primary, #1C2024)',
        fontFamily: 'var(--typography-font-family-text, Inter)',
        fontSize: 'var(--typography-font-size-2, 14px)',
        fontStyle: 'normal',
        fontWeight: '400',
        lineHeight: 'var(--typography-line-height-2, 20px)',
        letterSpacing: 'var(--typography-letter-spacing-2, 0)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="flex-shrink-0 flex items-center justify-center" style={{ 
        width: '18px', 
        height: '18px', 
        marginRight: isCollapsed ? '0' : '12px'
      }}>
        {icon || <SquaresFour size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />}
      </span>
      <span 
        style={{ 
          opacity: showText ? 1 : 0,
          transition: showText ? 'opacity 0.15s ease-in-out' : 'none'
        }}
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
