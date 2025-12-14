-- ============================================================================
-- Client Seed Data Script for Development/Testing
-- ============================================================================
-- This script generates realistic seed data for a client organization.
-- It creates:
--   - 1 client organization (or uses existing)
--   - Up to 10 agency organizations
--   - 10 connections (1 per agency)
--   - 4 projects per connection (40 total)
--   - 200 tasks per connection (2,000 total)
--   - 200 requests per connection (2,000 total)
--
-- Usage:
--   1. Run this script in Supabase SQL Editor or via CLI
--   2. Adjust configuration variables below to scale up/down
--
-- WARNING: This script is for development/testing only. Do NOT run in production.
-- ============================================================================

-- ============================================================================
-- CONFIGURATION VARIABLES
-- ============================================================================
DO $$
DECLARE
  -- Configuration
  num_connections INTEGER := 10;
  projects_per_connection INTEGER := 4;
  tasks_per_connection INTEGER := 200;
  requests_per_connection INTEGER := 200;
  
  -- Client and user IDs (will be fetched from existing data or created)
  v_client_id UUID;
  v_client_owner_id UUID;
  v_client_user_id UUID;
  
  -- Arrays for storing generated IDs
  agency_ids UUID[] := ARRAY[]::UUID[];
  connection_ids UUID[] := ARRAY[]::UUID[];
  project_ids UUID[];
  agency_user_ids UUID[] := ARRAY[]::UUID[];
  
  -- Temporary variables
  v_agency_id UUID;
  v_connection_id UUID;
  v_connection_status connection_status;
  v_agency_user_id UUID;
  
  -- Counters
  i INTEGER;
  num_tasks INTEGER;
  num_requests INTEGER;
  
