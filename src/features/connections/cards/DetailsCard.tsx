'use client'

import { useState, useEffect } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { InlineEdit } from '@/components/ui/inline-edit';
import { EyeSlash } from '@phosphor-icons/react';
import { useConnection } from '../ConnectionContext';
import { updateEngagementStatus, updateContractValue, updateContractEndDate, updateHealthStatus } from '../actions';

// Helper function to map currency code to symbol
function getCurrencySymbol(currencyCode: 'EUR' | 'USD' | 'GBP'): string {
  const symbols = {
    EUR: '€',
    USD: '$',
    GBP: '£'
  };
  return symbols[currencyCode] || '€';
}

export default function DetailsCard() {
  const { snapshot } = useConnection();
  const [contractValue, setContractValue] = useState(snapshot.connection.contractValue || '');
  const [contractEnd, setContractEnd] = useState(snapshot.connection.contractEnd || '');
  const [healthStatus, setHealthStatus] = useState(snapshot.connection.health || '');
  
  // Update local state if snapshot changes
  useEffect(() => {
    setContractValue(snapshot.connection.contractValue || '');
  }, [snapshot.connection.contractValue]);
  
  useEffect(() => {
    setContractEnd(snapshot.connection.contractEnd || '');
  }, [snapshot.connection.contractEnd]);
  
  useEffect(() => {
    setHealthStatus(snapshot.connection.health || '');
  }, [snapshot.connection.health]);

  return (
    <Card className="w-full h-full min-h-[228px] pt-5 pb-5 px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
          Details
        </CardTitle>
        <Tooltip delayDuration={400}>
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
              <EyeSlash size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>Internal only</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            Only your team can see this
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-2">
        {/* Status Row */}
        <div className="flex items-center gap-4">
          <div className="w-2/5 min-w-0">
            <p className="text-sm-regular text-secondary truncate">Status</p>
          </div>
          <div className="w-3/5 min-w-0">
            <InlineEdit
              type="badge"
              value={snapshot.connection.engagementStatus || ''}
              options={[
                { value: 'onboarding', label: 'Onboarding' },
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' },
                { value: 'offboarded', label: 'Offboarded' }
              ]}
              onSave={async (newValue) => {
                try {
                  const result = await updateEngagementStatus(
                    snapshot.connection.id,
                    newValue || null
                  );
                  
                  if (!result.success) {
                    console.error('Failed to update engagement status:', result.error);
                    // TODO: Add toast notification for error
                  }
                } catch (error) {
                  console.error('Error updating engagement status:', error);
                  // TODO: Add toast notification for error
                }
              }}
              clearable={true}
              badgeComponent="engagement"
              className="h-[28px] truncate"
            />
          </div>
        </div>

        {/* Total Contract Value Row */}
        <div className="flex items-center gap-4">
          <div className="w-2/5 min-w-0">
            <p className="text-sm-regular text-secondary truncate">Total Contract Value</p>
          </div>
          <div className="w-3/5 min-w-0">
            <InlineEdit
              type="text"
              value={contractValue}
              placeholder={`E.g. ${getCurrencySymbol(snapshot.agency.currencyCode)}250,000`}
              editingPlaceholder="250,000"
              currency={getCurrencySymbol(snapshot.agency.currencyCode)}
              numeric={true}
              onSave={async (newValue) => {
                setContractValue(newValue);
                
                try {
                  const result = await updateContractValue(
                    snapshot.connection.id,
                    newValue || null
                  );
                  
                  if (!result.success) {
                    console.error('Failed to update contract value:', result.error);
                    // Revert to previous value on error
                    setContractValue(snapshot.connection.contractValue || '');
                    // TODO: Add toast notification for error
                  }
                } catch (error) {
                  console.error('Error updating contract value:', error);
                  // Revert to previous value on error
                  setContractValue(snapshot.connection.contractValue || '');
                  // TODO: Add toast notification for error
                }
              }}
              className="h-[28px] truncate"
            />
          </div>
        </div>

        {/* Contract End Row */}
        <div className="flex items-center gap-4">
          <div className="w-2/5 min-w-0">
            <p className="text-sm-regular text-secondary truncate">Contract end</p>
          </div>
          <div className="w-3/5 min-w-0" style={{ cursor: 'pointer' }}>
            <InlineEdit
              type="date"
              value={contractEnd}
              placeholder="Add date"
              dateFormat="d MMM yyyy"
              onSave={async (newValue) => {
                setContractEnd(newValue);
                
                try {
                  const result = await updateContractEndDate(
                    snapshot.connection.id,
                    newValue || null
                  );
                  
                  if (!result.success) {
                    console.error('Failed to update contract end date:', result.error);
                    // Revert to previous value on error
                    setContractEnd(snapshot.connection.contractEnd || '');
                    // TODO: Add toast notification for error
                  }
                } catch (error) {
                  console.error('Error updating contract end date:', error);
                  // Revert to previous value on error
                  setContractEnd(snapshot.connection.contractEnd || '');
                  // TODO: Add toast notification for error
                }
              }}
              className="h-[28px] cursor-pointer truncate"
            />
          </div>
        </div>

        {/* Health Row */}
        <div className="flex items-center gap-4">
          <div className="w-2/5 min-w-0">
            <p className="text-sm-regular text-secondary truncate">Health</p>
          </div>
          <div className="w-3/5 min-w-0">
            <InlineEdit
              type="badge"
              value={healthStatus}
              options={[
                { value: 'healthy', label: 'Healthy' },
                { value: 'at_risk', label: 'At risk' },
                { value: 'critical', label: 'Critical' }
              ]}
              onSave={async (newValue) => {
                setHealthStatus(newValue);
                
                try {
                  const result = await updateHealthStatus(
                    snapshot.connection.id,
                    newValue || null
                  );
                  
                  if (!result.success) {
                    console.error('Failed to update health status:', result.error);
                    // Revert to previous value on error
                    setHealthStatus(snapshot.connection.health || '');
                    // TODO: Add toast notification for error
                  }
                } catch (error) {
                  console.error('Error updating health status:', error);
                  // Revert to previous value on error
                  setHealthStatus(snapshot.connection.health || '');
                  // TODO: Add toast notification for error
                }
              }}
              clearable={true}
              badgeComponent="health"
              placeholder="Add health"
              className="h-[28px] truncate"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

