# Request Detail Modal Implementation Plan

## Overview

Implement request detail view using Next.js Parallel Routes + Intercepting Routes (Linear/Jira pattern).

**Behavior:**
- Click row → Modal opens with URL change to `/requests/[requestId]`
- Direct URL → Full page view
- Modal stays over table (table remains mounted)
- Close → `router.back()` returns to `/requests`
- Expand → `router.replace()` forces full page view

## Files to Create

### 1. Shared Components (2 files)

**`src/features/connections/requests/RequestDetailContent.tsx`**
- Two-column grid layout (2fr:1fr)
- Left: Title + description
- Right: "Details" heading
- Props: requestId, title, description, mode

**`src/features/connections/requests/RequestsLayout.tsx`**
- Simple layout that renders children + modal slot
- DRY component imported by app-level layouts

### 2. App Layouts (2 files)

**`src/app/(dashboard)/clients/[connectionId]/requests/layout.tsx`**
**`src/app/(dashboard)/agencies/[connectionId]/requests/layout.tsx`**
- Thin wrappers that import RequestsLayout
- Accept children and modal props
- Required by Next.js for parallel route slots

### 3. Intercepted Modal Routes (2 files)

**`src/app/(dashboard)/clients/[connectionId]/requests/@modal/(.)requests/[requestId]/page.tsx`**
**`src/app/(dashboard)/agencies/[connectionId]/requests/@modal/(.)requests/[requestId]/page.tsx`**
- Intercepts navigation to show modal
- Wraps RequestDetailContent in Dialog
- Custom close/expand buttons
- useMemo for mock data

### 4. Full Page Routes (2 files)

**`src/app/(dashboard)/clients/[connectionId]/requests/[requestId]/page.tsx`**
**`src/app/(dashboard)/agencies/[connectionId]/requests/[requestId]/page.tsx`**
- Direct route (no interception)
- Renders RequestDetailContent without dialog
- Shows when accessed directly or refreshed

## Files to Modify

### `src/features/connections/requests/RequestsTable.tsx`

**Changes:**
1. Add imports: `useRouter`, `useParams`, `usePathname`
2. Add router hooks and baseRoute detection
3. Add `handleRowClick` function
4. Add `onClick` to TableRow
5. Add `description` field to first mock request

## Implementation Order

1. ✅ Create RequestDetailContent
2. ✅ Create RequestsLayout
3. ✅ Create app-level layout wrappers
4. ✅ Create intercepted modal routes
5. ✅ Create full page routes
6. ✅ Update RequestsTable

## Why This Works

- **No breaking changes** - RequestsPage stays untouched
- **DRY** - Shared components prevent drift
- **URL-first** - Proper history, shareable links
- **Production-grade** - Matches industry patterns (Linear/Jira)

## Testing

- [ ] `/requests` shows table
- [ ] Click row opens modal with URL change
- [ ] Modal renders over table
- [ ] Close button returns to `/requests`
- [ ] Expand button loads full page
- [ ] Direct URL shows full page
- [ ] Refresh on modal URL shows full page
- [ ] Works for both clients and agencies

---

**Ready to implement? Say "implement the plan" or "go ahead"**

