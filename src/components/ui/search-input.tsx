"use client"

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { MagnifyingGlass } from '@phosphor-icons/react/ssr';

interface SearchInputProps {
  placeholder?: string;
  count?: number;
  countLabel?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function SearchInput({ 
  placeholder = "Search", 
  count = 0, 
  countLabel = "items",
  value,
  onChange
}: SearchInputProps) {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  
  // Use external value if provided, otherwise use internal state
  const searchQuery = value !== undefined ? value : internalSearchQuery;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (onChange) {
      onChange(newValue);
    } else {
      setInternalSearchQuery(newValue);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <Input 
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleChange}
          className="h-[32px] px-4 py-2 text-sm pl-10"
          style={{ width: '360px' }}
        />
        <MagnifyingGlass 
          size={16} 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
        />
      </div>
      <span className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary)' }}>
        {count} {countLabel}
      </span>
    </div>
  );
}
