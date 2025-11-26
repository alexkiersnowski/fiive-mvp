'use client'

import React from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { InlineEdit } from '@/components/ui/inline-edit';
import { EyeSlash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useConnection } from '../ConnectionContext';
import { updateEngagementStatus, updateContractValue, updateContractEndDate, updateHealthStatus } from '../actions';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

// Helper function to map currency code to symbol
function getCurrencySymbol(currencyCode: 'EUR' | 'USD' | 'GBP'): string {
  const symbols = {
    EUR: '€',
    USD: '$',
    GBP: '£'
  };
  return symbols[currencyCode] || '€';
}

export default function DetailsCard({ context }: { context: EnhancedModeContext }) {
  const { snapshot, isDisconnected } = useConnection();
  const isAgency = context.variant === 'agency';

  return (
    <Card className="w-full h-full min-h-[228px] pt-5 pb-5 px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
          Overview
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
              <EyeSlash size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>Not client visible</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            {isAgency 
              ? 'Only your agency can see this' 
              : 'Only your team can see this'}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className={`flex flex-col ${isAgency ? 'gap-2' : 'gap-4'}`}>
        {/* Status Row */}
        <div className="flex items-center gap-4">
          <div className="w-2/5 min-w-0">
            <p className="text-sm-regular text-secondary truncate">{isAgency ? 'Status' : 'Live projects'}</p>
          </div>
          <div className="w-3/5 min-w-0">
            {isAgency ? (
              <InlineEdit
                type="badge"
                value={snapshot.connection.engagementStatus || ''}
                options={[
                  { value: 'onboarding', label: 'Onboarding' },
                  { value: 'active', label: 'Active' },
                  { value: 'paused', label: 'Paused' },
                  { value: 'offboarded', label: 'Offboarded' }
                ]}
                nonInteractive={isDisconnected}
                onSave={async (newValue) => {
                  try {
                    const result = await updateEngagementStatus(
                      snapshot.connection.id,
                      newValue || null
                    );
                    
                    if (!result.success) {
                      if (process.env.NODE_ENV !== 'production') {
                        console.error('Failed to update engagement status:', result.error);
                      }
                      toast.error('Failed to update engagement status');
                    } else {
                      toast.success('Engagement status updated');
                    }
                  } catch (error) {
                    if (process.env.NODE_ENV !== 'production') {
                      console.error('Error updating engagement status:', error);
                    }
                    toast.error('Failed to update engagement status');
                  }
                }}
                clearable={true}
                badgeComponent="engagement"
                className="h-[28px] truncate"
              />
            ) : (
              <p className="text-sm-regular text-tertiary truncate">{snapshot.liveProjectsCount ?? 0}</p>
            )}
          </div>
        </div>

        {/* Total Contract Value Row */}
        <div className="flex items-center gap-4">
          <div className="w-2/5 min-w-0">
            <p className="text-sm-regular text-secondary truncate">{isAgency ? 'Total Contract Value' : 'Next delivery'}</p>
          </div>
          <div className="w-3/5 min-w-0">
            {isAgency ? (
              <InlineEdit
                type="text"
                value={snapshot.connection.contractValue || ''}
                placeholder={`E.g. ${getCurrencySymbol(snapshot.agency.currencyCode)}250,000`}
                editingPlaceholder="250,000"
                currency={getCurrencySymbol(snapshot.agency.currencyCode)}
                numeric={true}
                showBorder={true}
                nonInteractive={isDisconnected}
                onSave={async (newValue) => {
                  try {
                    const result = await updateContractValue(
                      snapshot.connection.id,
                      newValue || null
                    );
                    
                    if (!result.success) {
                      if (process.env.NODE_ENV !== 'production') {
                        console.error('Failed to update contract value:', result.error);
                      }
                      toast.error('Failed to update contract value');
                    } else {
                      toast.success('Contract value updated');
                    }
                  } catch (error) {
                    if (process.env.NODE_ENV !== 'production') {
                      console.error('Error updating contract value:', error);
                    }
                    toast.error('Failed to update contract value');
                  }
                }}
                className="h-[28px] truncate"
              />
            ) : (
              <p className="text-sm-regular text-tertiary truncate">
                {snapshot.nextDeliveryDate ?? 'No upcoming deliveries'}
              </p>
            )}
          </div>
        </div>

        {/* Contract End Row */}
        <div className="flex items-center gap-4">
          <div className="w-2/5 min-w-0">
            <p className="text-sm-regular text-secondary truncate">{isAgency ? 'Contract end' : 'Requests in review'}</p>
          </div>
          <div className="w-3/5 min-w-0">
            {isAgency ? (
              <InlineEdit
                type="date"
                value={snapshot.connection.contractEnd || ''}
                placeholder="Add date"
                dateFormat="d MMM yyyy"
                nonInteractive={isDisconnected}
                onSave={async (newValue) => {
                  try {
                    const result = await updateContractEndDate(
                      snapshot.connection.id,
                      newValue || null
                    );
                    
                    if (!result.success) {
                      if (process.env.NODE_ENV !== 'production') {
                        console.error('Failed to update contract end date:', result.error);
                      }
                      toast.error('Failed to update contract end date');
                    } else {
                      toast.success('Contract end date updated');
                    }
                  } catch (error) {
                    if (process.env.NODE_ENV !== 'production') {
                      console.error('Error updating contract end date:', error);
                    }
                    toast.error('Failed to update contract end date');
                  }
                }}
                className="h-[28px] cursor-pointer truncate"
              />
            ) : (
              <p className="text-sm-regular text-tertiary truncate">{snapshot.requestsInReviewCount ?? 0}</p>
            )}
          </div>
        </div>

        {/* Health Row */}
        <div className="flex items-center gap-4">
          <div className="w-2/5 min-w-0">
            <p className="text-sm-regular text-secondary truncate">{isAgency ? 'Health' : 'Tasks assigned'}</p>
          </div>
          <div className="w-3/5 min-w-0">
            {isAgency ? (
              <InlineEdit
                type="badge"
                value={snapshot.connection.health || ''}
                options={[
                  { value: 'healthy', label: 'Healthy' },
                  { value: 'at_risk', label: 'At risk' },
                  { value: 'critical', label: 'Critical' }
                ]}
                nonInteractive={isDisconnected}
                onSave={async (newValue) => {
                  try {
                    const result = await updateHealthStatus(
                      snapshot.connection.id,
                      newValue || null
                    );
                    
                    if (!result.success) {
                      if (process.env.NODE_ENV !== 'production') {
                        console.error('Failed to update health status:', result.error);
                      }
                      toast.error('Failed to update health status');
                    } else {
                      toast.success('Health status updated');
                    }
                  } catch (error) {
                    if (process.env.NODE_ENV !== 'production') {
                      console.error('Error updating health status:', error);
                    }
                    toast.error('Failed to update health status');
                  }
                }}
                clearable={true}
                badgeComponent="health"
                placeholder="Add health"
                className="h-[28px] truncate"
              />
            ) : (
              <p className="text-sm-regular text-tertiary truncate">{snapshot.tasksAssignedCount ?? 0}</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

