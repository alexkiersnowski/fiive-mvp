# Request Detail Modal - FINAL PLAN

## Architecture Understanding

### Current Structure
```
ConnectionLayout (wraps all [connectionId] routes)
  ├── Tabs (Overview, Requests, Tasks, Projects)
  └── Children pages from features/connections/pages/
       └── RequestsPage → renders RequestsTable
```

### What We're Adding
```
/requests/
  ├── layout.tsx ← Mounts the @modal slot alongside children
  ├── page.tsx ← Already exists (renders RequestsPage)
  ├── @modal/
  │   └── (.)requests/[requestId]/page.tsx ← Intercepts navigation, shows modal
  └── [requestId]/page.tsx ← Full page when accessed directly
```

## Pattern: Next.js Parallel Routes + Intercepting Routes

- Click row → URL changes to `/requests/[requestId]`
- Next.js intercepts → Modal renders over table
- Direct URL/refresh → Full page renders
- Close modal → `router.back()`
- Expand button → `router.replace()` forces full page

**One canonical URL, two rendering contexts.**

## Implementation Steps

### 1. Create Shared Content Component

**File:** `src/features/connections/requests/RequestDetailContent.tsx`

Minimal two-column layout:
- Props: `requestId`, `title`, `description`, `mode?: 'modal' | 'page'`
- Grid: `grid-cols-[2fr_1fr] gap-8`
- Left column: Title (h2) + description text
- Right column: "Details" heading only
- Mode prop for context-specific rendering

### 2. Create Shared Layout Component

**File:** `src/features/connections/requests/RequestsLayout.tsx`

DRY layout logic for parallel routes:

```tsx
interface RequestsLayoutProps {
  children: React.ReactNode
  modal?: React.ReactNode
}

export default function RequestsLayout({ children, modal }: RequestsLayoutProps) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
```

This centralizes the layout logic (DRY).

### 3. Create App-Level Layout Wrappers

**Files:**
- `src/app/(dashboard)/clients/[connectionId]/requests/layout.tsx`
- `src/app/(dashboard)/agencies/[connectionId]/requests/layout.tsx`

Both are thin wrappers that import the shared layout:

```tsx
import RequestsLayout from '@/features/connections/requests/RequestsLayout'
import { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
  modal?: ReactNode
}

export default function Layout({ children, modal }: LayoutProps) {
  return <RequestsLayout modal={modal}>{children}</RequestsLayout>
}
```

**Why in app directory?** Next.js routing requires layouts in `app/` to recognize parallel slots.
**Why shared component?** Keeps logic DRY; prevents client/agency drift.

### 4. Create Intercepted Modal Routes

**Files:**
- `src/app/(dashboard)/clients/[connectionId]/requests/@modal/(.)requests/[requestId]/page.tsx`
- `src/app/(dashboard)/agencies/[connectionId]/requests/@modal/(.)requests/[requestId]/page.tsx`

Intercepts navigation from table:
- Get `requestId` from params
- Wrap `RequestDetailContent` with `mode="modal"`
- Use `Dialog` component: `max-w-5xl`, padding `40px`
- Expand button: `router.replace()` to force full page view
- Close button: `router.back()`
- Mock data (useMemo for performance)
- Custom close/expand icons in top-right

### 5. Create Full Page Routes

**Files:**
- `src/app/(dashboard)/clients/[connectionId]/requests/[requestId]/page.tsx`
- `src/app/(dashboard)/agencies/[connectionId]/requests/[requestId]/page.tsx`

Direct route (no interception):
- Get `requestId` from params
- Render `RequestDetailContent` with `mode="page"`
- No dialog wrapper
- Padding: `40px`
- Same mock data as modal (useMemo)

### 6. Update RequestsTable Row Click

**Modify:** `src/features/connections/requests/RequestsTable.tsx`

