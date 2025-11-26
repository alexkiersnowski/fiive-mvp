'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from './button'
import { WarningCircle } from '@phosphor-icons/react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * ErrorBoundary component to catch and display React errors gracefully
 * 
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise use default
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="max-w-md w-full space-y-4 text-center">
            <div className="flex justify-center">
              <WarningCircle size={48} className="text-[var(--color-red-11)]" />
            </div>
            <div className="space-y-2">
              <h3 className="display-7-medium">Something went wrong</h3>
              <p className="text-sm-regular text-[var(--color-base-text-secondary)]">
                We encountered an unexpected error. Please try refreshing the page.
              </p>
            </div>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <details className="text-left">
                <summary className="text-xs-regular text-[var(--color-base-text-tertiary)] cursor-pointer mb-2">
                  Error details (dev only)
                </summary>
                <pre className="text-xs bg-[var(--color-neutral-3)] p-4 rounded overflow-auto max-h-[200px]">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <Button
              onClick={this.handleReset}
              variant="default"
              className="mt-4"
            >
              Try again
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

