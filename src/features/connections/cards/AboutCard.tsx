'use client'

import { useState, useRef, useEffect } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LockSimple, Eye } from '@phosphor-icons/react';
import { useConnection } from '../ConnectionContext';

export default function AboutCard() {
  const { snapshot } = useConnection();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  
  const description = snapshot.partner.description;
  const industry = snapshot.partner.industry;
  const website = snapshot.partner.website;
  const partnerType = snapshot.partner.type; // 'agency' or 'client'
  
  // Check if text is truncated
  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current && description) {
        const element = textRef.current;
        setIsTruncated(element.scrollHeight > element.clientHeight);
      }
    };
    
    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [description]);
  return (
    <Card className="w-full h-full min-h-[232px] pt-5 pb-5 px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
          About
        </CardTitle>
          <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="text-xs border-0"
                style={{
                  borderRadius: 'var(--radius-1-max, 3px)',
                  backgroundColor: 'var(--color-neutral-3, #f0f0f3)',
                  border: 'none',
                  cursor: 'default'
                }}
              >
              {snapshot.currentUserType === 'agency' ? (
                <LockSimple size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              ) : (
                <Eye size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              )}
              <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>
                {snapshot.currentUserType === 'agency' ? 'Client managed' : 'View only'}
              </span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
            {snapshot.currentUserType === 'agency' 
              ? 'Only your client can edit this' 
              : 'Only your agency can edit this'}
            </TooltipContent>
          </Tooltip>
      </div>

      {description ? (
        <>
          <p 
            ref={textRef}
            className={`text-sm-regular ${!isExpanded ? 'line-clamp-2' : ''}`}
            style={{ color: 'var(--color-base-text-primary)' }}
          >
            {description}
          </p>

          {isTruncated && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs-regular underline cursor-pointer self-start text-tertiary"
            >
              {isExpanded ? 'Read less' : 'Read more'}
            </button>
          )}
        </>
      ) : (
        <p className="text-sm-regular text-tertiary">
          {partnerType === 'client' 
            ? 'No details added by the client yet' 
            : 'No details added by the agency yet'}
        </p>
      )}

      <div className="mt-auto pt-[20px] flex gap-8">
        <div>
          <p className="text-xs-medium text-tertiary mb-1">Industry</p>
          <p className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
            {industry}
          </p>
        </div>
        <div>
          <p className="text-xs-medium text-tertiary mb-1">Website</p>
          {website ? (
            <a 
              href={website.startsWith('http') ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm-regular cursor-pointer"
              style={{ color: 'var(--color-base-text-primary)' }}
            >
              {website.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <p className="text-sm-regular text-tertiary">—</p>
          )}
        </div>
      </div>
    </Card>
  );
}


