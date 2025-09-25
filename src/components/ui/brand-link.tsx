import Link from 'next/link'
import Image from 'next/image'
import { Button } from './button'

interface BrandLinkProps {
  href?: string
  className?: string
}

export default function BrandLink({ 
  href = '/home', 
  className = '' 
}: BrandLinkProps) {
  return (
    <Button 
      variant="ghost" 
      asChild 
      className={`h-10 p-[var(--spacing-2)] hover:bg-[var(--color-interactive-surface-hover)] ${className}`}
    >
      <Link href={href} prefetch={true}>
        <Image 
          src="/logos/fiive-logo.svg" 
          alt="Fiive" 
          width={80}
          height={20}
          style={{ height: '20px', width: 'auto' }}
          draggable={false}
          priority
        />
      </Link>
    </Button>
  )
}