Add navigation:
- Import: `useRouter`, `useParams`, `usePathname`
- Get `connectionId` from params
- Determine `baseRoute` ('clients' or 'agencies') from pathname
- Add click handler:
  ```tsx
  const handleRowClick = (requestId: string) => {
    router.push(`/${baseRoute}/${connectionId}/requests/${requestId}`, { scroll: false })
  }
  ```
- Attach `onClick={() => handleRowClick(request.id)}` to TableRow
- Shallow routing preserves scroll position

### 7. Add Mock Data

Extend mock data in `RequestsTable.tsx`:
- Add `description` field to first request:
  ```tsx
  description: 'We need to update the homepage hero section to reflect our new summer campaign. Please refresh all visual elements including the background images, CTAs, and messaging to align with the summer theme.'
  ```

## Files Summary

### New Files (9 total)

**Features (2):**
- `src/features/connections/requests/RequestDetailContent.tsx` - Shared content component
- `src/features/connections/requests/RequestsLayout.tsx` - Shared layout logic

**App Directory (7):**
- `src/app/(dashboard)/clients/[connectionId]/requests/layout.tsx` - Layout wrapper
- `src/app/(dashboard)/clients/[connectionId]/requests/@modal/(.)requests/[requestId]/page.tsx` - Intercepted modal
- `src/app/(dashboard)/clients/[connectionId]/requests/[requestId]/page.tsx` - Full page
- `src/app/(dashboard)/agencies/[connectionId]/requests/layout.tsx` - Layout wrapper
- `src/app/(dashboard)/agencies/[connectionId]/requests/@modal/(.)requests/[requestId]/page.tsx` - Intercepted modal
- `src/app/(dashboard)/agencies/[connectionId]/requests/[requestId]/page.tsx` - Full page

### Modified Files (1)

- `src/features/connections/requests/RequestsTable.tsx` - Add navigation hooks and row click handler

### Files NOT Touched

- `src/features/connections/pages/RequestsPage.tsx` - Stays exactly as-is
- `src/app/(dashboard)/clients/[connectionId]/layout.tsx` - No changes
- `src/features/connections/ConnectionLayout.tsx` - No changes

## Key Design Decisions

1. **Shared layout in features** - DRY principle, single source of truth
2. **App wrappers import shared** - Next.js requirement + code reuse
3. **Mode prop** - Enables context-aware rendering (modal vs page)
4. **`router.replace()`** - Expand button maintains history integrity
5. **`{ scroll: false }`** - Smooth UX without scroll jumping
6. **2fr:1fr grid** - Optimal readability ratio
7. **useMemo for mock data** - Prevents unnecessary re-renders

## Flow Diagram

```
User clicks row in RequestsTable
  ↓
router.push(/requests/[requestId]) with scroll: false
  ↓
Next.js routing checks for intercepting routes
  ↓
Finds @modal/(.)requests/[requestId]/page.tsx
  ↓
Renders modal OVER existing page (table stays mounted)
  ↓
URL updates to /requests/[requestId]
  ↓
User can:
  - Close (router.back() → back to /requests)
  - Expand (router.replace() → full page view)
  - Share URL (direct access bypasses interception → full page)
```

## Why This Works

1. **No breaking changes** - RequestsPage and existing structure untouched
2. **DRY** - Shared layout prevents client/agency drift
3. **Scalable** - Can add more parallel slots (@comments, @activity) easily
4. **Production-grade** - Matches Linear/Jira/Asana patterns
5. **URL-first** - Shareable, bookmarkable, proper history
6. **Simple mental model** - Layout mounts modal slot, interception routes populate it

## Testing Checklist

- [ ] `/requests` shows table
- [ ] Click row opens modal with URL change
- [ ] Modal shows over table (table visible underneath)
- [ ] Close button returns to `/requests`
- [ ] Expand button loads full page
- [ ] Direct URL `/requests/[id]` shows full page
- [ ] Refresh on modal URL shows full page
- [ ] Browser back/forward work correctly
- [ ] Same behavior for both clients and agencies

