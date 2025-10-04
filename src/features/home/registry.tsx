import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { CardConfig } from './types';

// Import stats cards
import ClientsCard from './cards/stats/ClientsCard';
import NewRequestsCard from './cards/stats/NewRequestsCard';
import ContractsEndingCard from './cards/stats/ContractsEndingCard';
import TasksDueCard from './cards/stats/TasksDueCard';

// Import other cards
import RequestsCard from './cards/RequestsCard';
import HealthCard from './cards/HealthCard';
import TasksCard from './cards/TasksCard';
import ResourcesCard from './cards/ResourcesCard';

// Pre-defined card configurations for better performance
const AGENCY_CARDS: CardConfig[] = [
  {
    key: 'clients',
    Component: ClientsCard,
  },
  {
    key: 'new-requests',
    Component: NewRequestsCard,
  },
  {
    key: 'contracts-ending-soon',
    Component: ContractsEndingCard,
  },
  {
    key: 'tasks-due-soon',
    Component: TasksDueCard,
  },
  {
    key: 'requests',
    Component: RequestsCard,
  },
  {
    key: 'health',
    Component: HealthCard,
  },
  {
    key: 'tasks',
    Component: TasksCard,
  },
  {
    key: 'agency-resources',
    Component: ResourcesCard,
  }
];

const CLIENT_CARDS: CardConfig[] = [
  {
    key: 'agencies',
    Component: ClientsCard, // Will be context-aware
  },
  {
    key: 'requests-submitted',
    Component: NewRequestsCard, // Will be context-aware
  },
  {
    key: 'requests-in-review',
    Component: ContractsEndingCard, // Will be context-aware
  },
  {
    key: 'tasks-assigned',
    Component: TasksDueCard, // Will be context-aware
  },
  {
    key: 'requests',
    Component: RequestsCard,
  },
  {
    key: 'health',
    Component: HealthCard,
  },
  {
    key: 'tasks',
    Component: TasksCard,
  },
  {
    key: 'agency-resources',
    Component: ResourcesCard,
  }
];

export function homeCardRegistry(context: EnhancedModeContext): CardConfig[] {
  // Return pre-defined cards based on context variant
  if (context.variant === 'agency') {
    return AGENCY_CARDS;
  }

  if (context.variant === 'client') {
    return CLIENT_CARDS;
  }

  return [];
}

