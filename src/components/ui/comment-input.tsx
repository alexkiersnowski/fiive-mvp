'use client'

import { useState, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Textarea } from './textarea'
import { Button } from './button'
import { ArrowRight } from '@phosphor-icons/react'

interface CommentInputProps {
  activeUser?: {
    id: string
    firstName: string
    lastName: string
    avatarUrl?: string
  }
  onCommentSubmit?: (comment: string) => void
}

export function CommentInput({ activeUser, onCommentSubmit }: CommentInputProps) {
  const [commentValue, setCommentValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    if (!commentValue.trim()) return
    onCommentSubmit?.(commentValue.trim())
    setCommentValue('')
    // Blur the textarea after submission (use setTimeout to ensure it happens after state updates)
    setTimeout(() => {
      textareaRef.current?.blur()
    }, 0)
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    // Don't focus if clicking on the button
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    // Focus the textarea when clicking anywhere else in the container
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd+Enter (Mac) or Ctrl+Enter (Windows) → submit comment
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modKey = isMac ? e.metaKey : e.ctrlKey
    
    if (modKey && e.key === 'Enter') {
      e.preventDefault()
      if (commentValue.trim()) {
        handleSubmit()
      }
    }
    // Enter alone → new line (default behavior, no action needed)
  }

  return (
    <div className="flex items-start gap-3 min-w-0">
      <Avatar className="w-5 h-5 flex-shrink-0">
        <AvatarImage src={activeUser?.avatarUrl} />
        <AvatarFallback className="text-xs font-medium text-white" style={{ background: 'var(--color-neutral-9, #8B8D98)' }}>
          {(activeUser?.firstName?.[0] || '') + (activeUser?.lastName?.[0] || '') || 'U'}
        </AvatarFallback>
      </Avatar>
      <div 
        className="flex-1 flex flex-col border border-neutral-4 rounded-md overflow-hidden min-w-0 cursor-text" 
        style={{ maxWidth: '100%' }}
        onClick={handleContainerClick}
      >
        <Textarea
          ref={textareaRef}
          placeholder="Leave a comment..."
          value={commentValue}
          onChange={(e) => setCommentValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none !border-0 focus-visible:!border-0 !min-h-0"
          style={{ 
            width: '100%',
            maxWidth: '100%',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        />
        <div className="p-3 flex justify-end">
          <Button 
            size="sm" 
            variant="default" 
            className="h-6 w-6 p-0 rounded-full cursor-pointer" 
            disabled={!commentValue.trim()}
            onClick={(e) => {
              e.stopPropagation()
              handleSubmit()
            }}
          >
            <ArrowRight size={16} weight="regular" />
          </Button>
        </div>
      </div>
    </div>
  )
}

