"use client"

import NavItem from './nav-item'
import { Button } from './button'
import { Alert, AlertDescription } from './alert'
import { Badge } from './badge'
import { SquaresFour, Users, ChatCentered, CheckCircle, StarFour, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

interface SidebarProps {
  className?: string
  selectedItem?: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export default function SidebarComponent({ className = '', selectedItem, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showAlert, setShowAlert] = useState(!isCollapsed)

  useEffect(() => {
    if (isCollapsed) {
      // Hide alert immediately when collapsing
      setShowAlert(false)
    } else {
      // Show alert with 100ms delay when expanding
      const timer = setTimeout(() => {
        setShowAlert(true)
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [isCollapsed])

  return (
    <div 
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <aside
        className={`flex flex-col ${className}`}
        style={{
          height: '100%',
          borderRight: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
          background: 'var(--color-neutral-2, #F9F9FB)',
          padding: '24px 12px'
        }}
      >
        <nav className="flex-1">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <NavItem href="/home" isSelected={selectedItem === 'home'} icon={<SquaresFour size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />} isCollapsed={isCollapsed}>
              Home
            </NavItem>
            <NavItem href="/clients" isSelected={selectedItem === 'clients'} icon={<Users size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />} isCollapsed={isCollapsed}>
              Clients
            </NavItem>
            <NavItem href="/requests" isSelected={selectedItem === 'requests'} icon={<ChatCentered size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />} isCollapsed={isCollapsed}>
              Requests
            </NavItem>
            <NavItem href="/tasks" isSelected={selectedItem === 'tasks'} icon={<CheckCircle size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />} isCollapsed={isCollapsed}>
              Tasks
            </NavItem>
          </div>
        </nav>
        
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'var(--color-orange-3, #FFF1EA)',
                  border: 'none',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.setProperty('background-color', '#FFDCCB', 'important')
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.setProperty('background-color', 'var(--color-orange-3, #FFF1EA)', 'important')
                }}
              >
                <StarFour 
                  size={18} 
                  weight="fill"
                  style={{ 
                    fill: 'var(--color-orange-11, #BA5100)' 
                  }} 
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Founding 50 feedback
            </TooltipContent>
          </Tooltip>
        ) : (
          <div
            style={{
              opacity: showAlert ? 1 : 0,
              transition: showAlert ? 'opacity 0.15s ease-in-out' : 'none'
            }}
          >
            <Alert 
              className="flex flex-col gap-2"
              style={{
                borderRadius: 'var(--radius-3, 6px)',
                background: 'var(--color-neutral-alpha-2, rgba(0, 0, 85, 0.02))',
                borderColor: 'var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
                padding: '12px'
              }}
            >
            <Badge 
              variant="secondary" 
              className="self-start flex items-center gap-1"
              style={{
                background: 'var(--color-orange-3, #FFF1EA)',
                color: 'var(--color-orange-alpha-11, rgba(204, 78, 0, 0.77))',
                font: '500 0.75rem/1rem Inter, sans-serif',
                letterSpacing: '0.0025rem'
              }}
            >
              <StarFour 
                size={12} 
                weight="fill"
                style={{ 
                  fill: 'var(--color-orange-alpha-11, rgba(204, 78, 0, 0.77))' 
                }} 
              />
              Founding member
            </Badge>
            <AlertDescription
              className="text-xs-regular"
              style={{
                color: 'var(--color-base-text-primary, #1C2024)',
                font: '400 0.75rem/1rem Inter, sans-serif',
                letterSpacing: '0.0025rem'
              }}
            >
              You're one of the Founding 50 defining the future of Fiive
            </AlertDescription>
            <Button 
              variant="link" 
              className="self-start p-0 h-auto underline cursor-pointer"
              style={{
                color: 'var(--color-base-text-primary, #1C2024)',
                font: '400 0.75rem/1rem Inter, sans-serif',
                letterSpacing: '0.0025rem'
              }}
            >
              Share feedback
            </Button>
            </Alert>
          </div>
        )}
      </aside>
      
      {/* Floating collapse button */}
      <Button
        variant="ghost"
        size="icon"
        className={`absolute top-6 -right-3 w-6 h-6 rounded-full hover:!bg-[#EAEAEF] cursor-pointer transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{
          position: 'absolute',
          top: '4px',
          right: '-12px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'var(--color-neutral-2, #F9F9FB)',
          border: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
          color: 'var(--color-base-text-secondary, #000714bd)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={onToggleCollapse}
      >
        {isCollapsed ? (
          <CaretRight style={{ width: '14px', height: '14px' }} />
        ) : (
          <CaretLeft style={{ width: '14px', height: '14px' }} />
        )}
      </Button>
    </div>
  )
}
