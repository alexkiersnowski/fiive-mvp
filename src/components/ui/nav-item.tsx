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
      // Show text with 50ms delay when expanding
      const timer = setTimeout(() => {
        setShowText(true)
      }, 50)
      
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
      prefetch={true}
      className={`block w-full flex items-center text-left rounded-md transition-all duration-75 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] text-nav-regular ${className}`}
              style={{
                padding: isCollapsed ? '9px' : '9px',
        height: '36px',
        width: isCollapsed ? '36px' : '100%',
        backgroundColor: getBackgroundColor(),
        color: 'var(--color-base-text-primary, #1C2024)',
        justifyContent: isCollapsed ? 'center' : 'flex-start'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isCollapsed ? (
        <div className="flex items-center justify-center w-full h-full">
          {icon || <SquaresFour size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />}
        </div>
      ) : (
        <span className="flex-shrink-0 flex items-center justify-center" style={{ 
          width: '18px', 
          height: '18px', 
          marginRight: '12px'
        }}>
          {icon || <SquaresFour size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />}
        </span>
      )}
      {!isCollapsed && (
        <span 
          style={{ 
            opacity: showText ? 1 : 0,
            transition: showText ? 'opacity 0.1s ease-in-out' : 'none'
          }}
        >
          {children}
        </span>
      )}
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
