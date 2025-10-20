"use client"

import React, { useState, useRef, KeyboardEvent } from 'react'
import { Badge } from '@/components/ui/badge'
// import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'

interface EmailChip {
  id: string
  email: string
}

interface MultiEmailInputProps {
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  onChange?: (emails: string[]) => void
}

export function MultiEmailInput({ 
  placeholder = "Enter email addresses...", 
  className = "",
  style,
  onChange 
}: MultiEmailInputProps) {
  const [chips, setChips] = useState<EmailChip[]>([])
  const [inputValue, setInputValue] = useState('')
  const [focusedChipIndex, setFocusedChipIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const createChip = (email: string): EmailChip => ({
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    email: email.trim()
  })

  const addChip = (email: string) => {
    if (emailRegex.test(email) && !chips.some(chip => chip.email === email)) {
      const newChip = createChip(email)
      const newChips = [...chips, newChip]
      setChips(newChips)
      onChange?.(newChips.map(chip => chip.email))
      setInputValue('')
    }
  }

  const removeChip = (chipId: string) => {
    const newChips = chips.filter(chip => chip.id !== chipId)
    setChips(newChips)
    onChange?.(newChips.map(chip => chip.email))
    setFocusedChipIndex(null)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault()
      if (inputValue.trim()) {
        addChip(inputValue)
      }
    } else if (e.key === 'Backspace') {
      if (!inputValue && chips.length > 0) {
        e.preventDefault()
        const indexToRemove = focusedChipIndex !== null ? focusedChipIndex : chips.length - 1
        removeChip(chips[indexToRemove].id)
        setFocusedChipIndex(null)
      }
    } else if (e.key === 'ArrowLeft') {
      if (!inputValue && chips.length > 0) {
        e.preventDefault()
        const newIndex = focusedChipIndex === null ? chips.length - 1 : Math.max(0, focusedChipIndex - 1)
        setFocusedChipIndex(newIndex)
      }
    } else if (e.key === 'ArrowRight') {
      if (focusedChipIndex !== null) {
        e.preventDefault()
        const newIndex = Math.min(chips.length - 1, focusedChipIndex + 1)
        setFocusedChipIndex(newIndex)
      }
    } else if (e.key === 'Delete') {
      if (focusedChipIndex !== null) {
        e.preventDefault()
        removeChip(chips[focusedChipIndex].id)
        setFocusedChipIndex(null)
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setFocusedChipIndex(null)
  }

  const handleInputBlur = () => {
    if (inputValue.trim()) {
      addChip(inputValue)
    }
    setFocusedChipIndex(null)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text')
    
    // Split by common delimiters (space, comma, semicolon, newline, tab)
    const emails = pastedText
      .split(/[\s,;\n\t]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0 && emailRegex.test(email))
    
    if (emails.length > 0) {
      // Add all valid emails as chips
      const newChips = [...chips]
      emails.forEach(email => {
        if (!newChips.some(chip => chip.email === email)) {
          newChips.push(createChip(email))
        }
      })
      setChips(newChips)
      onChange?.(newChips.map(chip => chip.email))
      setInputValue('')
    } else {
      // If no valid emails found, just paste the text normally
      setInputValue(pastedText)
    }
  }

  return (
    <div 
      className={`flex flex-wrap items-center gap-1 px-3 py-2 border rounded-md min-h-[40px] transition-[color,box-shadow] duration-75 focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[2px] border-[var(--color-neutral-5)] bg-[var(--color-base-surface-page-background)] ${className}`}
      style={style}
      onClick={() => inputRef.current?.focus()}
    >
      {chips.map((chip, index) => (
        <Badge
          key={chip.id}
          variant="outline"
          className={`cursor-pointer text-xs ${
            focusedChipIndex === index ? 'ring-2 ring-primary' : ''
          }`}
          onClick={(e) => {
            e.stopPropagation()
            setFocusedChipIndex(index)
            inputRef.current?.focus()
          }}
        >
          {chip.email}
          <button
            className="ml-1 hover:bg-muted rounded-full p-0.5"
            onClick={(e) => {
              e.stopPropagation()
              removeChip(chip.id)
            }}
          >
            <X size={10} />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleInputBlur}
        onPaste={handlePaste}
        placeholder={chips.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
        style={{ height: '24px' }}
      />
    </div>
  )
}
