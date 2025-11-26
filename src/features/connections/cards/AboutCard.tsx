'use client'

import { useState, useRef, useEffect } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LockSimple, Eye } from '@phosphor-icons/react';
import { useConnection } from '../ConnectionContext';
import { InlineEdit } from '@/components/ui/inline-edit';
import { updateDraftClientOrganization } from '../actions';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// Industry options matching DetailsForm.tsx
const industryTypes = [
  { value: "Education & Training", label: "Education & Training" },
  { value: "Finance & Insurance", label: "Finance & Insurance" },
  { value: "Healthcare & Wellness", label: "Healthcare & Wellness" },
  { value: "Manufacturing & Industrial", label: "Manufacturing & Industrial" },
  { value: "Media & Entertainment", label: "Media & Entertainment" },
  { value: "Non-Profit, Public Sector & Government", label: "Non-Profit, Public Sector & Government" },
  { value: "Real Estate & Construction", label: "Real Estate & Construction" },
  { value: "Retail & E-Commerce", label: "Retail & E-Commerce" },
  { value: "Sports & Fitness", label: "Sports & Fitness" },
  { value: "Technology & Software", label: "Technology & Software" },
  { value: "Travel, Leisure & Hospitality", label: "Travel, Leisure & Hospitality" },
];

// Industry selector component that displays as plain text with dropdown
function IndustrySelector({
  value,
  options,
  onSave,
  placeholder = "Select industry..."
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
  placeholder?: string;
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const selectedOption = options.find(option => option.value === value);
  const displayLabel = selectedOption?.label || (value || placeholder);
  const isEmpty = !value;

  const handleSelect = (selectedValue: string) => {
    onSave(selectedValue);
    setIsPopoverOpen(false);
  };

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "py-0.5 rounded transition-colors duration-75",
            (isHovered || isPopoverOpen) && "bg-[var(--color-interactive-surface-hover)]"
          )}
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <span 
            className={isEmpty ? "text-sm-regular text-tertiary" : "text-sm-regular"}
            style={{ 
              color: isEmpty 
                ? 'var(--color-base-text-tertiary)' 
                : 'var(--color-base-text-primary)' 
            }}
          >
            {displayLabel}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0" 
        align="start"
        style={{ width: '300px' }}
      >
        <Command>
          <div className="[&_[data-slot=command-input-wrapper]]:!h-auto [&_[data-slot=command-input-wrapper]]:!py-1">
            <CommandInput placeholder="Search industries..." className="!h-auto !py-2 px-4 text-sm" />
          </div>
          <CommandList style={{ maxHeight: '200px', overflowY: 'auto', overflowX: 'hidden' }}>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const searchValue = option.label;
                const actualValue = option.value;
                return (
                  <CommandItem
                    key={option.value}
                    value={searchValue}
                    onSelect={() => handleSelect(actualValue)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-sm-regular">{option.label}</span>
                    {option.value === value && (
                      <Check size={16} className="text-primary" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function AboutCard() {
  const { snapshot, isDisconnected } = useConnection();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  
  // Determine if fields should be editable (internal connection, agency user, client partner)
  // But not if connection is disconnected
  const isEditable = !isDisconnected && 
                     snapshot.connection.isInternal && 
                     snapshot.currentUserType === 'agency' && 
                     snapshot.partner.type === 'client';
  
  // Local state for optimistic updates
  const [description, setDescription] = useState(snapshot.partner.description || '');
  const [industry, setIndustry] = useState(snapshot.partner.industry || '');
  const [website, setWebsite] = useState(snapshot.partner.website || '');
  const partnerType = snapshot.partner.type; // 'agency' or 'client'
  
  // Sync state when snapshot changes
  useEffect(() => {
    setDescription(snapshot.partner.description || '');
    setIndustry(snapshot.partner.industry || '');
    setWebsite(snapshot.partner.website || '');
  }, [snapshot.partner.description, snapshot.partner.industry, snapshot.partner.website]);
  
  // Website validation helper (matching DetailsForm.tsx)
  const validateWebsite = (url: string): string | null => {
    if (!url || url.trim() === '') return null; // Empty is allowed
    
    const trimmed = url.trim();
    let cleanDomain = trimmed;
    
    // Remove protocol if present
    if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.replace('http://', '');
    } else if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.replace('https://', '');
    }
    
    // Remove www. if present
    if (cleanDomain.startsWith('www.')) {
      cleanDomain = cleanDomain.replace('www.', '');
    }
    
    // Remove path/slug (everything after first /)
    const slashIndex = cleanDomain.indexOf('/');
    if (slashIndex !== -1) {
      cleanDomain = cleanDomain.substring(0, slashIndex);
    }
    
    // Basic domain validation - must have at least one dot and valid TLD
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(cleanDomain)) {
      return 'Please enter a valid domain';
    }
    
    return null;
  };

  // Normalize website URL for storage (matching DetailsForm.tsx)
  const normalizeWebsiteForStorage = (url: string): string | undefined => {
    if (!url || url.trim() === '') return undefined;
    
    const trimmed = url.trim();
    let cleanDomain = trimmed;
    
    // Remove protocol if present
    if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.replace('http://', '');
    } else if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.replace('https://', '');
    }
    
    // Remove www. if present
    if (cleanDomain.startsWith('www.')) {
      cleanDomain = cleanDomain.replace('www.', '');
    }
    
    // Remove path/slug (everything after first /)
    const slashIndex = cleanDomain.indexOf('/');
    if (slashIndex !== -1) {
      cleanDomain = cleanDomain.substring(0, slashIndex);
    }
    
    // Return standardized format: https://domain.com
    return `https://${cleanDomain}`;
  };

  // Display website URL without protocol (matching DetailsForm.tsx)
  const displayWebsite = (url: string): string => {
    if (!url) return '';
    
    let cleanDomain = url;
    
    // Remove protocol
    if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.replace('http://', '');
    } else if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.replace('https://', '');
    }
    
    // Remove www. for display
    if (cleanDomain.startsWith('www.')) {
      cleanDomain = cleanDomain.replace('www.', '');
    }
    
    // Remove path/slug for display (everything after first /)
    const slashIndex = cleanDomain.indexOf('/');
    if (slashIndex !== -1) {
      cleanDomain = cleanDomain.substring(0, slashIndex);
    }
    
    return cleanDomain;
  };

  // Handle description save
  const handleDescriptionSave = async (value: string) => {
    const trimmedValue = value.trim();
    
    // Optimistic update
    const previousDescription = description;
    setDescription(trimmedValue);
    
    try {
      const result = await updateDraftClientOrganization({
        connectionId: snapshot.connection.id,
        description: trimmedValue || '' // Pass empty string so server can set to NULL
      });
      
      if (!result.success) {
        // Revert optimistic update on error
        setDescription(previousDescription);
        toast.error(result.error || 'Failed to update description');
      } else {
        toast.success('Description updated');
      }
    } catch (error) {
      // Revert optimistic update on error
      setDescription(previousDescription);
      console.error('Failed to update description:', error);
      toast.error('Failed to update description');
    }
  };

  // Handle industry save
  const handleIndustrySave = async (value: string) => {
    // Optimistic update
    const previousIndustry = industry;
    setIndustry(value);
    
    try {
      const result = await updateDraftClientOrganization({
        connectionId: snapshot.connection.id,
        industry: value
      });
      
      if (!result.success) {
        // Revert optimistic update on error
        setIndustry(previousIndustry);
        toast.error(result.error || 'Failed to update industry');
      } else {
        toast.success('Industry updated');
      }
    } catch (error) {
      // Revert optimistic update on error
      setIndustry(previousIndustry);
      console.error('Failed to update industry:', error);
      toast.error('Failed to update industry');
    }
  };

  // Handle website save
  const handleWebsiteSave = async (value: string) => {
    const trimmedValue = value.trim();
    
    // Client-side validation
    const validationError = validateWebsite(trimmedValue);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    
    // Optimistic update
    const previousWebsite = website;
    const normalizedValue = trimmedValue ? normalizeWebsiteForStorage(trimmedValue) : undefined;
    setWebsite(normalizedValue || '');
    
    try {
      const result = await updateDraftClientOrganization({
        connectionId: snapshot.connection.id,
        website: normalizedValue || ''
      });
      
      if (!result.success) {
        // Revert optimistic update on error
        setWebsite(previousWebsite);
        toast.error(result.error || 'Failed to update website');
      } else {
        toast.success('Website updated');
      }
    } catch (error) {
      // Revert optimistic update on error
      setWebsite(previousWebsite);
      console.error('Failed to update website:', error);
      toast.error('Failed to update website');
    }
  };
  
  // Check if text is truncated
  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current && description) {
        const element = textRef.current;
        setIsTruncated(element.scrollHeight > element.clientHeight);
      }
    };
    
    // Use requestAnimationFrame to ensure DOM has updated before checking truncation
    // This is especially important when connection state changes (e.g., internal -> invited)
    const rafId = requestAnimationFrame(() => {
      // Double RAF to ensure layout has completed
      requestAnimationFrame(() => {
        checkTruncation();
      });
    });
    
    window.addEventListener('resize', checkTruncation);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', checkTruncation);
    };
  }, [description, isEditable]);
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
              ? (snapshot.connection.isInternal 
                  ? 'Only your client can edit this after invite' 
                  : 'Only your client can edit this')
              : 'Only your agency can edit this'}
            </TooltipContent>
          </Tooltip>
      </div>

      {isEditable ? (
        <InlineEdit
          type="text"
          value={description}
          onSave={handleDescriptionSave}
          placeholder={partnerType === 'client' 
            ? 'Add a description...' 
            : 'No details added by the agency yet'}
          multiline={true}
          preventNewLines={true}
          maxLength={500}
          textClass="text-sm-regular"
          className="px-0 mt-[-4px]"
        />
      ) : description ? (
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
          {isEditable ? (
            <IndustrySelector
              value={industry}
              options={industryTypes}
              onSave={handleIndustrySave}
              placeholder="Select industry..."
            />
          ) : (
          <p className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
              {industry || '—'}
          </p>
          )}
        </div>
        <div>
          <p className="text-xs-medium text-tertiary mb-1">Website</p>
          {isEditable ? (
            <InlineEdit
              type="text"
              value={displayWebsite(website)}
              onSave={handleWebsiteSave}
              placeholder="example.com"
              textClass="text-sm-regular"
              className="px-0"
            />
          ) : website ? (
            <a 
              href={website.startsWith('http') ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm-regular cursor-pointer block"
              style={{ color: 'var(--color-base-text-primary)' }}
            >
              {displayWebsite(website)}
            </a>
          ) : (
            <p className="text-sm-regular text-tertiary">—</p>
          )}
        </div>
      </div>
    </Card>
  );
}


