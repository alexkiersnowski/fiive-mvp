'use client'

import { useState } from 'react'
import * as React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Button } from './button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu'
import { DotsThree, Trash } from '@phosphor-icons/react'

export interface CommentItemProps {
  id: string
  userName: string
  userAvatar?: string
  createdAt: Date
  text: string
  createdByUserId?: string
  activeUserId?: string
  onDelete?: (commentId: string) => void
  hideActions?: boolean
}

export function CommentItem({ id, userName, userAvatar, createdAt, text, createdByUserId, activeUserId, onDelete, hideActions = false }: CommentItemProps) {
  const [isCommentDropdownOpen, setIsCommentDropdownOpen] = useState(false)
  
  const handleDeleteComment = () => {
    onDelete?.(id)
    setIsCommentDropdownOpen(false)
  }
  
  // Only show delete button if the active user created this comment and actions are not hidden
  const canDelete = !hideActions && createdByUserId && activeUserId && createdByUserId === activeUserId

  // URL detection and linkification utility for comment text
  const linkifyText = (text: string): React.ReactNode[] => {
    if (!text) return []
    
    // URL regex pattern: only matches explicit URLs starting with https://, http://, or www.
    // Also handles URLs that may be followed by punctuation
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
    
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match
    
    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }
      
      // Extract the URL
      let url = match[0]
      
      // Remove trailing punctuation that shouldn't be part of the URL
      // But keep punctuation that's commonly part of URLs (/, ?, &, =, etc.)
      url = url.replace(/[.,;:!?]+$/, '')
      
      // Ensure www. URLs have https:// prefix
      let href = url
      if (url.startsWith('www.')) {
        href = `https://${url}`
      }
      
      // Add the link element
      parts.push(
        React.createElement('a', {
          key: `link-${match.index}`,
          href: href,
          target: '_blank',
          rel: 'noopener noreferrer',
          style: {
            color: 'var(--color-interactive-neutral-default)',
            textDecoration: 'underline',
            textDecorationColor: 'var(--color-interactive-neutral-default)',
            cursor: 'pointer'
          },
          className: 'hover:opacity-80'
        }, url)
      )
      
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining text after last URL
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }
    
    return parts.length > 0 ? parts : [text]
  }
  
  return (
    <div className="flex items-start gap-3 mt-3">
      <Avatar className="w-5 h-5 flex-shrink-0">
        <AvatarImage src={userAvatar} />
        <AvatarFallback className="text-xs font-medium text-white" style={{ background: 'var(--color-neutral-9, #8B8D98)' }}>
          {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm-medium" style={{ color: 'var(--color-base-text-primary)' }}>
              {userName}
            </p>
            <p className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary)' }}>
              {formatDistanceToNow(createdAt, { addSuffix: true })}
            </p>
          </div>
          {canDelete && (
            <DropdownMenu modal={false} open={isCommentDropdownOpen} onOpenChange={setIsCommentDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-5 w-5 cursor-pointer transition-colors duration-75 rounded-md ${
                    isCommentDropdownOpen
                      ? 'bg-[var(--color-interactive-surface-hover)] hover:bg-[var(--color-interactive-surface-hover)]'
                      : 'hover:bg-[var(--color-interactive-surface-hover)]'
                  }`}
                >
                  <DotsThree className="w-[16px] h-[16px]" />
                  <span className="sr-only">Comment options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem 
                  onClick={() => {
                    handleDeleteComment()
                    setIsCommentDropdownOpen(false)
                  }}
                  style={{ color: 'var(--color-red-11)' }}
                >
                  <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                  Delete comment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <p 
          className="text-sm-regular" 
          style={{ 
            color: 'var(--color-base-text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {linkifyText(text)}
        </p>
      </div>
    </div>
  )
}

