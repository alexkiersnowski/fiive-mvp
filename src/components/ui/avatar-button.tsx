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
  size?: 'sm' | 'md' | 'lg' | 'custom'
  customSize?: { button: string; avatar: string }
}

export default function AvatarButton({ 
  src = '', 
  alt = 'User',
  fallback,
  onClick,
  className = '',
  variant = 'user',
  isActive = false,
  size = 'md',
  customSize
}: AvatarButtonProps) {
  const isWorkspace = variant === 'workspace'
  const borderRadius = isWorkspace ? 'var(--spacing-1)' : '50%'
  
  // Size configurations
  const sizeConfig = {
    sm: { button: 'h-8 w-8', avatar: 'h-5 w-5' },
    md: { button: 'h-10 w-10', avatar: 'h-6 w-6' },
    lg: { button: 'h-12 w-12', avatar: 'h-8 w-8' },
    custom: customSize || { button: 'h-10 w-10', avatar: 'h-6 w-6' }
  }
  
  const currentSize = sizeConfig[size]
  
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={onClick}
      className={`${currentSize.button} p-1 ${
        isActive 
          ? 'bg-[var(--color-interactive-surface-hover)] hover:bg-[var(--color-interactive-surface-hover)]' 
          : 'hover:bg-[var(--color-interactive-surface-hover)]'
      } cursor-pointer transition-all duration-75 ${className}`}
      style={{ 
        borderRadius
      }}
    >
      <Avatar className={`${currentSize.avatar} ${isWorkspace ? '' : 'rounded-full'}`} style={{ borderRadius }}>
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
