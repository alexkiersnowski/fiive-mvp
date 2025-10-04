import { cache } from 'react';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ClientsSnapshot, Client, ClientsPaginationOptions } from './types';

// Helper functions for cursor-based pagination
function encodeCursor(index: number): string {
  return Buffer.from(index.toString()).toString('base64');
}

function decodeCursor(cursor: string): number {
  return parseInt(Buffer.from(cursor, 'base64').toString(), 10);
}

// Cache for mock data generation
let cachedMockData: Client[] | null = null;

// Cache for month mapping to avoid recreation
const MONTH_MAP: { [key: string]: number } = {
  'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
  'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
} as const;

function generateMockData(): Client[] {
  if (cachedMockData) {
    return cachedMockData;
  }

  cachedMockData = Array.from({ length: 100 }, (_, i) => {
    const clientId = i + 1;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    
    // Deterministic contract end date based on client ID
    const hasContract = clientId % 3 === 0;
    const contractEnd = hasContract 
      ? `${(clientId % 28) + 1} ${monthNames[clientId % 6]} 2025`
      : undefined;
    
    return {
      id: `${clientId}`,
      name: `Client ${String(clientId).padStart(3, '0')}`, // Client 001, Client 002, etc.
      logo: undefined,
      status: ["draft", "onboarding", "active", "offboarded"][clientId % 4] as any,
      accountManager: { 
        name: `Manager ${String(Math.floor(i / 10) + 1).padStart(2, '0')}`,
        avatar: undefined
      },
      contractEnd,
      health: (() => {
        // Ensure we have some critical clients for testing
        if (clientId <= 10) return "critical";
        if (clientId <= 20) return "at-risk";
        if (clientId <= 30) return "healthy";
        return ["critical", "at-risk", "healthy", "unassigned"][clientId % 4] as any;
      })(),
      badge: ["Draft", "Onboarding", "Active", "Offboarded"][clientId % 4]
    };
  });

  return cachedMockData;
}

export const getClientsSnapshot = cache(async (
  context: EnhancedModeContext,
  options: ClientsPaginationOptions = {}
): Promise<ClientsSnapshot> => {
  // TODO: Replace with actual data fetching when database is ready
  // For now, return mock data for scaffolding
  
  const { search = '', cursor, limit = 50, sort = 'newest-first' } = options;
  
  // Use cached mock data to prevent regeneration on every request
  const allClients = generateMockData();

  // Apply search filter
  let filteredClients = allClients;
  if (search) {
    const query = search.toLowerCase().trim();
    
    // Pre-compute search terms for better performance
    const searchTerms = query.split(' ').filter(term => term.length > 0);
    
    filteredClients = allClients.filter(client => {
      // Early exit if no search terms
      if (searchTerms.length === 0) return true;
      
      // Create searchable text once per client
      const searchableText = [
        client.name.toLowerCase(),
        client.accountManager.name.toLowerCase(),
        client.status.toLowerCase(),
        client.health.toLowerCase(),
        client.contractEnd?.toLowerCase() || '',
        client.badge?.toLowerCase() || ''
      ].join(' ');
      
      // Check if all search terms are present
      const allTermsMatch = searchTerms.every(term => searchableText.includes(term));
      
      // Smart number matching for client names (only if query starts with 'client ')
      let numberMatch = false;
      if (query.startsWith('client ') && searchTerms.length === 1) {
        const numberPart = searchTerms[0].replace('client', '');
        if (/^\d+$/.test(numberPart)) {
          const searchNumber = parseInt(numberPart);
          const clientNumber = parseInt(client.name.replace('Client ', ''));
          numberMatch = clientNumber === searchNumber;
        }
      }
      
      return allTermsMatch || numberMatch;
    });
  }

  // Sort clients based on sort parameter
  const sortedClients = filteredClients.sort((a, b) => {
    switch (sort) {
      case 'newest-first':
        // Sort by ID descending (higher ID = newer)
        return parseInt(b.id) - parseInt(a.id);
      
      case 'alphabetical':
        return a.name.localeCompare(b.name); // A to Z
      
      case 'reverse-alphabetical':
        return b.name.localeCompare(a.name); // Z to A
      
      case 'contract-end-soonest':
        // Sort by contract end date (soonest first)
        // Clients without contracts go to the end
        if (!a.contractEnd && !b.contractEnd) return 0;
        if (!a.contractEnd) return 1;
        if (!b.contractEnd) return -1;
        
        // Parse dates (format: "DD MMM YYYY")
        const parseDate = (dateStr: string) => {
          const [day, month, year] = dateStr.split(' ');
          return new Date(parseInt(year), MONTH_MAP[month], parseInt(day));
        };
        
        const dateA = parseDate(a.contractEnd);
        const dateB = parseDate(b.contractEnd);
        return dateA.getTime() - dateB.getTime();
      
      case 'status-critical-first':
        // Sort by health priority (critical first), then alphabetically within each category
        const healthPriority = {
          'critical': 0,
          'at-risk': 1,
          'healthy': 2,
          'unassigned': 3
        };
        
        const priorityA = healthPriority[a.health as keyof typeof healthPriority] ?? 999;
        const priorityB = healthPriority[b.health as keyof typeof healthPriority] ?? 999;
        
        // If different priorities, sort by priority
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // If same priority, sort alphabetically by name
        return a.name.localeCompare(b.name);
      
      default:
        return a.name.localeCompare(b.name); // Default to A to Z
    }
  });

  // Apply cursor-based pagination
  const startIndex = cursor ? decodeCursor(cursor) : 0;
  const endIndex = startIndex + limit;
  const paginatedClients = sortedClients.slice(startIndex, endIndex);

  return {
    clients: paginatedClients,
    total: sortedClients.length,
    cursor: endIndex < sortedClients.length ? encodeCursor(endIndex) : null,
    hasNextPage: endIndex < sortedClients.length,
  };
});

export function invalidateClients(orgId: string) {
  // TODO: Implement cache invalidation when using real data
  // revalidateTag(`clients:${orgId}`);
  console.log(`Invalidating clients cache for org: ${orgId}`);
}
