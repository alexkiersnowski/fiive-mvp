-- ============================================================================
-- MVP Seed Data Script for Development/Testing
-- ============================================================================
-- This script generates realistic MVP-scale test data for UX validation.
-- It creates:
--   - ~40-60 client organizations
--   - ~40-60 connections (1 per client)
--   - ~3-5 projects per client (~160 total)
--   - ~20-40 tasks per client (~1,200 total)
--   - ~10-25 requests per connected client only (~600 total)
--
-- Usage:
--   1. Ensure you have an existing agency organization and user
--   2. Run this script in Supabase SQL Editor or via CLI
--   3. Adjust configuration variables below to scale up/down
--
-- WARNING: This script is for development/testing only. Do NOT run in production.
-- ============================================================================

-- ============================================================================
-- CONFIGURATION VARIABLES (MVP-Realistic)
-- ============================================================================
DO $$
DECLARE
  -- MVP-appropriate scale
  num_clients INTEGER := 25;
  projects_per_client_min INTEGER := 3;
  projects_per_client_max INTEGER := 5;
  tasks_per_client_min INTEGER := 200;
  tasks_per_client_max INTEGER := 200;
  requests_per_client_min INTEGER := 200;
  requests_per_client_max INTEGER := 200;
  
  -- Agency and user IDs (will be fetched from existing data)
  v_agency_id UUID;
  v_agency_owner_id UUID;
  v_agency_user_id UUID;
  
  -- Arrays for storing generated IDs
  client_ids UUID[] := ARRAY[]::UUID[];
  connection_ids UUID[] := ARRAY[]::UUID[];
  project_ids UUID[];
  client_user_ids UUID[] := ARRAY[]::UUID[];
  
  -- Temporary variables
  v_client_id UUID;
  v_connection_id UUID;
  v_connection_status connection_status;
  v_client_user_id UUID;
  
  -- Counters
  i INTEGER;
  j INTEGER;
  num_tasks INTEGER;
  num_requests INTEGER;
  num_projects INTEGER;
  
