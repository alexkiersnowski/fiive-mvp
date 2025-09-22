"use client"

import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Button } from './button'

interface AvatarButtonProps {
  src?: string
  alt?: string
  fallback: string
  onClick?: () => void
  className?: string
  variant?: 'user' | 'workspace'
  isActive?: boolean
}

export default function AvatarButton({ 
  src = '', 
  alt = 'User',
  fallback,
  onClick,
  className = '',
  variant = 'user',
  isActive = false
}: AvatarButtonProps) {
  const isWorkspace = variant === 'workspace'
  const borderRadius = isWorkspace ? 'var(--spacing-1)' : '50%'
  
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={onClick}
      className={`h-10 w-10 p-1 ${isActive ? 'bg-[var(--color-interactive-surface-hover)]' : 'hover:bg-[var(--color-interactive-surface-hover)]'} cursor-pointer ${className}`}
      style={{ 
        borderRadius,
        ...(isActive && { 
          backgroundColor: 'var(--color-interactive-surface-hover)',
          pointerEvents: 'none'
        })
      }}
    >
      <Avatar className={`h-6 w-6 ${isWorkspace ? '' : 'rounded-full'}`} style={{ borderRadius }}>
        <AvatarImage src={src} alt={alt} />
        <AvatarFallback 
          className={`bg-[var(--color-neutral-9)] !text-white text-sm-regular ${isWorkspace ? '' : 'rounded-full'}`}
          style={{ borderRadius }}
        >
          {fallback}
        </AvatarFallback>
      </Avatar>
    </Button>
  )
}
