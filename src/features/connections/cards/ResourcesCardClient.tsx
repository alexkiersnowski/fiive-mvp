'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ListRow } from '@/components/ui/list-row';
import { createClient } from '@/lib/supabase/client';
import { Plus, LockSimple, Eye, EyeSlash, LinkSimple, PencilSimple, LinkBreak } from '@phosphor-icons/react/dist/ssr';
import { toast } from 'sonner';
import { createConnectionResource, deleteConnectionResource, updateConnectionResource } from '../resources/actions';
import type { ConnectionSnapshot } from '../types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

type ConnectionResource = {
  id: string;
  url: string;
  label: string | null;
  clientVisible: boolean;
  createdAt: string | null;
};

const normalizeUrl = (value: string): string | null => {
  if (!value) return null;
  let trimmed = value.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsedUrl = new URL(trimmed);
    if (!parsedUrl.hostname || !parsedUrl.hostname.includes('.')) {
      return null;
    }
    return parsedUrl.toString();
  } catch {
    return null;
  }
};

const formatHostname = (url: string): string => {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const getFaviconUrl = (url: string): string | null => {
  try {
    const normalized = normalizeUrl(url);
    if (!normalized) return null;
    const parsed = new URL(normalized);
    const hostname = parsed.hostname;
    const pathname = parsed.pathname;

    if (hostname === 'docs.google.com') {
      if (pathname.includes('/spreadsheets/')) {
        return 'https://ssl.gstatic.com/images/branding/product/2x/sheets_48dp.png';
      }
      if (pathname.includes('/presentation/')) {
        return 'https://ssl.gstatic.com/images/branding/product/2x/slides_48dp.png';
      }
      if (pathname.includes('/forms/')) {
        return 'https://ssl.gstatic.com/images/branding/product/2x/forms_48dp.png';
      }
      return 'https://ssl.gstatic.com/images/branding/product/2x/docs_48dp.png';
    }

    if (hostname === 'drive.google.com') {
      return 'https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png';
    }

    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return null;
  }
};

interface ResourcesCardClientProps {
  snapshot: ConnectionSnapshot;
  context: EnhancedModeContext;
  initialResources: Array<{
    id: string;
    url: string;
    label: string | null;
    clientVisible: boolean;
    createdAt: string | null;
  }>;
}

export default function ResourcesCardClient({ snapshot, context, initialResources }: ResourcesCardClientProps) {
  const isAgency = context.variant === 'agency';
  const title = 'Resources';
  const description = isAgency 
    ? 'Add links to documents, dashboards, or folders relevant to this client.'
    : 'Your agency will share links to documents, dashboards, or folders here.';
  const buttonText = 'Add link';

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [isClientVisible, setIsClientVisible] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [resources, setResources] = useState<ConnectionResource[]>(initialResources);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const suppressCloseRef = useRef(false);

  const normalizedUrlPreview = useMemo(() => normalizeUrl(linkUrl), [linkUrl]);
  const isUrlValid = Boolean(normalizedUrlPreview);
  const hasResources = resources.length > 0;
  const showEmptyState = !hasResources;

  const resetForm = () => {
    setLinkUrl('');
    setLinkLabel('');
    setIsClientVisible(false);
    setEditingResourceId(null);
    suppressCloseRef.current = false;
  };

  const fetchResources = useCallback(async (): Promise<ConnectionResource[]> => {
    const supabase = createClient();
    let query = supabase
      .from('connection_resources')
      .select('id, url, label, client_visible, created_at')
      .eq('connection_id', snapshot.connection.id);

    if (context.variant === 'client') {
      query = query.eq('client_visible', true);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to load connection resources:', error);
      }
      return [];
    }

    const rows = (data ?? []) as Array<{
      id: string;
      url: string;
      label: string | null;
      client_visible: boolean;
      created_at: string | null;
    }>;

    return rows.map((item) => ({
      id: item.id,
      url: item.url,
      label: item.label,
      clientVisible: item.client_visible,
      createdAt: item.created_at,
    }));
  }, [context.variant, snapshot.connection.id]);

  const handleUrlChange = (value: string) => {
    setLinkUrl(value);
  };

  const handleSubmitLink = () => {
    const normalizedUrl = normalizeUrl(linkUrl);
    if (!normalizedUrl) {
      return;
    }

    startTransition(async () => {
      if (editingResourceId) {
        const updateResult = await updateConnectionResource({
          resourceId: editingResourceId,
          connectionId: snapshot.connection.id,
          url: normalizedUrl,
          label: linkLabel,
          clientVisible: isClientVisible
        });

        if (!updateResult.success) {
          toast.error(updateResult.error ?? 'Failed to update link. Please try again.');
          return;
        }

        toast.success('Link updated');
        setResources((current) =>
          current.map((resource) =>
            resource.id === editingResourceId
              ? {
                  ...resource,
                  url: normalizedUrl,
                  label: linkLabel,
                  clientVisible: isClientVisible
                }
              : resource
          )
        );
      } else {
        const result = await createConnectionResource({
          connectionId: snapshot.connection.id,
          url: normalizedUrl,
          label: linkLabel,
          clientVisible: isClientVisible,
          createdByUserId: context.user.id
        });

        if (!result.success) {
          toast.error(result.error ?? 'Failed to add link. Please try again.');
          return;
        }

        toast.success('Link added');
        const refreshedResources = await fetchResources();
        setResources(refreshedResources);
      }

      resetForm();
      setIsPopoverOpen(false);
    });
  };

  const handleRemoveResource = (resourceId: string) => {
    startTransition(async () => {
      const result = await deleteConnectionResource(resourceId, snapshot.connection.id);

      if (!result.success) {
        toast.error(result.error ?? 'Failed to remove link. Please try again.');
        return;
      }

      toast.success('Link removed');
      setResources((current) => current.filter((resource) => resource.id !== resourceId));
    });
  };

  return (
    <Card className="w-full h-full max-h-[370px] pt-5 pb-6 px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
          {title}
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
              {isAgency ? (
                <LockSimple size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              ) : (
                <Eye size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              )}
              <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>
                {isAgency ? 'Agency managed' : 'View only'}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            {isAgency 
              ? 'Only your agency can edit this' 
              : 'Only your agency can edit this'}
          </TooltipContent>
        </Tooltip>
      </div>
      {showEmptyState && description && (
        <p className="text-xs-regular text-tertiary">
          {description}
        </p>
      )}
      {hasResources && (
        <div className="flex-1 overflow-hidden relative">
          <div className="h-full overflow-auto pr-1 flex flex-col gap-2">
            {resources.map((resource) => {
              const primaryText = resource.label?.trim() || formatHostname(resource.url);
              const displayUrl = normalizeUrl(resource.url);
              const faviconUrl = getFaviconUrl(resource.url);
              const handleResourceClick = () => {
                const targetUrl = normalizeUrl(resource.url);
                if (!targetUrl) return;
                window.open(targetUrl, '_blank', 'noopener,noreferrer');
              };

              return (
                <ListRow
                  key={resource.id}
                  iconStart={
                    faviconUrl ? (
                      <img
                        src={faviconUrl}
                        alt=""
                        className="h-4 w-4 rounded-xs"
                        referrerPolicy="no-referrer"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <LinkSimple
                        size={16}
                        style={{ color: 'var(--color-interactive-neutral-default)' }}
                      />
                    )
                  }
                  text={primaryText}
                  onClick={handleResourceClick}
                  iconEnd={isAgency ? (
                    resource.clientVisible ? (
                      <Eye
                        size={14}
                        weight="fill"
                        style={{ color: 'var(--color-neutral-11)' }}
                      />
                    ) : (
                      <EyeSlash
                        size={14}
                        weight="fill"
                        style={{ color: 'var(--color-neutral-11)', opacity: 0.5 }}
                      />
                    )
                  ) : undefined}
                  iconButtonSize={24}
                  iconButtonEnd={isAgency}
                  dropdownItems={isAgency ? [
                    {
                      label: 'Edit link',
                      icon: (
                        <PencilSimple
                          size={16}
                          className="mr-2"
                          style={{ color: 'var(--color-base-text-primary)' }}
                        />
                      ),
                      onClick: () => {
                        suppressCloseRef.current = true;
                        setTimeout(() => {
                          setEditingResourceId(resource.id);
                          setLinkUrl(resource.url);
                          setLinkLabel(resource.label ?? '');
                          setIsClientVisible(resource.clientVisible);
                          setIsPopoverOpen(true);
                          requestAnimationFrame(() => {
                            suppressCloseRef.current = false;
                          });
                        }, 0);
                      },
                    },
                    {
                      label: 'Remove link',
                      destructive: true,
                      icon: (
                        <LinkBreak
                          size={16}
                          className="mr-2"
                          style={{ color: 'var(--color-red-11)' }}
                        />
                      ),
                      onClick: () => handleRemoveResource(resource.id),
                    },
                  ] : undefined}
                  className="px-3 py-2"
                  borderRadius="6px"
                />
              );
            })}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t"
            style={{
              backgroundImage:
                'linear-gradient(0deg, var(--color-base-surface-page-background, #ffffff) 0%, rgba(255, 255, 255, 0) 100%)',
            }}
          />
        </div>
      )}
      {isAgency && (
        <div className={`flex justify-end ${hasResources ? 'pt-2' : 'mt-auto'}`}>
          <Popover
            open={isPopoverOpen}
            onOpenChange={(open) => {
              if (!open && suppressCloseRef.current) {
                return;
              }
              setIsPopoverOpen(open);
              if (!open) {
                resetForm();
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 shadow-none cursor-pointer transition-all duration-75"
                onClick={() => {
                  resetForm();
                }}
              >
                <Plus size={16} weight="regular" />
                {buttonText}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={10}
              className="w-[360px] p-0 border border-[var(--color-neutral-5)]"
            >
              <div className="p-4 space-y-4">
                <div>
                  <label
                    htmlFor="resource-link-url"
                    className="text-sm font-medium block mb-2"
                    style={{ color: 'var(--color-base-text-primary, #1C2024)' }}
                  >
                    Link to
                  </label>
                  <Input
                    id="resource-link-url"
                    placeholder="Enter link"
                    value={linkUrl}
                    onChange={(event) => handleUrlChange(event.target.value)}
                    className="h-10 px-4 py-2 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="resource-link-label"
                    className="text-sm font-medium block mb-2"
                    style={{ color: 'var(--color-base-text-primary, #1C2024)' }}
                  >
                    Label
                  </label>
                  <Input
                    id="resource-link-label"
                    placeholder="Name this link"
                    value={linkLabel}
                    onChange={(event) => setLinkLabel(event.target.value)}
                    className="h-10 px-4 py-2 text-sm"
                  />
                  <p className="text-xs-regular mt-2" style={{ color: '#71757E' }}>
                    This is how your link will be displayed
                  </p>
                </div>

                <div>
                  <p
                    className="text-sm font-medium mb-2"
                    style={{ color: 'var(--color-base-text-primary, #1C2024)' }}
                  >
                    Client visible
                  </p>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={isClientVisible}
                      onCheckedChange={setIsClientVisible}
                      className="cursor-pointer"
                    />
                    {isClientVisible ? (
                      <Eye size={16} weight="fill" style={{ color: 'var(--color-neutral-11)' }} />
                    ) : (
                      <EyeSlash size={16} weight="fill" style={{ color: 'var(--color-neutral-11)', opacity: 0.5 }} />
                    )}
                    <span
                      className="text-sm-regular"
                      style={{ color: isClientVisible ? 'var(--color-base-text-primary)' : 'var(--color-base-text-tertiary)' }}
                    >
                      {isClientVisible ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="cursor-pointer text-sm h-6"
                    onClick={handleSubmitLink}
                    disabled={isPending || !isUrlValid}
                  >
                    {editingResourceId ? 'Save changes' : 'Add link'}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </Card>
  );
}

