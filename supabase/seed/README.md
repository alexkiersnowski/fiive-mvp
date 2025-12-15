# Seed Data Script

This directory contains SQL scripts for generating realistic MVP-scale test data for UX validation and stress testing.

## Overview

The `dev_seed.sql` script generates MVP-appropriate test data:
- **~40-60 client organizations** with realistic names, industries, and metadata
- **~40-60 connections** (1 per client) with proper status distributions
- **~3-5 projects per client** (~160 total) with realistic statuses and date ranges
- **~20-40 tasks per client** (~1,200 total) with proper status distribution
- **~10-25 requests per connected client only** (~600 total) with proper status distribution

**Total: ~2,000 rows** - Perfect for MVP UX testing without overwhelming the UI.

## Key Features

- **MVP-Realistic Scale**: Generates hundreds, not tens of thousands of rows
- **RLS-Compliant**: Creates proper user relationships for requests
- **Status-Aware**: Only generates tasks/requests for appropriate connection statuses
- **Safe Cleanup**: Uses `[SEED]` prefix tags for safe, targeted deletion
- **Realistic Data**: Proper status distributions, aligned dates, and realistic relationships

## Prerequisites

Before running the seed script, ensure you have:

1. **An existing agency organization** - The script will find and use an existing agency organization
2. **An active user** - The script needs at least one active user/member in the agency organization
3. **Database access** - You need access to run SQL scripts in your Supabase instance

## Usage

### Running the Script

#### Option 1: Supabase SQL Editor (Recommended)

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `dev_seed.sql`
5. Click **Run** to execute the script

#### Option 2: Supabase CLI

```bash
# If using Supabase CLI locally
supabase db execute --file supabase/seed/dev_seed.sql
```

#### Option 3: psql

```bash
# Connect to your Supabase database and run the script
psql -h <your-db-host> -U <your-user> -d <your-database> -f supabase/seed/dev_seed.sql
```

### Configuration

The script includes configuration variables at the top that you can easily adjust:

```sql
num_clients := 50;
projects_per_client_min := 3;
projects_per_client_max := 5;
tasks_per_client_min := 20;
tasks_per_client_max := 40;
requests_per_client_min := 10;
requests_per_client_max := 25;
```

**To scale up or down**, simply modify these values:
- **Small scale (testing)**: `num_clients := 10`
- **Medium scale (current)**: `num_clients := 50`
- **Large scale (stress testing)**: `num_clients := 200`

## Data Distribution

### Connection Status
- **70%** `connected` (generates tasks + requests)
- **15%** `invited` (no tasks/requests)
- **10%** `internal` (generates tasks only, no requests)
- **5%** `disconnected` (no tasks/requests)