BEGIN
  -- ============================================================================
  -- SAFETY CHECK: Prevent running in production
  -- ============================================================================
  -- Uncomment the following lines to add production safety check
  -- IF current_setting('app.environment', true) = 'production' THEN
  --   RAISE EXCEPTION 'This seed script cannot be run in production environment';
  -- END IF;

  -- ============================================================================
  -- STEP 1: Get existing agency and owner
  -- ============================================================================
  SELECT id, owner_id INTO v_agency_id, v_agency_owner_id
  FROM organizations
  WHERE type = 'agency'
    AND deleted_at IS NULL
  LIMIT 1;
  
  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'No agency organization found. Please create an agency organization first.';
  END IF;
  
  -- Get a user from the agency (preferably the owner, or any member)
  SELECT user_id INTO v_agency_user_id
  FROM memberships
  WHERE org_id = v_agency_id
  ORDER BY CASE WHEN user_id = v_agency_owner_id THEN 0 ELSE 1 END
  LIMIT 1;
  
  IF v_agency_user_id IS NULL THEN
    RAISE EXCEPTION 'No active user found for agency. Please ensure the agency has at least one active member.';
  END IF;
  
  RAISE NOTICE 'Using agency ID: %, owner ID: %, user ID: %', v_agency_id, v_agency_owner_id, v_agency_user_id;

  -- ============================================================================
  -- STEP 2: Generate client organizations
  -- ============================================================================
  RAISE NOTICE 'Generating % client organizations...', num_clients;
  
  -- Generate client organizations in a loop to ensure unique connection codes
  FOR i IN 1..num_clients LOOP
    DECLARE
      v_uuid_clean TEXT;
      v_connection_code TEXT;
      v_slug TEXT;
      v_client_name TEXT;
      v_website TEXT;
      v_industry TEXT;
      v_currency currency_code;
      v_new_client_id UUID;
      v_attempts INTEGER := 0;
    BEGIN
      -- Generate unique connection code with retry loop
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
      
      -- Generate client name
      v_client_name := '[SEED] ' || CASE (i % 20)
        WHEN 0 THEN 'Acme ' || (i % 10 + 1) || ' Corp'
        WHEN 1 THEN 'Tech Solutions ' || (i % 10 + 1) || ' Inc'
        WHEN 2 THEN 'Global Industries ' || (i % 10 + 1)
        WHEN 3 THEN 'Digital Ventures ' || (i % 10 + 1)
        WHEN 4 THEN 'Innovation Labs ' || (i % 10 + 1)
        WHEN 5 THEN 'Creative Agency ' || (i % 10 + 1)
        WHEN 6 THEN 'Enterprise Solutions ' || (i % 10 + 1)
        WHEN 7 THEN 'Startup Hub ' || (i % 10 + 1)
        WHEN 8 THEN 'Business Partners ' || (i % 10 + 1)
        WHEN 9 THEN 'Strategic Group ' || (i % 10 + 1)
        WHEN 10 THEN 'Future Systems ' || (i % 10 + 1)
        WHEN 11 THEN 'Next Gen ' || (i % 10 + 1) || ' LLC'
        WHEN 12 THEN 'Prime Consulting ' || (i % 10 + 1)
        WHEN 13 THEN 'Elite Services ' || (i % 10 + 1)
        WHEN 14 THEN 'Premium Brands ' || (i % 10 + 1)
        WHEN 15 THEN 'Advanced Tech ' || (i % 10 + 1)
        WHEN 16 THEN 'Modern Solutions ' || (i % 10 + 1)
        WHEN 17 THEN 'Smart Ventures ' || (i % 10 + 1)
        WHEN 18 THEN 'Dynamic Group ' || (i % 10 + 1)
        ELSE 'Core Business ' || (i % 10 + 1)
      END;
      
      -- Generate other fields
      v_website := CASE WHEN (i % 3) = 0 THEN NULL ELSE 'https://example' || i || '.com' END;
      v_industry := CASE (i % 8)
        WHEN 0 THEN 'Technology'
        WHEN 1 THEN 'Healthcare'
        WHEN 2 THEN 'Finance'
        WHEN 3 THEN 'Retail'
        WHEN 4 THEN 'Manufacturing'
        WHEN 5 THEN 'Education'
        WHEN 6 THEN 'Media'
        ELSE 'Consulting'
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
        created_by_org_id,
        created_at,
        updated_at
      )
      VALUES (
        'client'::org_type,
        v_client_name,
        v_slug,
        v_connection_code,
        v_website,
        v_industry,
        v_currency,
        false,
        v_agency_owner_id,
        v_agency_id,
        now() - (random() * 90 || ' days')::interval,
        now() - (random() * 90 || ' days')::interval
      )
      RETURNING id INTO v_new_client_id;
      
      client_ids := array_append(client_ids, v_new_client_id);
    END;
  END LOOP;
  
  RAISE NOTICE 'Generated % client organizations', array_length(client_ids, 1);

  -- ============================================================================
  -- STEP 3: Create connections (1 per client) with realistic statuses
  -- ============================================================================
  RAISE NOTICE 'Creating connections...';
  
  FOR i IN 1..array_length(client_ids, 1) LOOP
    -- Determine connection status with realistic distribution
    -- 70% connected, 15% invited, 10% internal, 5% disconnected
    v_connection_status := CASE 
      WHEN (i % 100) < 70 THEN 'connected'::connection_status
      WHEN (i % 100) < 85 THEN 'invited'::connection_status
      WHEN (i % 100) < 95 THEN 'internal'::connection_status
      ELSE 'disconnected'::connection_status
    END;
    
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
      v_agency_id,
      client_ids[i],
      v_connection_status,
      -- Engagement status: only for connected/invited
      CASE 
        WHEN v_connection_status IN ('connected'::connection_status, 'invited'::connection_status) THEN
          CASE (i % 4)
            WHEN 0 THEN 'active'::engagement_status
            WHEN 1 THEN 'onboarding'::engagement_status
            WHEN 2 THEN 'paused'::engagement_status
            ELSE 'active'::engagement_status
          END
        ELSE NULL
      END,
      -- Health status: only for connected
      CASE 
        WHEN v_connection_status = 'connected'::connection_status THEN
          CASE (i % 5)
            WHEN 0 THEN 'healthy'::health_status
            WHEN 1 THEN 'at_risk'::health_status
            WHEN 2 THEN 'critical'::health_status
            ELSE 'healthy'::health_status
          END
        ELSE NULL
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
      NULL, -- agency_primary_contact_id (can be set later)
      NULL, -- client_primary_contact_id (can be set later)
      v_agency_id,
      now() - (random() * 90 || ' days')::interval,
      now() - (random() * 90 || ' days')::interval
    )
    RETURNING id INTO v_connection_id;
    
    connection_ids := array_append(connection_ids, v_connection_id);
  END LOOP;
  
  RAISE NOTICE 'Created % connections', array_length(connection_ids, 1);

  -- ============================================================================
  -- STEP 4: Create client users for RLS compliance
  -- ============================================================================
  -- For requests to work with RLS, we need client users
  -- We'll create fake client users (they won't have auth accounts, but profiles exist)
  -- Note: This assumes profiles can exist without auth.users (may need adjustment)
  RAISE NOTICE 'Creating client user profiles for RLS compliance...';
  
  FOR i IN 1..array_length(client_ids, 1) LOOP
    -- Create a profile for a "client user" (for RLS purposes)
    -- In real usage, these would be actual users, but for seeding we create profiles
    -- Note: This may need adjustment based on your RLS policies
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
        'seed-client-user-' || i || '@example.com',
        'Client',
        'User ' || i,
        'Manager',
        now() - (random() * 90 || ' days')::interval
      )
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_client_user_id;
    
    IF v_client_user_id IS NOT NULL THEN
      client_user_ids := array_append(client_user_ids, v_client_user_id);
      
      -- Create membership for this user in the client org
      INSERT INTO memberships (
        user_id,
        org_id,
        role,
        created_at,
        updated_at
      )
      VALUES (
        v_client_user_id,
        client_ids[i],
        'member',
        now() - (random() * 90 || ' days')::interval,
        now() - (random() * 90 || ' days')::interval
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Created client user profiles';

  -- ============================================================================
  -- STEP 5: Generate projects (~3-5 per client)
  -- ============================================================================
  RAISE NOTICE 'Generating projects...';
  
  FOR i IN 1..array_length(client_ids, 1) LOOP
    -- Random number of projects for this client
    num_projects := projects_per_client_min + floor(random() * (projects_per_client_max - projects_per_client_min + 1));
    
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
      -- Completed projects have past end dates, planned/active have future dates
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
      v_agency_user_id,
      now() - ((random() * 90) || ' days')::interval,
      now() - ((random() * 90) || ' days')::interval
    FROM generate_series(1, num_projects) proj_num;
  END LOOP;
  
  RAISE NOTICE 'Generated projects for all clients';

  -- ============================================================================
  -- STEP 6: Generate tasks (~20-40 per client, only for connected/internal)
  -- ============================================================================
  RAISE NOTICE 'Generating tasks...';
  
  FOR i IN 1..array_length(client_ids, 1) LOOP
    -- Get connection status
    SELECT connection_status INTO v_connection_status
    FROM connections
    WHERE id = connection_ids[i];
    
    -- Only generate tasks for connected or internal connections
    IF v_connection_status IN ('connected', 'internal') THEN
      -- Get projects for this connection
      SELECT ARRAY_AGG(id) INTO project_ids
      FROM projects
      WHERE connection_id = connection_ids[i]
        AND deleted_at IS NULL;
      
      -- Random number of tasks for this client
      num_tasks := tasks_per_client_min + floor(random() * (tasks_per_client_max - tasks_per_client_min + 1));
      
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
        WHEN (task_num % 10) < 3 THEN v_agency_user_id
        ELSE NULL
      END,
      v_agency_user_id, -- created_by_user_id
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
    FROM generate_series(1, num_tasks) task_num;
      
      IF i % 10 = 0 THEN
        RAISE NOTICE 'Generated tasks for client %/%', i, array_length(client_ids, 1);
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Generated tasks for all clients';

  -- ============================================================================
  -- STEP 7: Generate requests (~10-25 per client, ONLY for connected)
  -- ============================================================================
  RAISE NOTICE 'Generating requests...';
  
  FOR i IN 1..array_length(client_ids, 1) LOOP
    -- Get connection status
    SELECT connection_status INTO v_connection_status
    FROM connections
    WHERE id = connection_ids[i];
    
    -- Only generate requests for connected connections
    IF v_connection_status = 'connected' THEN
      -- Get projects for this connection
      SELECT ARRAY_AGG(id) INTO project_ids
      FROM projects
      WHERE connection_id = connection_ids[i]
        AND deleted_at IS NULL;
      
      -- Get client user ID for this client
      v_client_user_id := client_user_ids[i];
      
      -- Random number of requests for this client
      num_requests := requests_per_client_min + floor(random() * (requests_per_client_max - requests_per_client_min + 1));
      
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
        WHEN (req_num % 10) < 4 THEN v_agency_user_id
        ELSE NULL
      END,
      v_client_user_id, -- created_by_user_id (client user for RLS)
      client_ids[i], -- created_by_org_id (client org)
      now() - ((random() * 90) || ' days')::interval,
      now() - ((random() * 90) || ' days')::interval
    FROM generate_series(1, num_requests) req_num;
      
      IF i % 10 = 0 THEN
        RAISE NOTICE 'Generated requests for client %/%', i, array_length(client_ids, 1);
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Generated requests for all clients';
  RAISE NOTICE 'Seed data generation completed successfully!';
  
END $$;

-- ============================================================================
-- CLEANUP FUNCTION (Safe - only deletes [SEED] tagged data)
-- ============================================================================
-- Uncomment and run this section to clean up seed data
-- WARNING: This will delete all [SEED] tagged data. Use with caution!

/*
DO $$
DECLARE
  v_agency_id UUID;
  deleted_count INTEGER;
BEGIN
  -- Find the agency used for seeding
  SELECT id INTO v_agency_id
  FROM organizations
  WHERE type = 'agency'
    AND deleted_at IS NULL
  LIMIT 1;
  
  IF v_agency_id IS NULL THEN
    RAISE NOTICE 'No agency found. Nothing to clean up.';
    RETURN;
  END IF;
  
  -- Delete requests with [SEED] prefix (safe - only seed data)
  DELETE FROM requests
  WHERE title LIKE '[SEED]%'
    AND created_by_org_id IN (
      SELECT id FROM organizations
      WHERE type = 'client'
        AND created_by_org_id = v_agency_id
        AND name LIKE '[SEED]%'
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % seed requests', deleted_count;
  
  -- Delete tasks with [SEED] prefix (safe - only seed data)
  DELETE FROM tasks
  WHERE title LIKE '[SEED]%'
    AND created_by_org_id = v_agency_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % seed tasks', deleted_count;
  
  -- Delete projects with [SEED] prefix
  DELETE FROM projects
  WHERE name LIKE '[SEED]%'
    AND connection_id IN (
      SELECT id FROM connections
      WHERE agency_id = v_agency_id
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % seed projects', deleted_count;
  
  -- Delete connections for seed clients
  DELETE FROM connections
  WHERE agency_id = v_agency_id
    AND client_id IN (
      SELECT id FROM organizations
      WHERE type = 'client'
        AND created_by_org_id = v_agency_id
        AND name LIKE '[SEED]%'
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % seed connections', deleted_count;
  
  -- Delete client organizations with [SEED] prefix
  DELETE FROM organizations
  WHERE type = 'client'
    AND created_by_org_id = v_agency_id
    AND name LIKE '[SEED]%';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % seed client organizations', deleted_count;
  
  -- Delete seed client user profiles
  DELETE FROM profiles
  WHERE email LIKE 'seed-client-user-%@example.com';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % seed client user profiles', deleted_count;
  
  RAISE NOTICE 'Seed data cleanup completed';
END $$;
*/
