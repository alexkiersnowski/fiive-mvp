# Request Detail Modal - CORRECTED PLAN

## What Went Wrong

I added a `layout.tsx` file for the `/requests` route, which broke the flow:
- Your app uses: `page.tsx` → `RequestsPage` → `RequestsTable`
- No layout needed for this pattern
- Added complexity that wasn't needed

## Current Structure

```
/clients/[connectionId]/
  ├── layout.tsx (ConnectionLayout - already exists)
  ├── page.tsx (Overview)
  ├── overview/
  ├── requests/
  │   └── page.tsx → renders RequestsPage component
  ├── tasks/
  └── projects/
```

## Correct Approach

**Use Next.js Parallel Routes WITHOUT adding any layout.tsx for /requests**

### File Structure Needed

```
/clients/[connectionId]/requests/
  ├── page.tsx (already exists - renders RequestsPage)
  ├── @modal/
  │   └── (.)[requestId]/
  │       └── page.tsx (intercepts to show modal)
  └── [requestId]/
      └── page.tsx (full page view when accessed directly)
```

### Key Understanding

- `@modal` is a **parallel route slot** - Next.js auto-detects it
- NO layout.tsx needed at `/requests` level
- The modal page will automatically render over the children
- RequestsPage stays as-is, just add modal handling

## Implementation Steps

### 1. Create RequestDetailContent.tsx
**File:** `src/features/connections/requests/RequestDetailContent.tsx`
- Two-column grid (2fr:1fr)
- Props: requestId, title, description, mode

### 2. Create Intercepted Modal
**File:** `src/app/(dashboard)/clients/[connectionId]/requests/@modal/(.)[requestId]/page.tsx`
- Gets ID from params
- Wraps RequestDetailContent in Dialog
- Close: router.back()
- Expand: router.replace() to full route

### 3. Create Full Page
**File:** `src/app/(dashboard)/clients/[connectionId]/requests/[requestId]/page.tsx`
- Direct route (no interception)
- Renders RequestDetailContent directly
- Used when URL is accessed directly or refreshed

### 4. Update RequestsTable
- Add useRouter, useParams
- Add onClick handler: `router.push(/requests/${requestId}, { scroll: false })`
- Add description to mock data

### 5. Add same for Agencies
- Mirror the structure under agencies/

## Why This Works

1. **No layout.tsx** - Parallel routes don't need it when parent layout exists
2. **@modal is magic** - Next.js automatically mounts it as a slot
3. **RequestsPage unchanged** - It just renders the table
4. **Interception** - (.) pattern catches navigation and shows modal
5. **Direct URL** - Bypasses interception, shows full page

## Files Summary

**New (9 files):**
- RequestDetailContent.tsx
- @modal/(.)[requestId]/page.tsx (clients)
- @modal/(.)[requestId]/page.tsx (agencies)  
- [requestId]/page.tsx (clients)
- [requestId]/page.tsx (agencies)

**Modified (1 file):**
- RequestsTable.tsx (add onClick, router, description)

**DO NOT TOUCH:**
- RequestsPage.tsx
- Any layout.tsx files