### Project Status
- **30%** `active` (have future end dates)
- **25%** `planned` (have future end dates)
- **20%** `completed` (have past end dates)
- **15%** `on_hold` (some have end dates, some don't)
- **10%** `cancelled` (no end dates)

### Task Status
- **60%** `to_do`
- **25%** `in_progress`
- **10%** `on_hold`
- **5%** `done` (with `due_date < completed_at`)

### Request Status
- **30%** `new`
- **25%** `in_review`
- **20%** `accepted`
- **15%** `closed`
- **10%** `canceled`

### Other Distributions
- **60%** of tasks have a project assigned, **40%** are standalone
- **50%** of requests have a project assigned, **50%** are standalone
- **30%** of tasks are assigned to users, **70%** are unassigned
- **40%** of requests are assigned to users, **60%** are unassigned
- **80%** of tasks are client-visible, **20%** are hidden
- **60%** of connections have contracts, **40%** don't

## Important Notes

### Seed Data Tagging

All seed data is tagged with `[SEED]` prefix:
- Client organizations: `[SEED] Acme Corp`
- Projects: `[SEED] Website Redesign`
- Tasks: `[SEED] Review design mockups`
- Requests: `[SEED] Request for new feature`

This allows safe cleanup without affecting manually created data.

### RLS Compliance

The script creates client user profiles for RLS compliance:
- Creates profiles for each client organization
- Creates memberships linking users to client orgs
- Uses client users when creating requests (not agency users)

**Note**: If your RLS policies require actual `auth.users` entries, you may need to adjust the client user creation logic.

### Connection Status Logic

The script respects connection statuses:
- **Connected**: Generates both tasks and requests
- **Internal**: Generates tasks only (no client requests)
- **Invited/Disconnected**: No tasks or requests generated

This creates realistic data patterns matching real-world usage.

### Date Alignment

The script ensures realistic date relationships:
- **Completed tasks**: `due_date < completed_at`
- **Completed projects**: `end_date` is in the past
- **Active/Planned projects**: `end_date` is in the future
- **Timestamps**: Spread over the last 90 days

## Cleanup

The script includes a safe cleanup function (commented out by default) that only deletes `[SEED]` tagged data:

1. Uncomment the cleanup section at the bottom of `dev_seed.sql`
2. Run just that section
3. It will safely delete only seed data, preserving any manually created data

**Safety**: The cleanup function uses `LIKE '[SEED]%'` filters, so it will never delete your real data.

## Troubleshooting

### Error: "No agency organization found"

**Solution**: Create an agency organization first through the application UI or manually in the database.

### Error: "No active user found for agency"

**Solution**: Ensure the agency organization has at least one active member. You can check this in the `memberships` table.

### Error: RLS policy violation on requests

**Solution**: The script creates client user profiles, but if your RLS requires actual `auth.users` entries, you may need to:
1. Create actual user accounts for each client, or
2. Adjust the RLS policies for seed data, or
3. Modify the script to use existing client users

### Script runs slowly

**Solution**: For the MVP scale (50 clients), this should run quickly. If it's slow:
1. Check database performance metrics
2. Ensure indexes are properly created
3. Consider running during off-peak hours

### Foreign key constraint errors

**Solution**: Ensure all referenced tables exist and have proper relationships. The script assumes standard Supabase schema.

## Best Practices

1. **Run in development/staging only** - Never run seed scripts in production
2. **Backup first** - Consider backing up your database before running seed scripts
3. **Test incrementally** - Start with smaller numbers (e.g., 10 clients) to verify the script works
4. **Use cleanup regularly** - Clean up seed data between test runs to avoid confusion
5. **Tag your data** - The `[SEED]` prefix helps distinguish test data from real data

## Scaling Examples

### Small Scale (Quick Testing)
```sql
num_clients := 10;
projects_per_client_min := 2;
projects_per_client_max := 3;
tasks_per_client_min := 10;
tasks_per_client_max := 20;
requests_per_client_min := 5;
requests_per_client_max := 10;
```
**Result**: ~10 clients, ~25 projects, ~150 tasks, ~75 requests

### Medium Scale (Current Default - MVP Realistic)
```sql
num_clients := 50;
projects_per_client_min := 3;
projects_per_client_max := 5;
tasks_per_client_min := 20;
tasks_per_client_max := 40;
requests_per_client_min := 10;
requests_per_client_max := 25;
```
**Result**: ~50 clients, ~200 projects, ~1,500 tasks, ~875 requests

### Large Scale (Stress Testing)
```sql
num_clients := 200;
projects_per_client_min := 5;
projects_per_client_max := 10;
tasks_per_client_min := 50;
tasks_per_client_max := 100;
requests_per_client_min := 25;
requests_per_client_max := 50;
```
**Result**: ~200 clients, ~1,500 projects, ~15,000 tasks, ~7,500 requests

## What Changed from Original

This version fixes critical issues:

1. ✅ **Fixed RETURNING clause** - Removed invalid multi-row RETURNING
2. ✅ **Removed connection_code** - Let it be auto-generated by triggers/RPCs
3. ✅ **Reduced to MVP scale** - Hundreds, not tens of thousands
4. ✅ **Fixed RLS compliance** - Creates client users for requests
5. ✅ **Status-aware generation** - Only generates data for appropriate connection statuses
6. ✅ **Fixed date alignment** - Completed tasks have `due_date < completed_at`
7. ✅ **Safe cleanup** - Uses `[SEED]` tags for targeted deletion
8. ✅ **Realistic health/engagement** - Only set when connection status allows

## Notes

- The script uses `generate_series()` for efficient bulk inserts
- All data respects foreign key constraints and RLS policies
- Enum values match the application schema exactly
- The script is idempotent - you can run it multiple times (though it will create duplicate data)
- For true idempotency, use the cleanup function first, then run the seed script
- All seed data is tagged with `[SEED]` prefix for easy identification and safe cleanup
