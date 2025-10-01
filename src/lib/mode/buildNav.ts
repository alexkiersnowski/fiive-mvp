 import { SquaresFour, Users, BuildingOffice, ChatCentered, CheckCircle } from '@phosphor-icons/react';
import type { Capabilities } from './types';
import type { Icon } from '@phosphor-icons/react';

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  isSelected?: boolean;
}

export function buildNav(capabilities: Capabilities, selectedItem?: string): NavItem[] {
  const items: NavItem[] = [];

  // Home (always visible)
  items.push({
    href: '/home',
    label: 'Home',
    icon: SquaresFour,
    isSelected: selectedItem === 'home',
  });

  // Clients (agency only)
  if (capabilities.canSeeClients) {
    items.push({
      href: '/clients',
      label: 'Clients',
      icon: Users,
      isSelected: selectedItem === 'clients',
    });
  }

  // Agencies (client only)
  if (capabilities.canSeeAgencies) {
    items.push({
      href: '/agencies',
      label: 'Agencies',
      icon: BuildingOffice,
      isSelected: selectedItem === 'agencies',
    });
  }

  // Requests (always visible)
  items.push({
    href: '/requests',
    label: 'Requests',
    icon: ChatCentered,
    isSelected: selectedItem === 'requests',
  });

  // Tasks (always visible for MVP)
  items.push({
    href: '/tasks',
    label: 'Tasks',
    icon: CheckCircle,
    isSelected: selectedItem === 'tasks',
  });

  return items;
}