BEGIN
  -- ============================================================================
  -- SAFETY CHECK: Prevent running in production
  -- ============================================================================
  -- Uncomment the following lines to add production safety check
  -- IF current_setting('app.environment', true) = 'production' THEN
  --   RAISE EXCEPTION 'This seed script cannot be run in production environment';
  -- END IF;

  -- ============================================================================
  -- STEP 1: Get or use existing client and owner
  -- ============================================================================
  SELECT id, owner_id INTO v_client_id, v_client_owner_id
  FROM organizations
  WHERE type = 'client'
    AND deleted_at IS NULL
  LIMIT 1;
  
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'No client organization found. Please create a client organization first.';
  END IF;
  
  -- Get a user from the client (preferably the owner, or any member)
  SELECT user_id INTO v_client_user_id
  FROM memberships
  WHERE org_id = v_client_id
  ORDER BY CASE WHEN user_id = v_client_owner_id THEN 0 ELSE 1 END
  LIMIT 1;
  
  IF v_client_user_id IS NULL THEN
    RAISE EXCEPTION 'No active user found for client. Please ensure the client has at least one active member.';
  END IF;
  
  RAISE NOTICE 'Using client ID: %, owner ID: %, user ID: %', v_client_id, v_client_owner_id, v_client_user_id;

  -- ============================================================================
  -- STEP 2: Generate agency organizations
  -- ============================================================================
  RAISE NOTICE 'Generating % agency organizations...', num_connections;
  
  -- Generate agency organizations in a loop
  FOR i IN 1..num_connections LOOP
    DECLARE
      v_uuid_clean TEXT;
      v_connection_code TEXT;
      v_slug TEXT;
      v_agency_name TEXT;
      v_website TEXT;
      v_industry TEXT;
      v_currency currency_code;
      v_new_agency_id UUID;
      v_attempts INTEGER := 0;
    BEGIN
      -- Generate unique connection code and slug with retry loop
      LOOP
        v_uuid_clean := lower(replace(gen_random_uuid()::text, '-', ''));
        v_connection_code := 
          substr(v_uuid_clean, 1, 4) || '-' ||
          substr(v_uuid_clean, 5, 4) || '-' ||
          substr(v_uuid_clean, 9, 4) || '-' ||
          substr(v_uuid_clean, 13, 4) || '-' ||
          substr(v_uuid_clean, 17, 4);
        v_slug := v_connection_code;
        
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM organizations WHERE connection_code = v_connection_code OR slug = v_slug
        );
        
        v_attempts := v_attempts + 1;
        IF v_attempts > 10 THEN
          RAISE EXCEPTION 'Could not generate unique connection code after 10 attempts';
        END IF;
      END LOOP;
      
      -- Generate agency name
      v_agency_name := '[SEED] ' || CASE (i % 15)
        WHEN 0 THEN 'Creative Agency ' || i
        WHEN 1 THEN 'Digital Solutions ' || i || ' Inc'
        WHEN 2 THEN 'Marketing Partners ' || i
        WHEN 3 THEN 'Design Studio ' || i
        WHEN 4 THEN 'Tech Agency ' || i || ' LLC'
        WHEN 5 THEN 'Brand Consultants ' || i
        WHEN 6 THEN 'Media Group ' || i
        WHEN 7 THEN 'Innovation Labs ' || i
        WHEN 8 THEN 'Strategic Partners ' || i
        WHEN 9 THEN 'Growth Agency ' || i
        WHEN 10 THEN 'Creative Collective ' || i
        WHEN 11 THEN 'Digital Ventures ' || i
        WHEN 12 THEN 'Marketing Hub ' || i
        WHEN 13 THEN 'Design Co ' || i
        ELSE 'Agency Partners ' || i
      END;
      
      -- Generate other fields
      v_website := CASE WHEN (i % 3) = 0 THEN NULL ELSE 'https://agency' || i || '.example.com' END;
      v_industry := CASE (i % 8)
        WHEN 0 THEN 'Technology'
        WHEN 1 THEN 'Marketing'
        WHEN 2 THEN 'Design'
        WHEN 3 THEN 'Consulting'
        WHEN 4 THEN 'Media'
        WHEN 5 THEN 'Advertising'
        WHEN 6 THEN 'Branding'
        ELSE 'Digital'
      END;
      v_currency := CASE (i % 3)
        WHEN 0 THEN 'USD'::currency_code
        WHEN 1 THEN 'EUR'::currency_code
        ELSE 'GBP'::currency_code
      END;
      
      -- Insert organization
      INSERT INTO organizations (
        type,
        name,
        slug,
        connection_code,
        website,
        industry,
        currency_code,
        is_draft,
        owner_id,
        created_at,
        updated_at
      )
      VALUES (
        'agency'::org_type,
        v_agency_name,
        v_slug,
        v_connection_code,
        v_website,
        v_industry,
        v_currency,
        false,
        v_client_owner_id, -- Use client owner as placeholder (in real scenario, agencies have their own owners)
        now() - (random() * 90 || ' days')::interval,
        now() - (random() * 90 || ' days')::interval
      )
      RETURNING id INTO v_new_agency_id;
      
      agency_ids := array_append(agency_ids, v_new_agency_id);
      
      -- Create a profile for an "agency user" (for RLS purposes)
      INSERT INTO profiles (
        id,
        email,
        first_name,
        last_name,
        job_title,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        'seed-agency-user-' || i || '@example.com',
        'Agency',
        'User ' || i,
        'Account Manager',
        now() - (random() * 90 || ' days')::interval
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id INTO v_agency_user_id;
      
      IF v_agency_user_id IS NOT NULL THEN
        agency_user_ids := array_append(agency_user_ids, v_agency_user_id);
        
        -- Create membership for this user in the agency org
        INSERT INTO memberships (
          user_id,
          org_id,
          role,
          created_at,
          updated_at
        )
        VALUES (
          v_agency_user_id,
          v_new_agency_id,
          'member',
          now() - (random() * 90 || ' days')::interval,
          now() - (random() * 90 || ' days')::interval
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END;
  END LOOP;
  
  RAISE NOTICE 'Generated % agency organizations', array_length(agency_ids, 1);

  -- ============================================================================
  -- STEP 3: Create connections (1 per agency) - all connected
  -- ============================================================================
  RAISE NOTICE 'Creating connections...';
  
  FOR i IN 1..array_length(agency_ids, 1) LOOP
    -- All connections are 'connected' for realistic seed data
    v_connection_status := 'connected'::connection_status;
    
    INSERT INTO connections (
      agency_id,
      client_id,
      connection_status,
      engagement_status,
      health_status,
      contract_end_on,
      contract_value,
      agency_primary_contact_id,
      client_primary_contact_id,
      created_by_org_id,
      created_at,
      updated_at
    )
    VALUES (
      agency_ids[i],
      v_client_id,
      v_connection_status,
      'active'::engagement_status,
      CASE (i % 5)
        WHEN 0 THEN 'healthy'::health_status
        WHEN 1 THEN 'at_risk'::health_status
        WHEN 2 THEN 'critical'::health_status
        ELSE 'healthy'::health_status
      END,
      -- Contract end date (60% have contracts, 40% don't)
      CASE 
        WHEN (i % 10) < 6 THEN now() + ((random() * 365 + 30) || ' days')::interval
        ELSE NULL
      END,
      -- Contract value (when contract exists)
      CASE 
        WHEN (i % 10) < 6 THEN (random() * 500000 + 10000)::numeric(12, 2)
        ELSE NULL
      END,
      agency_user_ids[i], -- agency_primary_contact_id
      v_client_user_id, -- client_primary_contact_id
      v_client_id, -- created_by_org_id (client creates the connection)
      now() - (random() * 90 || ' days')::interval,
      now() - (random() * 90 || ' days')::interval
    )
    RETURNING id INTO v_connection_id;
    
    connection_ids := array_append(connection_ids, v_connection_id);
  END LOOP;
  
  RAISE NOTICE 'Created % connections', array_length(connection_ids, 1);

  -- ============================================================================
  -- STEP 4: Generate projects (4 per connection)
  -- ============================================================================
  RAISE NOTICE 'Generating projects...';
  
  FOR i IN 1..array_length(connection_ids, 1) LOOP
    INSERT INTO projects (
      connection_id,
      name,
      status,
      start_date,
      end_date,
      created_by_user_id,
      created_at,
      updated_at
    )
    SELECT
      connection_ids[i],
      -- Project names with [SEED] prefix
      '[SEED] ' || CASE (proj_num % 10)
        WHEN 0 THEN 'Website Redesign'
        WHEN 1 THEN 'Mobile App Development'
        WHEN 2 THEN 'Brand Identity'
        WHEN 3 THEN 'Marketing Campaign'
        WHEN 4 THEN 'E-commerce Platform'
        WHEN 5 THEN 'Content Strategy'
        WHEN 6 THEN 'SEO Optimization'
        WHEN 7 THEN 'Social Media Management'
        WHEN 8 THEN 'Product Launch'
        ELSE 'Consulting Project'
      END || ' ' || proj_num,
      -- Status distribution: 30% active, 25% planned, 20% completed, 15% on_hold, 10% canceled
      CASE 
        WHEN (proj_num % 20) < 6 THEN 'active'::project_status
        WHEN (proj_num % 20) < 11 THEN 'planned'::project_status
        WHEN (proj_num % 20) < 15 THEN 'completed'::project_status
        WHEN (proj_num % 20) < 18 THEN 'on_hold'::project_status
        ELSE 'canceled'::project_status
      END,
      -- Start date (spread over last 90 days)
      now() - ((random() * 90) || ' days')::interval,
      -- End date: align with status
      CASE 
        WHEN (proj_num % 20) < 6 THEN -- active
          now() + ((random() * 180) || ' days')::interval
        WHEN (proj_num % 20) < 11 THEN -- planned
          now() + ((random() * 365) || ' days')::interval
        WHEN (proj_num % 20) < 15 THEN -- completed
          now() - ((random() * 30) || ' days')::interval
        WHEN (proj_num % 20) < 18 THEN -- on_hold
          CASE WHEN (proj_num % 2) = 0 THEN NULL ELSE now() + ((random() * 90) || ' days')::interval END
        ELSE -- canceled
          NULL
      END,
      agency_user_ids[i], -- created_by_user_id (agency user)
      now() - ((random() * 90) || ' days')::interval,
      now() - ((random() * 90) || ' days')::interval
    FROM generate_series(1, projects_per_connection) proj_num;
  END LOOP;
  
  RAISE NOTICE 'Generated projects for all connections';

  -- ============================================================================
  -- STEP 5: Generate tasks (200 per connection)
  -- ============================================================================
  RAISE NOTICE 'Generating tasks...';
  
  FOR i IN 1..array_length(connection_ids, 1) LOOP
    -- Get projects for this connection
    SELECT ARRAY_AGG(id) INTO project_ids
    FROM projects
    WHERE connection_id = connection_ids[i]
      AND deleted_at IS NULL;
    
    INSERT INTO tasks (
      connection_id,
      project_id,
      title,
      description,
      status,
      assignee_user_id,
      created_by_user_id,
      due_date,
      completed_at,
      client_visible,
      created_at,
      updated_at
    )
    SELECT
      connection_ids[i],
      -- 60% have project, 40% standalone
      CASE 
        WHEN (task_num % 10) < 6 AND array_length(project_ids, 1) > 0 
        THEN project_ids[1 + (task_num % array_length(project_ids, 1))]
        ELSE NULL
      END,
      -- Task titles with [SEED] prefix
      '[SEED] ' || CASE (task_num % 15)
        WHEN 0 THEN 'Review design mockups'
        WHEN 1 THEN 'Update project documentation'
        WHEN 2 THEN 'Conduct user research'
        WHEN 3 THEN 'Implement new feature'
        WHEN 4 THEN 'Fix bug in production'
        WHEN 5 THEN 'Write test cases'
        WHEN 6 THEN 'Code review'
        WHEN 7 THEN 'Deploy to staging'
        WHEN 8 THEN 'Update dependencies'
        WHEN 9 THEN 'Create wireframes'
        WHEN 10 THEN 'Write API documentation'
        WHEN 11 THEN 'Optimize database queries'
        WHEN 12 THEN 'Set up monitoring'
        WHEN 13 THEN 'Refactor legacy code'
        ELSE 'Prepare presentation'
      END || ' ' || task_num,
      -- Task descriptions
      CASE (task_num % 5)
        WHEN 0 THEN 'This task requires careful attention to detail and collaboration with the team.'
        WHEN 1 THEN 'Please review all related documentation before starting this task.'
        WHEN 2 THEN 'This is a high-priority item that needs to be completed by the deadline.'
        WHEN 3 THEN 'Coordinate with stakeholders to ensure requirements are met.'
        ELSE 'Follow the established process and update the project board accordingly.'
      END,
      -- Status distribution: 60% to_do, 25% in_progress, 10% on_hold, 5% done
      CASE 
        WHEN (task_num % 100) < 60 THEN 'to_do'::task_status
        WHEN (task_num % 100) < 85 THEN 'in_progress'::task_status
        WHEN (task_num % 100) < 95 THEN 'on_hold'::task_status
        ELSE 'done'::task_status
      END,
      -- Assignee: 30% assigned, 70% unassigned
      CASE 
        WHEN (task_num % 10) < 3 THEN agency_user_ids[i]
        ELSE NULL
      END,
      agency_user_ids[i], -- created_by_user_id (agency user)
      -- Due date: for done tasks, ensure due_date < completed_at
      CASE 
        WHEN (task_num % 100) >= 95 THEN -- done tasks
          now() - ((random() * 60 + 10) || ' days')::interval
        WHEN (task_num % 5) = 0 THEN -- some tasks have no due date
          NULL
        ELSE -- other tasks have future or recent due dates
          now() - ((random() * 30) || ' days')::interval + ((random() * 60) || ' days')::interval
      END,
      -- Completed at: only for 'done' tasks, ensure it's after due_date
      CASE 
        WHEN (task_num % 100) >= 95 THEN 
          now() - ((random() * 30) || ' days')::interval
        ELSE NULL
      END,
      -- Client visible: 80% visible, 20% hidden
      (task_num % 10) < 8,
      now() - ((random() * 90) || ' days')::interval,
      now() - ((random() * 90) || ' days')::interval
    FROM generate_series(1, tasks_per_connection) task_num;
    
    IF i % 2 = 0 THEN
      RAISE NOTICE 'Generated tasks for connection %/%', i, array_length(connection_ids, 1);
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Generated tasks for all connections';

  -- ============================================================================
  -- STEP 6: Generate requests (200 per connection)
  -- ============================================================================
  RAISE NOTICE 'Generating requests...';
  
  FOR i IN 1..array_length(connection_ids, 1) LOOP
    -- Get projects for this connection
    SELECT ARRAY_AGG(id) INTO project_ids
    FROM projects
    WHERE connection_id = connection_ids[i]
      AND deleted_at IS NULL;
    
    INSERT INTO requests (
      connection_id,
      project_id,
      title,
      description,
      status,
      assignee_user_id,
      created_by_user_id,
      created_by_org_id,
      created_at,
      updated_at
    )
    SELECT
      connection_ids[i],
      -- 50% have project, 50% standalone
      CASE 
        WHEN (req_num % 2) = 0 AND array_length(project_ids, 1) > 0 
        THEN project_ids[1 + (req_num % array_length(project_ids, 1))]
        ELSE NULL
      END,
      -- Request titles with [SEED] prefix
      '[SEED] ' || CASE (req_num % 12)
        WHEN 0 THEN 'Request for new feature'
        WHEN 1 THEN 'Bug fix needed'
        WHEN 2 THEN 'Content update request'
        WHEN 3 THEN 'Design revision'
        WHEN 4 THEN 'Access permission request'
        WHEN 5 THEN 'Integration request'
        WHEN 6 THEN 'Performance optimization'
        WHEN 7 THEN 'Security review'
        WHEN 8 THEN 'Data export request'
        WHEN 9 THEN 'Account settings change'
        WHEN 10 THEN 'Feature enhancement'
        ELSE 'General inquiry'
      END || ' ' || req_num,
      -- Request descriptions
      CASE (req_num % 6)
        WHEN 0 THEN 'We need this implemented as soon as possible to meet our business requirements.'
        WHEN 1 THEN 'This is blocking our team from moving forward with the project.'
        WHEN 2 THEN 'Please review and provide feedback on the proposed changes.'
        WHEN 3 THEN 'This request aligns with our Q4 goals and should be prioritized.'
        WHEN 4 THEN 'We have discussed this internally and believe this is the best approach.'
        ELSE 'Looking forward to your response and implementation timeline.'
      END,
      -- Status distribution: 30% new, 25% in_review, 20% accepted, 15% closed, 10% canceled
      CASE 
        WHEN (req_num % 100) < 30 THEN 'new'::request_status
        WHEN (req_num % 100) < 55 THEN 'in_review'::request_status
        WHEN (req_num % 100) < 75 THEN 'accepted'::request_status
        WHEN (req_num % 100) < 90 THEN 'closed'::request_status
        ELSE 'canceled'::request_status
      END,
      -- Assignee: 40% assigned, 60% unassigned
      CASE 
        WHEN (req_num % 10) < 4 THEN agency_user_ids[i]
        ELSE NULL
      END,
      v_client_user_id, -- created_by_user_id (client user for RLS)
      v_client_id, -- created_by_org_id (client org)
      now() - ((random() * 90) || ' days')::interval,
      now() - ((random() * 90) || ' days')::interval
    FROM generate_series(1, requests_per_connection) req_num;
    
    IF i % 2 = 0 THEN
      RAISE NOTICE 'Generated requests for connection %/%', i, array_length(connection_ids, 1);
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Generated requests for all connections';
  RAISE NOTICE 'Client seed data generation completed successfully!';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Client: %', v_client_id;
  RAISE NOTICE '  - Agencies: %', array_length(agency_ids, 1);
  RAISE NOTICE '  - Connections: %', array_length(connection_ids, 1);
  RAISE NOTICE '  - Projects: % (4 per connection)', array_length(connection_ids, 1) * projects_per_connection;
  RAISE NOTICE '  - Tasks: % (200 per connection)', array_length(connection_ids, 1) * tasks_per_connection;
  RAISE NOTICE '  - Requests: % (200 per connection)', array_length(connection_ids, 1) * requests_per_connection;
  
END $$;

-- ============================================================================
-- CLEANUP FUNCTION (Safe - only deletes [SEED] tagged data)
-- ============================================================================
-- Uncomment and run this section to clean up seed data
-- WARNING: This will delete all [SEED] tagged data. Use with caution!

/*
DO $$
DECLARE
  v_client_id UUID;
  deleted_count INTEGER;
BEGIN
  -- Find the client used for seeding
  SELECT id INTO v_client_id
  FROM organizations
  WHERE type = 'client'
    AND deleted_at IS NULL
  LIMIT 1;
  
  IF v_client_id IS NULL THEN
    RAISE NOTICE 'No client found. Nothing to clean up.';
    RETURN;
  END IF;
  
  -- Delete requests with [SEED] prefix
  DELETE FROM requests
  WHERE title LIKE '[SEED]%'
    AND created_by_org_id = v_client_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % seed requests', deleted_count;
  
  -- Delete tasks with [SEED] prefix
  DELETE FROM tasks
  WHERE title LIKE '[SEED]%'
    AND connection_id IN (
      SELECT id FROM connections
      WHERE client_id = v_client_id
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % seed tasks', deleted_count;
  
  -- Delete projects with [SEED] prefix
  DELETE FROM projects
  WHERE name LIKE '[SEED]%'
    AND connection_id IN (
      SELECT id FROM connections
      WHERE client_id = v_client_id
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % seed projects', deleted_count;
  
  -- Delete connections for seed agencies
  DELETE FROM connections
  WHERE client_id = v_client_id
    AND agency_id IN (
      SELECT id FROM organizations
      WHERE type = 'agency'
        AND name LIKE '[SEED]%'
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % seed connections', deleted_count;
  
  -- Delete agency organizations with [SEED] prefix
  DELETE FROM organizations
  WHERE type = 'agency'
    AND name LIKE '[SEED]%';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % seed agency organizations', deleted_count;
  
  -- Delete seed agency user profiles
  DELETE FROM profiles
  WHERE email LIKE 'seed-agency-user-%@example.com';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % seed agency user profiles', deleted_count;
  
  RAISE NOTICE 'Client seed data cleanup completed';
END $$;
*/
