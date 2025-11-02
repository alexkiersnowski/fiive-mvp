'use client'

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';

interface ConnectionTabsProps {
  connectionId: string;
  baseRoute: 'clients' | 'agencies';
  currentUserType: 'agency' | 'client';
  newRequestsCount?: number;
}

export function ConnectionTabs({ connectionId, baseRoute, currentUserType, newRequestsCount }: ConnectionTabsProps) {
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);

  // Scroll to top when tab changes
  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      // Multiple attempts to find and scroll the main element
      const scrollToTop = () => {
        // Try multiple selectors to find the scrollable element
        const selectors = [
          'main[style*="overflow: auto"]',
          'main',
          '[data-scrollable]',
          '.overflow-auto'
        ];
        
        let mainElement: HTMLElement | null = null;
        for (const selector of selectors) {
          mainElement = document.querySelector(selector) as HTMLElement;
          if (mainElement && mainElement.scrollHeight > mainElement.clientHeight) {
            break;
          }
        }
        
        if (mainElement) {
          // Force scroll to top immediately
          mainElement.scrollTop = 0;
          // Also try smooth scroll
          mainElement.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };
      
      // Try immediately
      scrollToTop();
      
      // Try again after a short delay to ensure DOM is ready
      setTimeout(scrollToTop, 50);
      setTimeout(scrollToTop, 150);
      
      previousPathnameRef.current = pathname;
    }
  }, [pathname]);
  
  const baseHref = `/${baseRoute}/${connectionId}`;
  
  const tabs = [
    { name: 'Overview', href: `${baseHref}/overview` },
    { name: 'Requests', href: `${baseHref}/requests` },
    { name: 'Tasks', href: `${baseHref}/tasks` },
    { name: 'Projects', href: `${baseHref}/projects` },
  ];

  return (
    <div 
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'var(--color-neutral-2)',
      }}
    >
      <nav role="tablist" className="flex border-b border-[var(--color-neutral-4)]">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-current={isActive ? 'page' : undefined}
              className="inline-flex items-center"
            >
              <span
                className={cn(
                  // OUTER wrapper: spacing around the inner text + active underline only
                  'inline-flex items-center px-2 py-[6px]',
                  isActive && 'border-b-2 border-[var(--color-neutral-12)]'
                )}
                // Pull active underline over the baseline so they render on the same line
                // 2px active border over 1px baseline → offset by -2px to avoid text shift
                style={isActive ? { marginBottom: '-2px' } : undefined}
              >
                <span
                  className={cn(
                    // INNER text wrapper: hover/focus ring target
                    'px-2 py-1 transition-colors duration-75',
                    isActive
                      ? 'text-[var(--color-base-text-primary)]'
                      : 'text-[var(--color-base-text-secondary)]',
                    'hover:bg-[var(--color-interactive-surface-hover)]',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]'
                  )}
                  style={isActive 
                    ? { font: 'var(--typography-text-sm-medium)', borderRadius: 'var(--radius-1, 3px)' } 
                    : { font: 'var(--typography-text-sm-regular)', borderRadius: 'var(--radius-1, 3px)' }}
                >
                  <span className="inline-flex items-center gap-2">
                  {tab.name}
                    {tab.name === 'Requests' && currentUserType === 'agency' && newRequestsCount !== undefined && newRequestsCount > 0 && (
                      <Badge variant="neutral">
                        {newRequestsCount}
                      </Badge>
                    )}
                  </span>
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

