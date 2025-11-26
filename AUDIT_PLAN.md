# Full System Audit: Client Creation RLS Issues

## Problem Statement
- After creating a draft client, users get signed out
- Connections table flickers (empty then loads)
- RLS policies are fragile and causing cascading failures
- Session variable dependencies are causing issues

## Root Cause Analysis

### 1. **The Session Variable Problem**
**Current State:**
- RPC function `create_draft_client_connection` sets `app.current_org_id` 
- RLS INSERT policy on organizations checks `current_setting('app.current_org_id')`
- This creates a fragile dependency chain

**Why It's Broken:**
- SECURITY DEFINER functions run with elevated privileges
- Session variables can leak into subsequent queries in the same request cycle
- Even with `true` (transaction-local), there are edge cases
- The RLS policy evaluation happens AFTER the RPC completes, causing failures

### 2. **The Join Query Problem**
**Current State:**
- `getClientsSnapshot` does: `organizations!connections_client_id_fkey` join
- This join triggers RLS policy evaluation on organizations table
- The RLS policy checks `current_setting('app.current_org_id')` which may be stale/wrong

**Why It's Broken:**
- Join queries evaluate RLS policies on BOTH tables
- If organizations RLS policy fails, entire query fails
- This causes the flickering (empty results, then retry works)

### 3. **The RLS Policy Complexity**
**Current Organizations INSERT Policy:**
```sql
((owner_id = auth.uid()) AND (created_by_agency_id IS NULL) AND (NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = auth.uid()))) 
OR 
((owner_id = auth.uid()) AND (type = 'client'::org_type) AND (is_draft = true) AND (created_by_agency_id = (current_setting('app.current_org_id'::text, true))::uuid))
```

**Problems:**
- Relies on session variable `app.current_org_id`
- Complex logic that's hard to reason about
- SECURITY DEFINER function must set this variable
- Creates fragile dependency chain

## Clean Solution

### Option 1: Remove Session Variable Dependency (RECOMMENDED)

**Principle:** RLS policies should check actual data relationships, not session state.

**Changes:**

1. **Fix Organizations INSERT Policy:**
   - Remove `current_setting('app.current_org_id')` check
   - Instead, check if user is member of the agency that matches `created_by_agency_id`
   - Use a helper function: `auth_user_is_member_of_org(created_by_agency_id)`

2. **Simplify RPC Function:**
   - Remove `set_config('app.current_org_id')` call
   - Function just inserts data - RLS policy handles authorization

3. **Fix Organizations SELECT Policy:**
   - Policy 2 already checks `created_by_agency_id` relationship
   - Ensure it works without session variables

**Benefits:**
- No session variable dependencies
- RLS policies are self-contained
- Queries work reliably
- No flickering

### Option 2: Use SECURITY DEFINER Properly

**If we must keep session variables:**

1. **Make RPC function reset session variable:**
   - Set it at start
   - Use it for INSERT
   - Explicitly reset/unset it at end

2. **Add explicit cleanup:**
   ```sql
   PERFORM set_config('app.current_org_id', NULL, true);
   ```

**Downsides:**
- Still fragile
- More complex
- Doesn't solve join query issues

## Implementation Plan (Option 1 - Recommended)

### Step 1: Create Helper Function
```sql
CREATE OR REPLACE FUNCTION auth_user_is_member_of_org(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships m
    WHERE m.user_id = auth.uid()
      AND m.org_id = auth_user_is_member_of_org.org_id
  )
  OR EXISTS (
    SELECT 1
    FROM organizations o
    WHERE o.id = auth_user_is_member_of_org.org_id
      AND o.owner_id = auth.uid()
  );
$$;
```

### Step 2: Update Organizations INSERT Policy
```sql
-- Remove session variable dependency
-- Check actual membership relationship instead
ALTER POLICY "Users can create orgs if they don't have existing membership"
ON "public"."organizations"
TO authenticated
WITH CHECK (
  -- Regular org creation (no draft)
  ((owner_id = auth.uid()) 
   AND (created_by_agency_id IS NULL) 
   AND (NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = auth.uid())))
  OR
  -- Draft client creation (check user is member of creating agency)
  ((owner_id = auth.uid()) 
   AND (type = 'client'::org_type) 
   AND (is_draft = true) 
   AND (created_by_agency_id IS NOT NULL)
   AND auth_user_is_member_of_org(created_by_agency_id))
);
```

### Step 3: Simplify RPC Function
- Remove `set_config('app.current_org_id')` call
- Function becomes simpler and more reliable

### Step 4: Fix Organizations SELECT Policy 2
- Ensure it works without session variables
- Should already work since it checks `created_by_agency_id` relationship

### Step 5: Simplify getClientsSnapshot
- Keep the join query (it should work now)
- Remove all the workarounds and fallbacks
- Clean, simple query

### Step 6: Simplify getActiveContext
- Revert to original join query
- Should work reliably now

## Testing Checklist

- [ ] Create draft client - should work without sign out
- [ ] Connections table should load immediately (no flicker)
- [ ] getActiveContext should work reliably
- [ ] No session variable dependencies
- [ ] RLS policies work correctly
- [ ] No workarounds needed

## Files to Modify

1. `supabase/migrations/20251110_create_draft_client_connection.sql` - Remove session variable
2. RLS policies (in Supabase dashboard) - Update INSERT policy
3. `src/features/clients/server.ts` - Simplify queries, remove workarounds
4. `src/lib/mode/getActiveContext.ts` - Revert to simple join query
5. Create new migration for helper function

## Success Criteria

✅ No session variable dependencies
✅ No flickering/empty states
✅ No sign-out issues
✅ Clean, simple code
✅ RLS policies are self-contained
✅ No workarounds or hacks

