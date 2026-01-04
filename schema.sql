--
-- PostgreSQL database dump
--

\restrict OEyGs4Kl6JnwNkntsJi9jyTpageEUedCntXFrJgx3MVi832H1Iuha4Dn0l1AJpb

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: billing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.billing_status AS ENUM (
    'free',
    'active',
    'past_due',
    'canceled_pending'
);


--
-- Name: TYPE billing_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.billing_status IS 'Customers billing status in Stripe';


--
-- Name: connection_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.connection_status AS ENUM (
    'internal',
    'invited',
    'connected',
    'disconnected'
);


--
-- Name: TYPE connection_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.connection_status IS 'Connection status of a linked agency and client';


--
-- Name: currency_code; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.currency_code AS ENUM (
    'EUR',
    'USD',
    'GBP'
);


--
-- Name: TYPE currency_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.currency_code IS 'Currency codes (EUR, USD, GBP)';


--
-- Name: engagement_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.engagement_status AS ENUM (
    'onboarding',
    'active',
    'paused',
    'offboarded'
);


--
-- Name: TYPE engagement_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.engagement_status IS 'Engagement status of a linked agency and client';


--
-- Name: health_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.health_status AS ENUM (
    'healthy',
    'at_risk',
    'critical'
);


--
-- Name: TYPE health_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.health_status IS 'Health status of a linked agency and client';


--
-- Name: member_invitation_status ; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."member_invitation_status " AS ENUM (
    'pending',
    'accepted',
    'expired'
);


--
-- Name: TYPE "member_invitation_status "; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public."member_invitation_status " IS 'Member invitation status';


--
-- Name: org_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.org_type AS ENUM (
    'agency',
    'client'
);


--
-- Name: TYPE org_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.org_type IS 'Organization type (agency or client)';


--
-- Name: project_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_status AS ENUM (
    'planned',
    'active',
    'on_hold',
    'completed',
    'canceled'
);


--
-- Name: TYPE project_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.project_status IS 'Project status of a linked agency and client';


--
-- Name: request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.request_status AS ENUM (
    'new',
    'in_review',
    'closed',
    'accepted',
    'canceled'
);


--
-- Name: TYPE request_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.request_status IS 'Status of requests submitted from clients to their agencies';


--
-- Name: request_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.request_type AS ENUM (
    'general',
    'project'
);


--
-- Name: TYPE request_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.request_type IS 'Type of request submitted by clients to their agencies';


--
-- Name: role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.role AS ENUM (
    'member'
);


--
-- Name: TYPE role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.role IS 'Role type for members of organizations';


--
-- Name: task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_status AS ENUM (
    'to_do',
    'in_progress',
    'on_hold',
    'done'
);


--
-- Name: TYPE task_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.task_status IS 'Status of tasks created by agencies';


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: _lock_membership_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._lock_membership_identity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.org_id <> old.org_id then
    raise exception 'org_id is immutable';
  end if;
  if new.user_id <> old.user_id then
    raise exception 'user_id is immutable';
  end if;
  return new;
end $$;


--
-- Name: _lock_membership_org(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._lock_membership_org() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  -- null-safe compare + clear SQLSTATE for constraint-style failure
  if new.org_id is distinct from old.org_id then
    raise exception using
      errcode = '23514',            -- check_violation
      message = 'org_id is immutable';
  end if;
  return new;
end
$$;


--
-- Name: _trigger_exists(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._trigger_exists(p_schema text, p_table text, p_trigger text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = p_schema
      and c.relname = p_table
      and t.tgname  = p_trigger
      and not t.tgisinternal
  );
$$;


--
-- Name: auth_user_is_member_of(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_user_is_member_of(p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
  );
$$;


--
-- Name: auth_user_is_member_of_connected_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_user_is_member_of_connected_org(p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  /*
    Purpose:
    Allow users to access data from organizations connected
    to any organization they are a member of.

    Example:
      - User is a member of Agency A
      - Agency A is connected to Client B
      => user can see Client B’s data (memberships, etc.)
  */
  select exists (
    select 1
    from public.connections c
    join public.memberships m
      on (
        -- user is in agency and target org is client
        (m.org_id = c.agency_id and c.client_id = p_org_id)
        -- or user is in client and target org is agency
        or (m.org_id = c.client_id and c.agency_id = p_org_id)
      )
    where m.user_id = auth.uid()
  );
$$;


--
-- Name: auth_user_owns_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_user_owns_org(p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.organizations o
    where o.id = p_org_id
      and o.owner_id = auth.uid()
      and o.deleted_at is null
  );
$$;


--
-- Name: check_invitation_limits(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_invitation_limits(org_id_param uuid, batch_size integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  daily_count INTEGER;
  pending_count INTEGER;
BEGIN
  -- Check daily limit (200)
  SELECT COUNT(*) INTO daily_count
  FROM membership_invitations
  WHERE org_id = org_id_param
    AND created_at >= CURRENT_DATE;
  
  IF daily_count + batch_size > 200 THEN
    RETURN FALSE;
  END IF;
  
  -- Check pending limit (100)
  SELECT COUNT(*) INTO pending_count
  FROM membership_invitations
  WHERE org_id = org_id_param
    AND status = 'pending';
  
  IF pending_count + batch_size > 100 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;


--
-- Name: check_no_draft_org_membership(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_no_draft_org_membership() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = NEW.org_id
      AND is_draft = true
  ) THEN
    RAISE EXCEPTION 'Cannot create membership in draft organization. Draft orgs cannot have members.';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION check_no_draft_org_membership(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_no_draft_org_membership() IS 'Prevents creating memberships in draft organizations. This is a critical security measure to ensure draft orgs never become active contexts.';


--
-- Name: check_user_email_exists(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_email_exists(p_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_user_exists boolean;
BEGIN
  -- Query auth.users directly (much more efficient than listing all users)
  SELECT EXISTS(
    SELECT 1
    FROM auth.users
    WHERE email = lower(trim(p_email))
  ) INTO v_user_exists;
  
  RETURN v_user_exists;
END;
$$;


--
-- Name: FUNCTION check_user_email_exists(p_email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_user_email_exists(p_email text) IS 'Efficiently checks if a user exists by email address. Returns true if user exists, false otherwise. Uses direct query to auth.users table for better performance.';


--
-- Name: check_user_verification(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_verification(user_email text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_exists BOOLEAN;
  user_verified BOOLEAN;
BEGIN
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = user_email) INTO user_exists;
  
  -- If user exists, check if they're verified
  IF user_exists THEN
    SELECT email_confirmed_at IS NOT NULL 
    FROM auth.users 
    WHERE email = user_email 
    INTO user_verified;
  ELSE
    user_verified := FALSE;
  END IF;
  
  -- Return the result as JSON
  RETURN json_build_object(
    'exists', user_exists,
    'is_verified', user_verified
  );
END;
$$;


--
-- Name: claim_organization(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_organization(p_connection_id uuid, p_draft_org_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_rows int;
  v_conn_rows int;
  v_org_name text;
  v_base_slug text;
  v_slug text;
  v_attempts integer := 0;
  v_suffix text;
BEGIN
  -- Get organization name for slug generation
  SELECT name INTO v_org_name
  FROM public.organizations
  WHERE id = p_draft_org_id
    AND is_draft = true;

  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'Organization not found or already claimed';
  END IF;

  -- Generate base slug from organization name
  -- First convert to lowercase, then replace spaces with hyphens, remove special characters
  v_base_slug := lower(trim(v_org_name));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9\s-]', '', 'g');
  v_base_slug := regexp_replace(v_base_slug, '\s+', '-', 'g');
  
  -- Remove leading/trailing hyphens
  v_base_slug := trim(both '-' from v_base_slug);
  
  -- Ensure slug is not empty (fallback to 'organization' if needed)
  IF v_base_slug = '' THEN
    v_base_slug := 'organization';
  END IF;

  -- Generate unique slug (check for conflicts and append suffix if needed)
  v_slug := v_base_slug;
  LOOP
    -- Check if slug already exists (excluding current organization and draft orgs)
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.organizations
      WHERE slug = v_slug
        AND id != p_draft_org_id
        AND is_draft = false
        AND deleted_at IS NULL
    );

    -- Generate random suffix (4 hex characters)
    v_suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
    v_slug := v_base_slug || '-' || v_suffix;

    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique slug';
    END IF;
  END LOOP;

  -- CRITICAL: Update organization FIRST to set is_draft = false and slug
  -- This must happen before inserting membership, otherwise the trigger
  -- check_no_draft_org_membership() will block the insert
  UPDATE public.organizations
  SET owner_id = p_user_id,
      is_draft = false,
      slug = v_slug,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_draft_org_id
    AND is_draft = true;

  GET DIAGNOSTICS v_org_rows = ROW_COUNT;
  IF v_org_rows = 0 THEN
    RAISE EXCEPTION 'Organization already claimed or invalid state';
  END IF;

  -- Now insert membership - org is no longer draft, so trigger will allow it
  INSERT INTO public.memberships (
    org_id, user_id, role, created_at, updated_at
  )
  VALUES (
    p_draft_org_id, p_user_id, 'member', NOW(), NOW()
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.connections
  SET connection_status = 'connected',
      connected_at = NOW(),
      invite_token = NULL,
      -- Set primary contact based on organization type:
      -- If claiming an agency org and user email matches invited_email, set agency_primary_contact_id
      -- If claiming a client org and user email matches invited_email, set client_primary_contact_id
      agency_primary_contact_id = CASE 
        WHEN (SELECT email FROM auth.users WHERE id = p_user_id) = 
             (SELECT invited_email FROM public.connections WHERE id = p_connection_id)
        AND (SELECT type FROM public.organizations WHERE id = p_draft_org_id) = 'agency'
        THEN p_user_id
        ELSE agency_primary_contact_id
      END,
      client_primary_contact_id = CASE 
        WHEN (SELECT email FROM auth.users WHERE id = p_user_id) = 
             (SELECT invited_email FROM public.connections WHERE id = p_connection_id)
        AND (SELECT type FROM public.organizations WHERE id = p_draft_org_id) = 'client'
        THEN p_user_id
        ELSE client_primary_contact_id
      END,
      updated_at = NOW()
  WHERE id = p_connection_id
    AND connection_status IN ('internal', 'invited');

  GET DIAGNOSTICS v_conn_rows = ROW_COUNT;
  IF v_conn_rows = 0 THEN
    RAISE EXCEPTION 'Connection invalid or already connected';
  END IF;
END;
$$;


--
-- Name: FUNCTION claim_organization(p_connection_id uuid, p_draft_org_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.claim_organization(p_connection_id uuid, p_draft_org_id uuid, p_user_id uuid) IS 'Atomically claims a draft organization (agency or client): updates organization (including slug generation from name), creates membership, and updates connection. Generates proper slug from organization name, replacing the random draft slug. Sets the appropriate primary contact ID (agency_primary_contact_id for agencies, client_primary_contact_id for clients) when the claiming user matches the invited email.';


--
-- Name: count_client_initiated_connections(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_client_initiated_connections(p_agency_id uuid, p_exclude_connection_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)::integer INTO v_count
  FROM public.connections c
  WHERE c.agency_id = p_agency_id
    AND c.created_by_org_id = c.client_id
    AND c.connection_status = 'connected'::connection_status
    AND c.id <> p_exclude_connection_id;
  
  RETURN COALESCE(v_count, 0);
END;
$$;


--
-- Name: FUNCTION count_client_initiated_connections(p_agency_id uuid, p_exclude_connection_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.count_client_initiated_connections(p_agency_id uuid, p_exclude_connection_id uuid) IS 'Counts client-initiated connected connections for an agency, excluding a specific connection. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion when used in RLS policies.';


--
-- Name: create_draft_agency_connection(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_draft_agency_connection(p_client_id uuid, p_owner_id uuid, p_agency_name text, p_primary_contact_email text) RETURNS TABLE(connection_id uuid, connection_status text, engagement_status text, agency_id uuid, agency_name text, logo_url text, is_draft boolean, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_agency_id uuid;
  v_connection_id uuid;
  v_sanitized_name text;
  v_sanitized_email text;
  v_slug text;
  v_connection_code text;
  v_code_source text;
  v_attempts integer := 0;
BEGIN
  -- Validate and sanitize inputs
  v_sanitized_name := NULLIF(btrim(p_agency_name), '');
  IF v_sanitized_name IS NULL THEN
    RAISE EXCEPTION 'Agency name is required';
  END IF;

  v_sanitized_email := NULLIF(lower(btrim(p_primary_contact_email)), '');
  IF v_sanitized_email IS NULL THEN
    RAISE EXCEPTION 'Primary contact email is required';
  END IF;

  -- Validate email format (basic check)
  IF v_sanitized_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  -- Validate client org exists and is a client type
  PERFORM 1
  FROM public.organizations
  WHERE id = p_client_id
    AND type = 'client'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid client org';
  END IF;

  -- Generate unique connection code
  LOOP
    v_code_source := lower(replace(gen_random_uuid()::text, '-', '')); -- 32 chars
    v_connection_code :=
      substr(v_code_source, 1, 4) || '-' ||
      substr(v_code_source, 5, 4) || '-' ||
      substr(v_code_source, 9, 4) || '-' ||
      substr(v_code_source, 13, 4) || '-' ||
      substr(v_code_source, 17, 4);
    v_slug := v_connection_code;

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.organizations
      WHERE connection_code = v_connection_code
         OR slug = v_slug
    );

    v_attempts := v_attempts + 1;
    IF v_attempts > 5 THEN
      RAISE EXCEPTION 'Could not generate unique connection code';
    END IF;
  END LOOP;

  -- Create draft agency organization
  INSERT INTO public.organizations (
    type,
    name,
    currency_code,
    connection_code,
    slug,
    description,
    website,
    industry,
    logo_url,
    owner_id,
    created_by_org_id,
    is_draft
  )
  VALUES (
    'agency',
    v_sanitized_name,
    'EUR',
    v_connection_code,
    v_slug,
    NULL,
    NULL,
    NULL,
    NULL,
    p_owner_id,
    p_client_id,
    true
  )
  RETURNING id INTO v_agency_id;

  -- Create connection with 'invited' status (skip draft state)
  -- Token will be generated in Node.js via createInviteToken, matching client invite flow
  INSERT INTO public.connections (
    agency_id,
    client_id,
    agency_primary_contact_id,
    client_primary_contact_id,
    connection_status,
    engagement_status,
    health_status,
    contract_value,
    contract_end_on,
    invited_email,
    invited_at,
    invite_token,
    connected_at,
    disconnected_at,
    created_by_org_id
  )
  VALUES (
    v_agency_id,
    p_client_id,
    NULL,
    NULL,
    'invited',
    NULL,
    NULL,
    NULL,
    NULL,
    v_sanitized_email,
    NOW(),
    NULL,
    NULL,
    NULL,
    p_client_id
  )
  RETURNING id INTO v_connection_id;

  RETURN QUERY
  SELECT
    c.id AS connection_id,
    c.connection_status::text,
    c.engagement_status::text,
    o.id AS agency_id,
    o.name AS agency_name,
    o.logo_url,
    o.is_draft,
    o.created_at
  FROM public.connections c
  JOIN public.organizations o ON o.id = c.agency_id
  WHERE c.id = v_connection_id;
END;
$_$;


--
-- Name: FUNCTION create_draft_agency_connection(p_client_id uuid, p_owner_id uuid, p_agency_name text, p_primary_contact_email text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_draft_agency_connection(p_client_id uuid, p_owner_id uuid, p_agency_name text, p_primary_contact_email text) IS 'Creates a draft agency organization and linked connection for a client in a single transaction. Sets connection status to invited (skips draft state). Token generation happens in Node.js via createInviteToken, matching the client invite flow pattern.';


--
-- Name: create_draft_client_connection(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_draft_client_connection(p_agency_id uuid, p_owner_id uuid, p_client_name text) RETURNS TABLE(connection_id uuid, connection_status text, engagement_status text, client_id uuid, client_name text, logo_url text, is_draft boolean, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_client_id uuid;
  v_connection_id uuid;
  v_sanitized_name text;
  v_slug text;
  v_connection_code text;
  v_code_source text;
  v_attempts integer := 0;
BEGIN
  -- Explicitly set search_path at function level (via SET clause above) to prevent search path issues
  -- The SET clause ensures search_path is set for the entire function execution

  v_sanitized_name := NULLIF(btrim(p_client_name), '');
  IF v_sanitized_name IS NULL THEN
    RAISE EXCEPTION 'Client name is required';
  END IF;

  PERFORM 1
  FROM public.organizations
  WHERE id = p_agency_id
    AND type = 'agency'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid agency org';
  END IF;

  -- Generate unique connection code
  LOOP
    v_code_source := lower(replace(gen_random_uuid()::text, '-', '')); -- 32 chars
    v_connection_code :=
      substr(v_code_source, 1, 4) || '-' ||
      substr(v_code_source, 5, 4) || '-' ||
      substr(v_code_source, 9, 4) || '-' ||
      substr(v_code_source, 13, 4) || '-' ||
      substr(v_code_source, 17, 4);
    v_slug := v_connection_code;

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.organizations
      WHERE connection_code = v_connection_code
         OR slug = v_slug
    );

    v_attempts := v_attempts + 1;
    IF v_attempts > 5 THEN
      RAISE EXCEPTION 'Could not generate unique connection code';
    END IF;
  END LOOP;

  INSERT INTO public.organizations (
    type,
    name,
    currency_code,
    connection_code,
    slug,
    description,
    website,
    industry,
    logo_url,
    owner_id,
    created_by_org_id,
    is_draft
  )
  VALUES (
    'client',
    v_sanitized_name,
    'EUR',
    v_connection_code,
    v_slug,
    NULL,
    NULL,
    NULL,
    NULL,
    p_owner_id,
    p_agency_id,
    true
  )
  RETURNING id INTO v_client_id;

  INSERT INTO public.connections (
    agency_id,
    client_id,
    agency_primary_contact_id,
    client_primary_contact_id,
    connection_status,
    engagement_status,
    health_status,
    contract_value,
    contract_end_on,
    invited_email,
    invited_at,
    invite_token,
    connected_at,
    disconnected_at,
    created_by_org_id
  )
  VALUES (
    p_agency_id,
    v_client_id,
    NULL,
    NULL,
    'internal',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    p_agency_id
  )
  RETURNING id INTO v_connection_id;

  RETURN QUERY
  SELECT
    c.id AS connection_id,
    c.connection_status::text,
    c.engagement_status::text,
    o.id AS client_id,
    o.name AS client_name,
    o.logo_url,
    o.is_draft,
    o.created_at
  FROM public.connections c
  JOIN public.organizations o ON o.id = c.client_id
  WHERE c.id = v_connection_id;
END;
$$;


--
-- Name: FUNCTION create_draft_client_connection(p_agency_id uuid, p_owner_id uuid, p_client_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_draft_client_connection(p_agency_id uuid, p_owner_id uuid, p_client_name text) IS 'Creates a draft client organization and linked connection for an agency in a single transaction. RLS policies use existing helper functions (auth_user_owns_org, user_is_member_of_org) to validate membership - no session variables needed.';


--
-- Name: create_membership_from_invitation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_membership_from_invitation(invitation_token uuid, user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Get and validate the invitation
  SELECT * INTO invitation_record
  FROM membership_invitations
  WHERE invite_token = invitation_token
    AND status = 'pending'
    AND expires_at > NOW();
  
  -- Check if invitation exists and is valid
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = create_membership_from_invitation.user_id
      AND org_id = invitation_record.org_id
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Create the membership
  INSERT INTO memberships (user_id, org_id, role, created_at, updated_at)
  VALUES (
    create_membership_from_invitation.user_id,
    invitation_record.org_id,
    invitation_record.role,
    NOW(),
    NOW()
  );
  
  -- Update invitation status to accepted
  UPDATE membership_invitations
  SET status = 'accepted',
      accepted_at = NOW(),
      updated_at = NOW()
  WHERE invite_token = invitation_token;
  
  RETURN TRUE;
END;
$$;


--
-- Name: create_organization(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_organization(p_name text, p_type text, p_industry text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
  v_slug text;
BEGIN
  -- Generate slug from name
  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  
  -- Check if user already has an organization
  SELECT o.id INTO v_org_id
  FROM public.organizations o
  JOIN public.memberships m ON m.org_id = o.id
  WHERE m.user_id = auth.uid();
  
  IF v_org_id IS NOT NULL THEN
    -- Update existing organization
    UPDATE public.organizations 
    SET 
      name = p_name,
      type = p_type::org_type,
      industry = p_industry,
      slug = v_slug,
      updated_at = now()
    WHERE id = v_org_id;
    
    RETURN v_org_id;
  ELSE
    -- Create new organization
    v_org_id := gen_random_uuid();
    
    -- Insert new organization
    INSERT INTO public.organizations (id, name, type, industry, slug, owner_id)
    VALUES (v_org_id, p_name, p_type::org_type, p_industry, v_slug, auth.uid());
    
    -- Create membership
    INSERT INTO public.memberships (org_id, user_id, role)
    VALUES (v_org_id, auth.uid(), 'member');
    
    RETURN v_org_id;
  END IF;
END;
$$;


--
-- Name: create_organization(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_organization(p_name text, p_type text, p_industry text, p_logo_url text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
  v_slug text;
  v_connection_code text;
  v_chars text := 'abcdefghjkmnpqrstvwxyzABCDEFGHJKLMNPQRSTVWXYZ23456789';
  v_section text;
  v_sections text[] := '{}';
  v_profile_id uuid;
  i integer;
  j integer;
BEGIN
  -- Get the profile ID for the current user
  SELECT id INTO v_profile_id FROM public.profiles WHERE id = auth.uid();
  
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- Generate slug from name
  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  
  -- Ensure slug uniqueness by adding suffix if needed
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
    v_slug := v_slug || '-' || floor(random() * 9999 + 1)::text;
  END LOOP;
  
  -- Generate connection code: XXXX-XXXX-XXXX-XXXX-XXXX (5 groups of 4 chars)
  FOR i IN 1..5 LOOP
    v_section := '';
    FOR j IN 1..4 LOOP
      v_section := v_section || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;
    v_sections := v_sections || v_section;
  END LOOP;
  
  v_connection_code := array_to_string(v_sections, '-');
  
  -- Check if user already has an organization
  SELECT o.id INTO v_org_id
  FROM public.organizations o
  JOIN public.memberships m ON m.org_id = o.id
  WHERE m.user_id = v_profile_id;
  
  IF v_org_id IS NOT NULL THEN
    -- Update existing organization (don't regenerate connection code)
    -- CRITICAL: Ensure is_draft remains false for existing orgs
    UPDATE public.organizations 
    SET 
      name = p_name,
      type = p_type::org_type,
      industry = p_industry,
      slug = v_slug,
      logo_url = p_logo_url,
      is_draft = false, -- CRITICAL: Explicitly set to false
      updated_at = now()
    WHERE id = v_org_id;
    
    RETURN v_org_id;
  ELSE
    -- Clean up any orphaned memberships first
    DELETE FROM public.memberships WHERE user_id = v_profile_id;
    
    -- Create new organization
    v_org_id := gen_random_uuid();
    
    -- Insert new organization with connection code
    -- CRITICAL: Explicitly set is_draft = false for onboarding orgs
    INSERT INTO public.organizations (id, name, type, industry, slug, logo_url, connection_code, owner_id, is_draft)
    VALUES (v_org_id, p_name, p_type::org_type, p_industry, v_slug, p_logo_url, v_connection_code, v_profile_id, false);
    
    -- Create membership
    INSERT INTO public.memberships (org_id, user_id, role)
    VALUES (v_org_id, v_profile_id, 'member');
    
    -- Verify organization was created successfully
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'Failed to create organization';
    END IF;
    
    RETURN v_org_id;
  END IF;
  
  -- This should never be reached, but ensures we always return something
  RAISE EXCEPTION 'Unexpected error: No organization ID generated';
END;
$$;


--
-- Name: delete_draft_agency(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_draft_agency(p_agency_id uuid, p_client_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_draft boolean;
  v_connection_id uuid;
  v_request_ids uuid[];
  v_task_ids uuid[];
BEGIN
  -- Step 1: Verify the agency org exists, is a draft, and belongs to the client
  SELECT o.is_draft, c.id INTO v_is_draft, v_connection_id
  FROM public.organizations o
  INNER JOIN public.connections c ON c.agency_id = o.id
  WHERE o.id = p_agency_id
    AND c.client_id = p_client_id
    AND o.is_draft = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft agency not found or does not belong to this client';
  END IF;
  
  IF v_is_draft IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot hard delete non-draft agency. Use soft delete instead.';
  END IF;
  
  -- Step 2: Verify user has permission (is member/owner of client)
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = p_client_id
      AND m.user_id = p_user_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = p_client_id
      AND o.owner_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User does not have permission to delete this draft agency';
  END IF;
  
  -- Step 3: Hard delete related data (cascade order)
  -- First, get all request and task IDs for this connection to delete their comments
  
  -- Collect request IDs
  SELECT ARRAY_AGG(id) INTO v_request_ids
  FROM public.requests
  WHERE connection_id = v_connection_id;
  
  -- Collect task IDs
  SELECT ARRAY_AGG(id) INTO v_task_ids
  FROM public.tasks
  WHERE connection_id = v_connection_id;
  
  -- Delete comments on requests (must be done before deleting requests)
  IF v_request_ids IS NOT NULL AND array_length(v_request_ids, 1) > 0 THEN
    DELETE FROM public.request_comments WHERE request_id = ANY(v_request_ids);
  END IF;
  
  -- Delete comments on tasks (must be done before deleting tasks)
  IF v_task_ids IS NOT NULL AND array_length(v_task_ids, 1) > 0 THEN
    DELETE FROM public.task_comments WHERE task_id = ANY(v_task_ids);
  END IF;
  
  -- Delete connection resources (linked directly to connection)
  DELETE FROM public.connection_resources WHERE connection_id = v_connection_id;
  
  -- Delete tasks associated with this connection
  DELETE FROM public.tasks WHERE connection_id = v_connection_id;
  
  -- Delete requests associated with this connection
  DELETE FROM public.requests WHERE connection_id = v_connection_id;
  
  -- Delete projects associated with this connection
  DELETE FROM public.projects WHERE connection_id = v_connection_id;
  
  -- Step 4: Delete connection
  DELETE FROM public.connections
  WHERE id = v_connection_id;
  
  -- Step 5: Delete draft organization
  DELETE FROM public.organizations
  WHERE id = p_agency_id
    AND is_draft = true;
  
END;
$$;


--
-- Name: FUNCTION delete_draft_agency(p_agency_id uuid, p_client_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_draft_agency(p_agency_id uuid, p_client_id uuid, p_user_id uuid) IS 'Hard deletes a draft agency organization and all related data (connection, tasks, requests, projects, request_comments, task_comments, connection_resources). Only works for draft agencies (is_draft = true) that belong to the specified client. Requires user to be a member or owner of the client.';


--
-- Name: delete_draft_client(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_draft_client(p_client_id uuid, p_agency_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_draft boolean;
  v_connection_id uuid;
  v_request_ids uuid[];
  v_task_ids uuid[];
BEGIN
  -- Step 1: Verify the client org exists, is a draft, and belongs to the agency
  SELECT o.is_draft, c.id INTO v_is_draft, v_connection_id
  FROM public.organizations o
  INNER JOIN public.connections c ON c.client_id = o.id
  WHERE o.id = p_client_id
    AND c.agency_id = p_agency_id
    AND o.is_draft = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft client not found or does not belong to this agency';
  END IF;
  
  IF v_is_draft IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot hard delete non-draft client. Use soft delete instead.';
  END IF;
  
  -- Step 2: Verify user has permission (is member/owner of agency)
  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = p_agency_id
      AND m.user_id = p_user_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = p_agency_id
      AND o.owner_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User does not have permission to delete this draft client';
  END IF;
  
  -- Step 3: Hard delete related data (cascade order)
  -- First, get all request and task IDs for this connection to delete their comments
  
  -- Collect request IDs
  SELECT ARRAY_AGG(id) INTO v_request_ids
  FROM public.requests
  WHERE connection_id = v_connection_id;
  
  -- Collect task IDs
  SELECT ARRAY_AGG(id) INTO v_task_ids
  FROM public.tasks
  WHERE connection_id = v_connection_id;
  
  -- Delete comments on requests (must be done before deleting requests)
  IF v_request_ids IS NOT NULL AND array_length(v_request_ids, 1) > 0 THEN
    DELETE FROM public.request_comments WHERE request_id = ANY(v_request_ids);
  END IF;
  
  -- Delete comments on tasks (must be done before deleting tasks)
  IF v_task_ids IS NOT NULL AND array_length(v_task_ids, 1) > 0 THEN
    DELETE FROM public.task_comments WHERE task_id = ANY(v_task_ids);
  END IF;
  
  -- Delete connection resources (linked directly to connection)
  DELETE FROM public.connection_resources WHERE connection_id = v_connection_id;
  
  -- Delete tasks associated with this connection
  DELETE FROM public.tasks WHERE connection_id = v_connection_id;
  
  -- Delete requests associated with this connection
  DELETE FROM public.requests WHERE connection_id = v_connection_id;
  
  -- Delete projects associated with this connection
  DELETE FROM public.projects WHERE connection_id = v_connection_id;
  
  -- Step 4: Delete connection
  DELETE FROM public.connections
  WHERE id = v_connection_id;
  
  -- Step 5: Delete draft organization
  DELETE FROM public.organizations
  WHERE id = p_client_id
    AND is_draft = true;
  
END;
$$;


--
-- Name: FUNCTION delete_draft_client(p_client_id uuid, p_agency_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_draft_client(p_client_id uuid, p_agency_id uuid, p_user_id uuid) IS 'Hard deletes a draft client organization and all related data (connection, tasks, requests, projects, request_comments, task_comments, connection_resources). Only works for draft clients (is_draft = true) that belong to the specified agency. Requires user to be a member or owner of the agency.';


--
-- Name: delete_workspace(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_workspace(p_org_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_owner_id uuid;
  v_internal_connection_ids uuid[];
  v_draft_org_ids uuid[];
  v_draft_connection_ids uuid[];
  v_connection_id uuid;
  v_request_ids uuid[];
  v_task_ids uuid[];
  v_user_ids uuid[];
BEGIN
  -- Step 1: Verify the organization exists and user is the owner
  SELECT owner_id INTO v_owner_id
  FROM public.organizations
  WHERE id = p_org_id
    AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found or already deleted';
  END IF;
  
  IF v_owner_id != p_user_id THEN
    RAISE EXCEPTION 'Only the organization owner can delete the workspace';
  END IF;
  
  -- Step 2: Collect all internal connection IDs for this organization
  -- (both as agency and as client)
  -- Use COALESCE to ensure we get an empty array instead of NULL if no connections exist
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[]) INTO v_internal_connection_ids
  FROM public.connections
  WHERE (agency_id = p_org_id OR client_id = p_org_id)
    AND connection_status = 'internal';
  
  -- Step 3: Collect all draft organization IDs created by this organization
  -- Use COALESCE to ensure we get an empty array instead of NULL if no draft orgs exist
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[]) INTO v_draft_org_ids
  FROM public.organizations
  WHERE created_by_org_id = p_org_id
    AND is_draft = true;
  
  -- Step 4: Collect all user IDs in this organization (for profile soft-deletion)
  -- Use COALESCE to ensure we get an empty array instead of NULL if no memberships exist
  SELECT COALESCE(ARRAY_AGG(DISTINCT user_id), ARRAY[]::uuid[]) INTO v_user_ids
  FROM public.memberships
  WHERE org_id = p_org_id;
  
  -- Step 5: For each internal connection, delete related data
  IF array_length(v_internal_connection_ids, 1) > 0 THEN
    FOREACH v_connection_id IN ARRAY v_internal_connection_ids
    LOOP
      -- Collect request IDs for this connection
      -- Use COALESCE to ensure we get an empty array instead of NULL if no requests exist
      SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[]) INTO v_request_ids
      FROM public.requests
      WHERE connection_id = v_connection_id;
      
      -- Collect task IDs for this connection
      -- Use COALESCE to ensure we get an empty array instead of NULL if no tasks exist
      SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[]) INTO v_task_ids
      FROM public.tasks
      WHERE connection_id = v_connection_id;
      
      -- Delete comments on requests (must be done before deleting requests)
      IF array_length(v_request_ids, 1) > 0 THEN
        DELETE FROM public.request_comments WHERE request_id = ANY(v_request_ids);
      END IF;
      
      -- Delete comments on tasks (must be done before deleting tasks)
      IF array_length(v_task_ids, 1) > 0 THEN
        DELETE FROM public.task_comments WHERE task_id = ANY(v_task_ids);
      END IF;
      
      -- Delete connection resources
      DELETE FROM public.connection_resources WHERE connection_id = v_connection_id;
      
      -- Delete tasks
      DELETE FROM public.tasks WHERE connection_id = v_connection_id;
      
      -- Delete requests
      DELETE FROM public.requests WHERE connection_id = v_connection_id;
      
      -- Delete projects
      DELETE FROM public.projects WHERE connection_id = v_connection_id;
    END LOOP;
    
    -- Delete all internal connections
    DELETE FROM public.connections
    WHERE id = ANY(v_internal_connection_ids);
  END IF;
  
  -- Step 6: Delete all draft organizations created by this workspace
  -- (This will cascade delete their connections and related data via delete_draft_client/delete_draft_agency)
  -- But we need to handle them here since we're deleting the parent org
  IF array_length(v_draft_org_ids, 1) > 0 THEN
    -- Collect all connection IDs for draft orgs first
    -- Use COALESCE to ensure we get an empty array instead of NULL if no connections exist
    SELECT COALESCE(ARRAY_AGG(c.id), ARRAY[]::uuid[]) INTO v_draft_connection_ids
    FROM public.connections c
    WHERE (c.agency_id = ANY(v_draft_org_ids) OR c.client_id = ANY(v_draft_org_ids));
    
    -- For each draft org connection, delete related data
    -- Only proceed if we have connections to process
    IF array_length(v_draft_connection_ids, 1) > 0 THEN
      FOREACH v_connection_id IN ARRAY v_draft_connection_ids
      LOOP
      -- Collect request IDs
      -- Use COALESCE to ensure we get an empty array instead of NULL if no requests exist
      SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[]) INTO v_request_ids
      FROM public.requests
      WHERE connection_id = v_connection_id;
      
      -- Collect task IDs
      -- Use COALESCE to ensure we get an empty array instead of NULL if no tasks exist
      SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[]) INTO v_task_ids
      FROM public.tasks
      WHERE connection_id = v_connection_id;
      
      -- Delete comments
      IF array_length(v_request_ids, 1) > 0 THEN
        DELETE FROM public.request_comments WHERE request_id = ANY(v_request_ids);
      END IF;
      
      IF array_length(v_task_ids, 1) > 0 THEN
        DELETE FROM public.task_comments WHERE task_id = ANY(v_task_ids);
      END IF;
      
      -- Delete connection resources
      DELETE FROM public.connection_resources WHERE connection_id = v_connection_id;
      
      -- Delete tasks, requests, projects
      DELETE FROM public.tasks WHERE connection_id = v_connection_id;
      DELETE FROM public.requests WHERE connection_id = v_connection_id;
      DELETE FROM public.projects WHERE connection_id = v_connection_id;
      END LOOP;
    END IF;
    
    -- Delete connections for draft orgs
    DELETE FROM public.connections
    WHERE agency_id = ANY(v_draft_org_ids) OR client_id = ANY(v_draft_org_ids);
    
    -- Delete draft organizations
    DELETE FROM public.organizations
    WHERE id = ANY(v_draft_org_ids);
  END IF;
  
  -- Step 7: Hard delete all organization_resources for this org
  DELETE FROM public.organization_resources WHERE organization_id = p_org_id;
  
  -- Step 8: Hard delete all membership_invitations for this org
  DELETE FROM public.membership_invitations WHERE org_id = p_org_id;
  
  -- Step 9: Hard delete all memberships for this org
  DELETE FROM public.memberships WHERE org_id = p_org_id;
  
  -- Step 10: Soft delete all profiles for org members
  IF array_length(v_user_ids, 1) > 0 THEN
    UPDATE public.profiles
    SET deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = ANY(v_user_ids);
  END IF;
  
  -- Step 11: Soft delete the organization
  UPDATE public.organizations
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_org_id;
  
END;
$$;


--
-- Name: FUNCTION delete_workspace(p_org_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_workspace(p_org_id uuid, p_user_id uuid) IS 'Soft deletes a workspace organization and hard deletes all related data (memberships, internal connections, draft orgs, organization_resources, membership_invitations). Soft deletes profiles for org members. Requires user to be the organization owner.';


--
-- Name: fn_set_request_project_name(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_set_request_project_name() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- If project_id is set, populate the cached name
  IF NEW.project_id IS NOT NULL THEN
    SELECT name INTO NEW.project_name_cached
    FROM public.projects
    WHERE id = NEW.project_id
      AND deleted_at IS NULL;
  ELSE
    -- If no project, clear the cached name
    NEW.project_name_cached := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: fn_sync_project_name_to_requests(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sync_project_name_to_requests() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- When a project name changes, update all requests linked to it
  UPDATE public.requests
  SET project_name_cached = NEW.name
  WHERE project_id = NEW.id
    AND deleted_at IS NULL;
  
  RETURN NEW;
END;
$$;


--
-- Name: get_my_org_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_org_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select org_id
  from public.memberships
  where user_id = auth.uid();
$$;


--
-- Name: get_my_uid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_uid() RETURNS uuid
    LANGUAGE sql
    AS $$
  select auth.uid();
$$;


--
-- Name: get_requests_counts(uuid[], uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_requests_counts(p_connection_ids uuid[], p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_created_by_user_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE sql STABLE
    AS $_$
  SELECT json_build_object(
    'status_counts', (
      SELECT json_object_agg(status::text, count)
      FROM (
        SELECT 
          r.status,
          COUNT(*) as count
        FROM requests r
        WHERE r.connection_id = ANY(p_connection_ids)
        AND r.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
        AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
        GROUP BY r.status
      ) status_counts
    ),
    'client_counts', (
      -- Return counts keyed by `${status}-${orgId}` for accordion headers
      -- We need separate counts for agency view (client_id) and client view (agency_id)
      -- Since we can't determine view_type in SQL, return both and frontend will use the right one
      -- Use jsonb_build_object to combine both views
      SELECT jsonb_build_object(
        'agency', (
          SELECT json_object_agg(key, count)
          FROM (
            SELECT 
              r.status::text || '-' || c.client_id::text as key,
              COUNT(*) as count
            FROM requests r
            INNER JOIN connections c ON r.connection_id = c.id
            WHERE r.connection_id = ANY(p_connection_ids)
            AND r.deleted_at IS NULL
            AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
            AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
            GROUP BY r.status, c.client_id
          ) agency_counts
        ),
        'client', (
          SELECT json_object_agg(key, count)
          FROM (
            SELECT 
              r.status::text || '-' || c.agency_id::text as key,
              COUNT(*) as count
            FROM requests r
            INNER JOIN connections c ON r.connection_id = c.id
            WHERE r.connection_id = ANY(p_connection_ids)
            AND r.deleted_at IS NULL
            AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
            AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
            GROUP BY r.status, c.agency_id
          ) client_counts
        )
      )::json
    )
  );
$_$;


--
-- Name: FUNCTION get_requests_counts(p_connection_ids uuid[], p_assigned_to_user_id uuid, p_created_by_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_requests_counts(p_connection_ids uuid[], p_assigned_to_user_id uuid, p_created_by_user_id uuid) IS 'Returns lightweight metadata (status counts and connection counts) without fetching request rows. Used for accurate header counts in MVP flat pagination.';


--
-- Name: get_requests_counts_for_connection(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_requests_counts_for_connection(p_connection_id uuid, p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_created_by_user_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE sql STABLE
    AS $$
  SELECT json_build_object(
    'status_counts', (
      SELECT json_object_agg(status::text, count)
      FROM (
        SELECT 
          r.status,
          COUNT(*) as count
        FROM requests r
        WHERE r.connection_id = p_connection_id
        AND r.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
        AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
        GROUP BY r.status
      ) status_counts
    )
  );
$$;


--
-- Name: FUNCTION get_requests_counts_for_connection(p_connection_id uuid, p_assigned_to_user_id uuid, p_created_by_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_requests_counts_for_connection(p_connection_id uuid, p_assigned_to_user_id uuid, p_created_by_user_id uuid) IS 'Returns lightweight status counts for a single connection without fetching request rows. Used for accurate header counts in connections tables to prevent flicker.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid NOT NULL,
    created_by_org_id uuid NOT NULL,
    created_by_user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    status public.request_status DEFAULT 'new'::public.request_status NOT NULL,
    assignee_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid,
    project_id uuid,
    project_name_cached text,
    search_vector tsvector
);


--
-- Name: TABLE requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.requests IS 'Requests from clients to their agencies';


--
-- Name: COLUMN requests.project_name_cached; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.requests.project_name_cached IS 'Denormalized project name for fast search. Automatically synced via triggers.';


--
-- Name: get_requests_for_client_status(uuid[], uuid, text, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_requests_for_client_status(p_connection_ids uuid[], p_client_org_id uuid, p_status text, p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_created_by_user_id uuid DEFAULT NULL::uuid, p_view_type text DEFAULT 'agency'::text) RETURNS SETOF public.requests
    LANGUAGE sql STABLE
    AS $$
  SELECT r.*
  FROM requests r
  INNER JOIN connections c ON r.connection_id = c.id
  WHERE r.connection_id = ANY(p_connection_ids)
  AND (
    (p_view_type = 'agency' AND c.client_id = p_client_org_id) OR
    (p_view_type != 'agency' AND c.agency_id = p_client_org_id)
  )
  AND r.status::text = p_status
  AND r.deleted_at IS NULL
  AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
  AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
  ORDER BY r.created_at DESC, r.id DESC;
$$;


--
-- Name: FUNCTION get_requests_for_client_status(p_connection_ids uuid[], p_client_org_id uuid, p_status text, p_assigned_to_user_id uuid, p_created_by_user_id uuid, p_view_type text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_requests_for_client_status(p_connection_ids uuid[], p_client_org_id uuid, p_status text, p_assigned_to_user_id uuid, p_created_by_user_id uuid, p_view_type text) IS 'Returns all requests for a specific client organization in a specific status. Used for accordion fetch-on-expand pattern. No pagination - fetches all requests for the client.';


--
-- Name: get_requests_for_connection_status(uuid, text, integer, integer, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_requests_for_connection_status(p_connection_id uuid, p_status text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_created_by_user_id uuid DEFAULT NULL::uuid, p_search_query text DEFAULT NULL::text) RETURNS TABLE(id uuid, connection_id uuid, title text, description text, status text, assignee_user_id uuid, created_by_user_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, deleted_at timestamp with time zone, project_id uuid, created_by_org_id uuid)
    LANGUAGE sql STABLE
    AS $$
  SELECT 
    r.id,
    r.connection_id,
    r.title,
    r.description,
    r.status,
    r.assignee_user_id,
    r.created_by_user_id,
    r.created_at,
    r.updated_at,
    r.deleted_at,
    r.project_id,
    r.created_by_org_id
  FROM requests r
  WHERE r.connection_id = p_connection_id
  AND r.status::text = p_status
  AND r.deleted_at IS NULL
  AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
  AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
  AND (p_search_query IS NULL OR r.title ILIKE '%' || p_search_query || '%')
  ORDER BY r.created_at DESC, r.id DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;


--
-- Name: FUNCTION get_requests_for_connection_status(p_connection_id uuid, p_status text, p_limit integer, p_offset integer, p_assigned_to_user_id uuid, p_created_by_user_id uuid, p_search_query text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_requests_for_connection_status(p_connection_id uuid, p_status text, p_limit integer, p_offset integer, p_assigned_to_user_id uuid, p_created_by_user_id uuid, p_search_query text) IS 'Returns paginated requests for a single connection in a specific status. Used for connections tables with virtual scrolling and pagination.';


--
-- Name: get_tasks_counts(uuid[], uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tasks_counts(p_connection_ids uuid[], p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_assigned_to_user_ids uuid[] DEFAULT NULL::uuid[]) RETURNS json
    LANGUAGE sql STABLE
    AS $_$
  SELECT json_build_object(
    'status_counts', (
      SELECT json_object_agg(status::text, count)
      FROM (
        SELECT 
          t.status,
          COUNT(*) as count
        FROM tasks t
        WHERE t.connection_id = ANY(p_connection_ids)
        AND t.deleted_at IS NULL
        AND (
          (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
          (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
          (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
        )
        GROUP BY t.status
      ) status_counts
    ),
    'client_counts', (
      -- Return counts keyed by `${status}-${orgId}` for accordion headers
      -- We need separate counts for agency view (client_id) and client view (agency_id)
      -- Since we can't determine view_type in SQL, return both and frontend will use the right one
      -- Use jsonb_build_object to combine both views
      SELECT jsonb_build_object(
        'agency', (
          SELECT json_object_agg(key, count)
          FROM (
            SELECT 
              t.status::text || '-' || c.client_id::text as key,
              COUNT(*) as count
            FROM tasks t
            INNER JOIN connections c ON t.connection_id = c.id
            WHERE t.connection_id = ANY(p_connection_ids)
            AND t.deleted_at IS NULL
            AND (
              (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
              (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
              (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
            )
            GROUP BY t.status, c.client_id
          ) agency_counts
        ),
        'client', (
          SELECT json_object_agg(key, count)
          FROM (
            SELECT 
              t.status::text || '-' || c.agency_id::text as key,
              COUNT(*) as count
            FROM tasks t
            INNER JOIN connections c ON t.connection_id = c.id
            WHERE t.connection_id = ANY(p_connection_ids)
            AND t.deleted_at IS NULL
            AND (
              (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
              (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
              (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
            )
            GROUP BY t.status, c.agency_id
          ) client_counts
        )
      )::json
    )
  );
$_$;


--
-- Name: FUNCTION get_tasks_counts(p_connection_ids uuid[], p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_tasks_counts(p_connection_ids uuid[], p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[]) IS 'Returns lightweight metadata (status counts and connection counts) without fetching task rows. Used for accurate header counts in MVP accordion pattern.';


--
-- Name: get_tasks_counts_for_connection(uuid, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tasks_counts_for_connection(p_connection_id uuid, p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_assigned_to_user_ids uuid[] DEFAULT NULL::uuid[]) RETURNS json
    LANGUAGE sql STABLE
    AS $$
  SELECT json_build_object(
    'status_counts', (
      SELECT json_object_agg(status::text, count)
      FROM (
        SELECT 
          t.status,
          COUNT(*) as count
        FROM tasks t
        WHERE t.connection_id = p_connection_id
        AND t.deleted_at IS NULL
        AND (
          (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
          (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
          (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
        )
        GROUP BY t.status
      ) status_counts
    )
  );
$$;


--
-- Name: FUNCTION get_tasks_counts_for_connection(p_connection_id uuid, p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_tasks_counts_for_connection(p_connection_id uuid, p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[]) IS 'Returns lightweight status counts for a single connection without fetching task rows. Used for accurate header counts in connections tables to prevent flicker.';


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid NOT NULL,
    project_id uuid,
    title text NOT NULL,
    description text,
    status public.task_status DEFAULT 'to_do'::public.task_status NOT NULL,
    due_date date,
    assignee_user_id uuid,
    client_visible boolean DEFAULT false NOT NULL,
    created_by_user_id uuid NOT NULL,
    source_request_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid,
    completed_at timestamp with time zone,
    search_vector tsvector
);


--
-- Name: TABLE tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tasks IS 'Tasks managed by agencies';


--
-- Name: get_tasks_for_client_status(uuid[], uuid, text, uuid, uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tasks_for_client_status(p_connection_ids uuid[], p_client_org_id uuid, p_status text, p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_assigned_to_user_ids uuid[] DEFAULT NULL::uuid[], p_view_type text DEFAULT 'agency'::text) RETURNS SETOF public.tasks
    LANGUAGE sql STABLE
    AS $$
  SELECT t.*
  FROM tasks t
  INNER JOIN connections c ON t.connection_id = c.id
  WHERE t.connection_id = ANY(p_connection_ids)
  AND (
    (p_view_type = 'agency' AND c.client_id = p_client_org_id) OR
    (p_view_type != 'agency' AND c.agency_id = p_client_org_id)
  )
  AND t.status::text = p_status
  AND t.deleted_at IS NULL
  AND (
    (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
    (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
    (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
  )
  ORDER BY t.created_at DESC, t.id DESC;
$$;


--
-- Name: FUNCTION get_tasks_for_client_status(p_connection_ids uuid[], p_client_org_id uuid, p_status text, p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[], p_view_type text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_tasks_for_client_status(p_connection_ids uuid[], p_client_org_id uuid, p_status text, p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[], p_view_type text) IS 'Returns all tasks for a specific client organization in a specific status. Used for accordion fetch-on-expand pattern. No pagination - fetches all tasks for the client.';


--
-- Name: get_tasks_for_connection_status(uuid, text, integer, integer, uuid, uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tasks_for_connection_status(p_connection_id uuid, p_status text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_assigned_to_user_ids uuid[] DEFAULT NULL::uuid[], p_search_query text DEFAULT NULL::text) RETURNS TABLE(id uuid, connection_id uuid, title text, description text, status text, assignee_user_id uuid, created_by_user_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, deleted_at timestamp with time zone, project_id uuid, due_date date, client_visible boolean, completed_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
  SELECT 
    t.id,
    t.connection_id,
    t.title,
    t.description,
    t.status,
    t.assignee_user_id,
    t.created_by_user_id,
    t.created_at,
    t.updated_at,
    t.deleted_at,
    t.project_id,
    t.due_date,
    t.client_visible,
    t.completed_at
  FROM tasks t
  WHERE t.connection_id = p_connection_id
  AND t.status::text = p_status
  AND t.deleted_at IS NULL
  AND (
    (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
    (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
    (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
  )
  AND (p_search_query IS NULL OR t.title ILIKE '%' || p_search_query || '%')
  ORDER BY t.created_at DESC, t.id DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;


--
-- Name: FUNCTION get_tasks_for_connection_status(p_connection_id uuid, p_status text, p_limit integer, p_offset integer, p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[], p_search_query text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_tasks_for_connection_status(p_connection_id uuid, p_status text, p_limit integer, p_offset integer, p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[], p_search_query text) IS 'Returns paginated tasks for a single connection in a specific status. Used for connections tables with virtual scrolling and pagination.';


--
-- Name: get_tasks_sorted_by_due_date(uuid[], integer, integer, text, uuid, uuid[], uuid[], uuid[], uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tasks_sorted_by_due_date(p_connection_ids uuid[], p_limit_count integer, p_offset_count integer, p_search_query text DEFAULT NULL::text, p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_assigned_to_user_ids uuid[] DEFAULT NULL::uuid[], p_matching_user_ids uuid[] DEFAULT NULL::uuid[], p_matching_connection_ids uuid[] DEFAULT NULL::uuid[], p_project_ids_matching_search uuid[] DEFAULT NULL::uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result json;
  v_search_pattern text;
  v_status_match text;
BEGIN
  -- Validate inputs
  IF p_connection_ids IS NULL OR array_length(p_connection_ids, 1) IS NULL THEN
    RETURN '[]'::json;
  END IF;

  -- Prepare search pattern and matching IDs if search is provided
  IF p_search_query IS NOT NULL AND p_search_query != '' THEN
    v_search_pattern := '%' || p_search_query || '%';
    -- Check if search matches a status
    v_status_match := CASE LOWER(TRIM(p_search_query))
      WHEN 'to do' THEN 'to_do'
      WHEN 'todo' THEN 'to_do'
      WHEN 'open' THEN 'to_do'
      WHEN 'backlog' THEN 'to_do'
      WHEN 'in progress' THEN 'in_progress'
      WHEN 'progress' THEN 'in_progress'
      WHEN 'active' THEN 'in_progress'
      WHEN 'working' THEN 'in_progress'
      WHEN 'on hold' THEN 'on_hold'
      WHEN 'hold' THEN 'on_hold'
      WHEN 'paused' THEN 'on_hold'
      WHEN 'blocked' THEN 'on_hold'
      WHEN 'completed' THEN 'done'
      WHEN 'complete' THEN 'done'
      WHEN 'done' THEN 'done'
      WHEN 'finished' THEN 'done'
      ELSE NULL
    END;
    
    -- Note: For simplicity, we'll handle profile/project/org name search in the WHERE clause
    -- The calling code should pre-filter these if needed, or we can add them here
  END IF;

  -- Build query with Done/non-Done separation
  -- Strategy: Use ORDER BY with CASE to separate Done from non-Done, then sort within each group
  WITH ordered_tasks AS (
    SELECT 
      t.id,
      t.connection_id,
      t.project_id,
      t.title,
      t.description,
      t.status::text AS status,
      t.due_date,
      t.assignee_user_id,
      t.client_visible,
      t.created_by_user_id,
      t.created_at,
      t.updated_at,
      t.completed_at,
      t.source_request_id,
      conn.client_id,
      conn.agency_id,
      client_org.name AS client_org_name,
      client_org.logo_url AS client_org_logo,
      agency_org.name AS agency_org_name,
      agency_org.logo_url AS agency_org_logo
    FROM public.tasks t
    INNER JOIN public.connections conn ON t.connection_id = conn.id
    LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
    LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
    WHERE t.connection_id = ANY(p_connection_ids)
      AND t.deleted_at IS NULL
      AND (p_assigned_to_user_id IS NULL OR t.assignee_user_id = p_assigned_to_user_id)
      AND (p_assigned_to_user_ids IS NULL OR t.assignee_user_id = ANY(p_assigned_to_user_ids))
      AND (
        -- If no search at all, include all tasks
        (v_search_pattern IS NULL 
         AND (p_matching_user_ids IS NULL OR array_length(p_matching_user_ids, 1) IS NULL OR array_length(p_matching_user_ids, 1) = 0)
         AND (p_matching_connection_ids IS NULL OR array_length(p_matching_connection_ids, 1) IS NULL OR array_length(p_matching_connection_ids, 1) = 0)
         AND (p_project_ids_matching_search IS NULL OR array_length(p_project_ids_matching_search, 1) IS NULL OR array_length(p_project_ids_matching_search, 1) = 0)
        ) OR
        -- Text search matches
        (v_search_pattern IS NOT NULL AND (
          t.title ILIKE v_search_pattern OR
          t.description ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND t.status::text = v_status_match)
        )) OR
        -- Profile name matches
        (p_matching_user_ids IS NOT NULL AND array_length(p_matching_user_ids, 1) > 0 AND (
          t.created_by_user_id = ANY(p_matching_user_ids) OR
          t.assignee_user_id = ANY(p_matching_user_ids)
        )) OR
        -- Organization name matches
        (p_matching_connection_ids IS NOT NULL AND array_length(p_matching_connection_ids, 1) > 0 AND 
         t.connection_id = ANY(p_matching_connection_ids)
        ) OR
        -- Project name matches
        (p_project_ids_matching_search IS NOT NULL AND array_length(p_project_ids_matching_search, 1) > 0 AND 
         t.project_id = ANY(p_project_ids_matching_search)
        )
      )
    ORDER BY 
      -- First: separate Done (1) from non-Done (0), Done goes last
      CASE WHEN t.status::text = 'done' THEN 1 ELSE 0 END ASC,
      -- For non-Done: sort by due_date ASC (nulls last), then created_at DESC
      CASE WHEN t.status::text != 'done' THEN t.due_date END ASC NULLS LAST,
      CASE WHEN t.status::text != 'done' THEN t.created_at END DESC NULLS LAST,
      -- For Done: sort by completed_at DESC (newest first), then created_at DESC
      CASE WHEN t.status::text = 'done' THEN t.completed_at END DESC NULLS LAST,
      CASE WHEN t.status::text = 'done' THEN t.created_at END DESC NULLS LAST
    LIMIT p_limit_count
    OFFSET p_offset_count
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', id,
      'connection_id', connection_id,
      'project_id', project_id,
      'title', title,
      'description', description,
      'status', status,
      'due_date', due_date,
      'assignee_user_id', assignee_user_id,
      'client_visible', client_visible,
      'created_by_user_id', created_by_user_id,
      'created_at', created_at,
      'updated_at', updated_at,
      'completed_at', completed_at,
      'source_request_id', source_request_id,
      'client_id', client_id,
      'agency_id', agency_id,
      'client_org_name', client_org_name,
      'client_org_logo', client_org_logo,
      'agency_org_name', agency_org_name,
      'agency_org_logo', agency_org_logo
    )
  ), '[]'::json)
  INTO v_result
  FROM ordered_tasks;

  -- Return empty array if no results
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;


--
-- Name: FUNCTION get_tasks_sorted_by_due_date(p_connection_ids uuid[], p_limit_count integer, p_offset_count integer, p_search_query text, p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[], p_matching_user_ids uuid[], p_matching_connection_ids uuid[], p_project_ids_matching_search uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_tasks_sorted_by_due_date(p_connection_ids uuid[], p_limit_count integer, p_offset_count integer, p_search_query text, p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[], p_matching_user_ids uuid[], p_matching_connection_ids uuid[], p_project_ids_matching_search uuid[]) IS 'Returns tasks sorted by due date with Done/non-Done separation. Non-Done tasks sorted by due_date ASC (nulls last), then created_at DESC. Done tasks sorted by completed_at DESC (newest first). Non-Done tasks appear first. Supports search by title/description/status, profile names, organization names, and project names. Respects RLS policies automatically.';


--
-- Name: get_tasks_sorted_by_org_name(uuid[], text, integer, integer, text, uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tasks_sorted_by_org_name(p_connection_ids uuid[], p_sort_type text, p_limit_count integer, p_offset_count integer, p_search_query text DEFAULT NULL::text, p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_assigned_to_user_ids uuid[] DEFAULT NULL::uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result json;
  v_search_pattern text;
  v_status_match text;
BEGIN
  -- Validate inputs
  IF p_connection_ids IS NULL OR array_length(p_connection_ids, 1) IS NULL THEN
    RETURN '[]'::json;
  END IF;

  -- Validate sort type
  IF p_sort_type NOT IN ('client_asc', 'client_desc', 'agency_asc', 'agency_desc') THEN
    RAISE EXCEPTION 'Invalid sort_type: %. Must be one of: client_asc, client_desc, agency_asc, agency_desc', p_sort_type;
  END IF;

  -- Prepare search pattern
  IF p_search_query IS NOT NULL AND p_search_query != '' THEN
    v_search_pattern := '%' || p_search_query || '%';
    -- Check if search matches a status
    v_status_match := CASE LOWER(TRIM(p_search_query))
      WHEN 'to do' THEN 'to_do'
      WHEN 'todo' THEN 'to_do'
      WHEN 'open' THEN 'to_do'
      WHEN 'backlog' THEN 'to_do'
      WHEN 'in progress' THEN 'in_progress'
      WHEN 'progress' THEN 'in_progress'
      WHEN 'active' THEN 'in_progress'
      WHEN 'working' THEN 'in_progress'
      WHEN 'on hold' THEN 'on_hold'
      WHEN 'hold' THEN 'on_hold'
      WHEN 'paused' THEN 'on_hold'
      WHEN 'blocked' THEN 'on_hold'
      WHEN 'completed' THEN 'done'
      WHEN 'complete' THEN 'done'
      WHEN 'done' THEN 'done'
      WHEN 'finished' THEN 'done'
      ELSE NULL
    END;
  END IF;

  -- Build and execute query based on sort type
  -- Complex sorting logic:
  -- 1. Sort by org name (A-Z or Z-A)
  -- 2. Within same org: Done tasks at bottom
  -- 3. Within Done: sort by completed_at DESC
  -- 4. Within active: sort by due_date ASC (nulls last), then created_at DESC
  IF p_sort_type = 'client_asc' THEN
    -- Sort by client organization name (A-Z)
    WITH ordered_tasks AS (
      SELECT 
        t.id,
        t.connection_id,
        t.project_id,
        t.title,
        t.description,
        t.status::text AS status,
        t.due_date,
        t.assignee_user_id,
        t.client_visible,
        t.created_by_user_id,
        t.created_at,
        t.updated_at,
        t.completed_at,
        t.source_request_id,
        conn.client_id,
        conn.agency_id,
        client_org.name AS client_org_name,
        client_org.logo_url AS client_org_logo,
        agency_org.name AS agency_org_name,
        agency_org.logo_url AS agency_org_logo
      FROM public.tasks t
      INNER JOIN public.connections conn ON t.connection_id = conn.id
      LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
      LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
      WHERE t.connection_id = ANY(p_connection_ids)
        AND t.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR t.assignee_user_id = p_assigned_to_user_id)
        AND (p_assigned_to_user_ids IS NULL OR t.assignee_user_id = ANY(p_assigned_to_user_ids))
        AND (
          v_search_pattern IS NULL OR
          t.title ILIKE v_search_pattern OR
          t.description ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND t.status::text = v_status_match)
        )
      ORDER BY 
        COALESCE(client_org.name, '') COLLATE "C" ASC,
        CASE WHEN t.status::text = 'done' THEN 1 ELSE 0 END ASC, -- Done tasks last within org
        CASE WHEN t.status::text = 'done' THEN t.completed_at END DESC NULLS LAST, -- Done: newest completed first
        CASE WHEN t.status::text != 'done' THEN t.due_date END ASC NULLS LAST, -- Active: soonest due first
        t.created_at DESC -- Tiebreaker: newest created first
      LIMIT p_limit_count
      OFFSET p_offset_count
    )
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'connection_id', connection_id,
        'project_id', project_id,
        'title', title,
        'description', description,
        'status', status,
        'due_date', due_date,
        'assignee_user_id', assignee_user_id,
        'client_visible', client_visible,
        'created_by_user_id', created_by_user_id,
        'created_at', created_at,
        'updated_at', updated_at,
        'completed_at', completed_at,
        'source_request_id', source_request_id,
        'client_id', client_id,
        'agency_id', agency_id,
        'client_org_name', client_org_name,
        'client_org_logo', client_org_logo,
        'agency_org_name', agency_org_name,
        'agency_org_logo', agency_org_logo
      )
    ), '[]'::json)
    INTO v_result
    FROM ordered_tasks;
  ELSIF p_sort_type = 'client_desc' THEN
    -- Sort by client organization name (Z-A)
    WITH ordered_tasks AS (
      SELECT 
        t.id,
        t.connection_id,
        t.project_id,
        t.title,
        t.description,
        t.status::text AS status,
        t.due_date,
        t.assignee_user_id,
        t.client_visible,
        t.created_by_user_id,
        t.created_at,
        t.updated_at,
        t.completed_at,
        t.source_request_id,
        conn.client_id,
        conn.agency_id,
        client_org.name AS client_org_name,
        client_org.logo_url AS client_org_logo,
        agency_org.name AS agency_org_name,
        agency_org.logo_url AS agency_org_logo
      FROM public.tasks t
      INNER JOIN public.connections conn ON t.connection_id = conn.id
      LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
      LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
      WHERE t.connection_id = ANY(p_connection_ids)
        AND t.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR t.assignee_user_id = p_assigned_to_user_id)
        AND (p_assigned_to_user_ids IS NULL OR t.assignee_user_id = ANY(p_assigned_to_user_ids))
        AND (
          v_search_pattern IS NULL OR
          t.title ILIKE v_search_pattern OR
          t.description ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND t.status::text = v_status_match)
        )
      ORDER BY 
        COALESCE(client_org.name, '') COLLATE "C" DESC,
        CASE WHEN t.status::text = 'done' THEN 1 ELSE 0 END ASC, -- Done tasks last within org
        CASE WHEN t.status::text = 'done' THEN t.completed_at END DESC NULLS LAST, -- Done: newest completed first
        CASE WHEN t.status::text != 'done' THEN t.due_date END ASC NULLS LAST, -- Active: soonest due first
        t.created_at DESC -- Tiebreaker: newest created first
      LIMIT p_limit_count
      OFFSET p_offset_count
    )
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'connection_id', connection_id,
        'project_id', project_id,
        'title', title,
        'description', description,
        'status', status,
        'due_date', due_date,
        'assignee_user_id', assignee_user_id,
        'client_visible', client_visible,
        'created_by_user_id', created_by_user_id,
        'created_at', created_at,
        'updated_at', updated_at,
        'completed_at', completed_at,
        'source_request_id', source_request_id,
        'client_id', client_id,
        'agency_id', agency_id,
        'client_org_name', client_org_name,
        'client_org_logo', client_org_logo,
        'agency_org_name', agency_org_name,
        'agency_org_logo', agency_org_logo
      )
    ), '[]'::json)
    INTO v_result
    FROM ordered_tasks;
  ELSIF p_sort_type = 'agency_asc' THEN
    -- Sort by agency organization name (A-Z)
    WITH ordered_tasks AS (
      SELECT 
        t.id,
        t.connection_id,
        t.project_id,
        t.title,
        t.description,
        t.status::text AS status,
        t.due_date,
        t.assignee_user_id,
        t.client_visible,
        t.created_by_user_id,
        t.created_at,
        t.updated_at,
        t.completed_at,
        t.source_request_id,
        conn.client_id,
        conn.agency_id,
        client_org.name AS client_org_name,
        client_org.logo_url AS client_org_logo,
        agency_org.name AS agency_org_name,
        agency_org.logo_url AS agency_org_logo
      FROM public.tasks t
      INNER JOIN public.connections conn ON t.connection_id = conn.id
      LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
      LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
      WHERE t.connection_id = ANY(p_connection_ids)
        AND t.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR t.assignee_user_id = p_assigned_to_user_id)
        AND (p_assigned_to_user_ids IS NULL OR t.assignee_user_id = ANY(p_assigned_to_user_ids))
        AND (
          v_search_pattern IS NULL OR
          t.title ILIKE v_search_pattern OR
          t.description ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND t.status::text = v_status_match)
        )
      ORDER BY 
        COALESCE(agency_org.name, '') COLLATE "C" ASC,
        CASE WHEN t.status::text = 'done' THEN 1 ELSE 0 END ASC, -- Done tasks last within org
        CASE WHEN t.status::text = 'done' THEN t.completed_at END DESC NULLS LAST, -- Done: newest completed first
        CASE WHEN t.status::text != 'done' THEN t.due_date END ASC NULLS LAST, -- Active: soonest due first
        t.created_at DESC -- Tiebreaker: newest created first
      LIMIT p_limit_count
      OFFSET p_offset_count
    )
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'connection_id', connection_id,
        'project_id', project_id,
        'title', title,
        'description', description,
        'status', status,
        'due_date', due_date,
        'assignee_user_id', assignee_user_id,
        'client_visible', client_visible,
        'created_by_user_id', created_by_user_id,
        'created_at', created_at,
        'updated_at', updated_at,
        'completed_at', completed_at,
        'source_request_id', source_request_id,
        'client_id', client_id,
        'agency_id', agency_id,
        'client_org_name', client_org_name,
        'client_org_logo', client_org_logo,
        'agency_org_name', agency_org_name,
        'agency_org_logo', agency_org_logo
      )
    ), '[]'::json)
    INTO v_result
    FROM ordered_tasks;
  ELSE
    -- Sort by agency organization name (Z-A)
    WITH ordered_tasks AS (
      SELECT 
        t.id,
        t.connection_id,
        t.project_id,
        t.title,
        t.description,
        t.status::text AS status,
        t.due_date,
        t.assignee_user_id,
        t.client_visible,
        t.created_by_user_id,
        t.created_at,
        t.updated_at,
        t.completed_at,
        t.source_request_id,
        conn.client_id,
        conn.agency_id,
        client_org.name AS client_org_name,
        client_org.logo_url AS client_org_logo,
        agency_org.name AS agency_org_name,
        agency_org.logo_url AS agency_org_logo
      FROM public.tasks t
      INNER JOIN public.connections conn ON t.connection_id = conn.id
      LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
      LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
      WHERE t.connection_id = ANY(p_connection_ids)
        AND t.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR t.assignee_user_id = p_assigned_to_user_id)
        AND (p_assigned_to_user_ids IS NULL OR t.assignee_user_id = ANY(p_assigned_to_user_ids))
        AND (
          v_search_pattern IS NULL OR
          t.title ILIKE v_search_pattern OR
          t.description ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND t.status::text = v_status_match)
        )
      ORDER BY 
        COALESCE(agency_org.name, '') COLLATE "C" DESC,
        CASE WHEN t.status::text = 'done' THEN 1 ELSE 0 END ASC, -- Done tasks last within org
        CASE WHEN t.status::text = 'done' THEN t.completed_at END DESC NULLS LAST, -- Done: newest completed first
        CASE WHEN t.status::text != 'done' THEN t.due_date END ASC NULLS LAST, -- Active: soonest due first
        t.created_at DESC -- Tiebreaker: newest created first
      LIMIT p_limit_count
      OFFSET p_offset_count
    )
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', id,
        'connection_id', connection_id,
        'project_id', project_id,
        'title', title,
        'description', description,
        'status', status,
        'due_date', due_date,
        'assignee_user_id', assignee_user_id,
        'client_visible', client_visible,
        'created_by_user_id', created_by_user_id,
        'created_at', created_at,
        'updated_at', updated_at,
        'completed_at', completed_at,
        'source_request_id', source_request_id,
        'client_id', client_id,
        'agency_id', agency_id,
        'client_org_name', client_org_name,
        'client_org_logo', client_org_logo,
        'agency_org_name', agency_org_name,
        'agency_org_logo', agency_org_logo
      )
    ), '[]'::json)
    INTO v_result
    FROM ordered_tasks;
  END IF;

  -- Return empty array if no results
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;


--
-- Name: FUNCTION get_tasks_sorted_by_org_name(p_connection_ids uuid[], p_sort_type text, p_limit_count integer, p_offset_count integer, p_search_query text, p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_tasks_sorted_by_org_name(p_connection_ids uuid[], p_sort_type text, p_limit_count integer, p_offset_count integer, p_search_query text, p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[]) IS 'Returns tasks sorted by organization name (client or agency) through connections. Bypasses PostgREST limitation of not supporting ordering through two-level nested joins. Handles complex sorting: org name → Done separation → due_date/created_at. Respects RLS policies automatically.';


--
-- Name: get_tasks_sorted_by_status(uuid[], integer, integer, text, uuid, uuid[], uuid[], uuid[], uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tasks_sorted_by_status(p_connection_ids uuid[], p_limit_count integer, p_offset_count integer, p_search_query text DEFAULT NULL::text, p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_assigned_to_user_ids uuid[] DEFAULT NULL::uuid[], p_matching_user_ids uuid[] DEFAULT NULL::uuid[], p_matching_connection_ids uuid[] DEFAULT NULL::uuid[], p_project_ids_matching_search uuid[] DEFAULT NULL::uuid[]) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result json;
  v_search_pattern text;
  v_status_match text;
BEGIN
  -- Validate inputs
  IF p_connection_ids IS NULL OR array_length(p_connection_ids, 1) IS NULL THEN
    RETURN '[]'::json;
  END IF;

  -- Prepare search pattern
  IF p_search_query IS NOT NULL AND p_search_query != '' THEN
    v_search_pattern := '%' || p_search_query || '%';
    -- Check if search matches a status
    v_status_match := CASE LOWER(TRIM(p_search_query))
      WHEN 'to do' THEN 'to_do'
      WHEN 'todo' THEN 'to_do'
      WHEN 'open' THEN 'to_do'
      WHEN 'backlog' THEN 'to_do'
      WHEN 'in progress' THEN 'in_progress'
      WHEN 'progress' THEN 'in_progress'
      WHEN 'active' THEN 'in_progress'
      WHEN 'working' THEN 'in_progress'
      WHEN 'on hold' THEN 'on_hold'
      WHEN 'hold' THEN 'on_hold'
      WHEN 'paused' THEN 'on_hold'
      WHEN 'blocked' THEN 'on_hold'
      WHEN 'completed' THEN 'done'
      WHEN 'complete' THEN 'done'
      WHEN 'done' THEN 'done'
      WHEN 'finished' THEN 'done'
      ELSE NULL
    END;
  END IF;

  -- Build and execute query
  WITH ordered_tasks AS (
    SELECT 
      t.id,
      t.connection_id,
      t.project_id,
      t.title,
      t.description,
      t.status::text AS status,
      t.due_date,
      t.assignee_user_id,
      t.client_visible,
      t.created_by_user_id,
      t.created_at,
      t.updated_at,
      t.completed_at,
      t.source_request_id,
      conn.client_id,
      conn.agency_id,
      client_org.name AS client_org_name,
      client_org.logo_url AS client_org_logo,
      agency_org.name AS agency_org_name,
      agency_org.logo_url AS agency_org_logo
    FROM public.tasks t
    INNER JOIN public.connections conn ON t.connection_id = conn.id
    LEFT JOIN public.organizations client_org ON conn.client_id = client_org.id AND client_org.deleted_at IS NULL
    LEFT JOIN public.organizations agency_org ON conn.agency_id = agency_org.id AND agency_org.deleted_at IS NULL
    WHERE t.connection_id = ANY(p_connection_ids)
      AND t.deleted_at IS NULL
      AND (p_assigned_to_user_id IS NULL OR t.assignee_user_id = p_assigned_to_user_id)
      AND (p_assigned_to_user_ids IS NULL OR t.assignee_user_id = ANY(p_assigned_to_user_ids))
      AND (
        -- If no search at all, include all tasks
        (v_search_pattern IS NULL 
         AND (p_matching_user_ids IS NULL OR array_length(p_matching_user_ids, 1) IS NULL OR array_length(p_matching_user_ids, 1) = 0)
         AND (p_matching_connection_ids IS NULL OR array_length(p_matching_connection_ids, 1) IS NULL OR array_length(p_matching_connection_ids, 1) = 0)
         AND (p_project_ids_matching_search IS NULL OR array_length(p_project_ids_matching_search, 1) IS NULL OR array_length(p_project_ids_matching_search, 1) = 0)
        ) OR
        -- Text search matches
        (v_search_pattern IS NOT NULL AND (
          t.title ILIKE v_search_pattern OR
          t.description ILIKE v_search_pattern OR
          (v_status_match IS NOT NULL AND t.status::text = v_status_match)
        )) OR
        -- Profile name matches
        (p_matching_user_ids IS NOT NULL AND array_length(p_matching_user_ids, 1) > 0 AND (
          t.created_by_user_id = ANY(p_matching_user_ids) OR
          t.assignee_user_id = ANY(p_matching_user_ids)
        )) OR
        -- Organization name matches
        (p_matching_connection_ids IS NOT NULL AND array_length(p_matching_connection_ids, 1) > 0 AND 
         t.connection_id = ANY(p_matching_connection_ids)
        ) OR
        -- Project name matches
        (p_project_ids_matching_search IS NOT NULL AND array_length(p_project_ids_matching_search, 1) > 0 AND 
         t.project_id = ANY(p_project_ids_matching_search)
        )
      )
    ORDER BY 
      t.status ASC,
      t.created_at DESC
    LIMIT p_limit_count
    OFFSET p_offset_count
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', id,
      'connection_id', connection_id,
      'project_id', project_id,
      'title', title,
      'description', description,
      'status', status,
      'due_date', due_date,
      'assignee_user_id', assignee_user_id,
      'client_visible', client_visible,
      'created_by_user_id', created_by_user_id,
      'created_at', created_at,
      'updated_at', updated_at,
      'completed_at', completed_at,
      'source_request_id', source_request_id,
      'client_id', client_id,
      'agency_id', agency_id,
      'client_org_name', client_org_name,
      'client_org_logo', client_org_logo,
      'agency_org_name', agency_org_name,
      'agency_org_logo', agency_org_logo
    )
  ), '[]'::json)
  INTO v_result
  FROM ordered_tasks;

  -- Return empty array if no results
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;


--
-- Name: FUNCTION get_tasks_sorted_by_status(p_connection_ids uuid[], p_limit_count integer, p_offset_count integer, p_search_query text, p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[], p_matching_user_ids uuid[], p_matching_connection_ids uuid[], p_project_ids_matching_search uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_tasks_sorted_by_status(p_connection_ids uuid[], p_limit_count integer, p_offset_count integer, p_search_query text, p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[], p_matching_user_ids uuid[], p_matching_connection_ids uuid[], p_project_ids_matching_search uuid[]) IS 'Returns tasks sorted by status ASC, then created_at DESC. Handles pagination, search, and assignee filtering. Supports search by title/description/status, profile names, organization names, and project names. Respects RLS policies automatically.';


--
-- Name: get_user_org_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_org_ids(p_user_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select org_id
  from public.memberships
  where user_id = p_user_id;
$$;


--
-- Name: handle_billing_downgrade(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_billing_downgrade() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
  v_oldest_client_initiated_id uuid;
BEGIN
  -- Only process if billing_status changed from paid to free
  IF OLD.billing_status != 'free' AND NEW.billing_status = 'free' THEN
    v_org_id := NEW.id;
    
    -- Step 1: Cancel all 'invited' connections - flip to 'internal'
    UPDATE connections
    SET 
      connection_status = 'internal',
      invited_email = NULL,
      invited_at = NULL,
      invite_token = NULL,
      updated_at = NOW()
    WHERE agency_id = v_org_id
      AND connection_status = 'invited';
    
    -- Step 2: Handle client-initiated 'connected' connections
    -- Find the oldest client-initiated connected connection (by created_at)
    SELECT id INTO v_oldest_client_initiated_id
    FROM connections
    WHERE agency_id = v_org_id
      AND created_by_org_id = client_id
      AND connection_status = 'connected'
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Disconnect all client-initiated connected connections except the oldest
    UPDATE connections
    SET 
      connection_status = 'disconnected',
      disconnected_at = NOW(),
      updated_at = NOW()
    WHERE agency_id = v_org_id
      AND created_by_org_id = client_id
      AND connection_status = 'connected'
      AND (v_oldest_client_initiated_id IS NULL OR id != v_oldest_client_initiated_id);
    
    -- Note: Internal connections remain 'internal' status
    -- Read-only state is detected dynamically in application code
    -- based on billing_status = 'free' + connection count + ordering
    
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION handle_billing_downgrade(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_billing_downgrade() IS 'Automatically enforces connection limits when organizations downgrade from paid to free. Cancels invited connections, disconnects excess client-initiated connections. Internal connections remain internal but become read-only (detected dynamically).';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;


--
-- Name: search_clients_with_requests(text, uuid[], text, text[], uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_clients_with_requests(p_search_text text, p_connection_ids uuid[], p_view_type text DEFAULT 'agency'::text, p_status_filter text[] DEFAULT NULL::text[], p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_created_by_user_id uuid DEFAULT NULL::uuid) RETURNS TABLE(client_id uuid, client_name text, client_logo_url text, requests jsonb)
    LANGUAGE sql STABLE
    AS $$
  WITH matching_orgs AS (
    -- 1. Find matching organizations by name (Fast Index Scan with fuzzy word matching)
    -- For agency view: search client organizations
    -- For client view: search agency organizations
    -- Uses word-based fuzzy matching: splits search text into words and matches if all words appear
    SELECT DISTINCT o.id, o.name, o.logo_url
    FROM organizations o
    INNER JOIN connections c ON (
      (p_view_type = 'agency' AND c.client_id = o.id) OR
      (p_view_type != 'agency' AND c.agency_id = o.id)
    )
    WHERE c.id = ANY(p_connection_ids)
    AND o.deleted_at IS NULL
    AND (
      -- Simple substring match for single word or exact phrase
      o.name ILIKE '%' || p_search_text || '%'
      OR
      -- Word-based fuzzy match: all words from search must appear in name
      -- Only do this if search contains spaces (multiple words)
      (
        p_search_text ~ ' ' AND
        (
          SELECT bool_and(o.name ILIKE '%' || word || '%')
          FROM unnest(string_to_array(trim(p_search_text), ' ')) AS word
        )
      )
    )
    LIMIT 50 -- Safety limit: max 50 clients
  ),
  client_requests AS (
    -- 2. Get requests for matching clients
    SELECT 
      mo.id as org_id,
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'title', r.title,
          'description', r.description,
          'status', r.status::text,
          'project_id', r.project_id,
          'project_name_cached', r.project_name_cached,
          'connection_id', r.connection_id,
          'created_by_user_id', r.created_by_user_id,
          'assignee_user_id', r.assignee_user_id,
          'created_at', r.created_at,
          'created_by_org_id', r.created_by_org_id
        ) ORDER BY r.created_at DESC, r.id DESC
      ) FILTER (WHERE r.id IS NOT NULL) as requests_json
    FROM matching_orgs mo
    INNER JOIN connections c ON (
      (p_view_type = 'agency' AND c.client_id = mo.id) OR
      (p_view_type != 'agency' AND c.agency_id = mo.id)
    )
    LEFT JOIN requests r ON r.connection_id = c.id
      AND r.deleted_at IS NULL
      AND (p_status_filter IS NULL OR r.status::text = ANY(p_status_filter))
      AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
      AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
    WHERE c.id = ANY(p_connection_ids)
    GROUP BY mo.id
  )
  SELECT 
    mo.id as client_id,
    mo.name as client_name,
    COALESCE(mo.logo_url, '') as client_logo_url,
    COALESCE(cr.requests_json, '[]'::jsonb) as requests
  FROM matching_orgs mo
  LEFT JOIN client_requests cr ON mo.id = cr.org_id
  ORDER BY mo.name ASC;
$$;


--
-- Name: FUNCTION search_clients_with_requests(p_search_text text, p_connection_ids uuid[], p_view_type text, p_status_filter text[], p_assigned_to_user_id uuid, p_created_by_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.search_clients_with_requests(p_search_text text, p_connection_ids uuid[], p_view_type text, p_status_filter text[], p_assigned_to_user_id uuid, p_created_by_user_id uuid) IS 'Searches organization names and returns clients with their requests pre-loaded as JSONB. Used for atomic search results that eliminate timing issues. Returns max 50 clients.';


--
-- Name: search_clients_with_tasks(text, uuid[], text, text[], uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_clients_with_tasks(p_search_text text, p_connection_ids uuid[], p_view_type text DEFAULT 'agency'::text, p_status_filter text[] DEFAULT NULL::text[], p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_assigned_to_user_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(client_id uuid, client_name text, client_logo_url text, tasks jsonb)
    LANGUAGE sql STABLE
    AS $$
  WITH matching_orgs AS (
    -- 1. Find matching organizations by name (Fast Index Scan with fuzzy word matching)
    -- For agency view: search client organizations
    -- For client view: search agency organizations
    -- Uses word-based fuzzy matching: all words from search must appear in name (in any order)
    SELECT DISTINCT o.id, o.name, o.logo_url
    FROM organizations o
    INNER JOIN connections c ON (
      (p_view_type = 'agency' AND c.client_id = o.id) OR
      (p_view_type != 'agency' AND c.agency_id = o.id)
    )
    WHERE c.id = ANY(p_connection_ids)
    AND o.deleted_at IS NULL
    AND (
      -- Fast path: simple substring match (works for single words and exact phrases)
      o.name ILIKE '%' || p_search_text || '%'
      OR
      -- Fuzzy path: word-based matching (only if search has multiple words)
      -- Replace spaces with '%' to create a fuzzy pattern: "Acme Corp" -> "%Acme%Corp%"
      (p_search_text ~ ' ' AND o.name ILIKE '%' || replace(p_search_text, ' ', '%') || '%')
    )
    LIMIT 50 -- Safety limit: max 50 clients
  ),
  client_tasks AS (
    -- 2. Get tasks for matching clients
    SELECT 
      mo.id as org_id,
      jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'connection_id', t.connection_id,
          'project_id', t.project_id,
          'title', t.title,
          'description', t.description,
          'status', t.status::text,
          'due_date', t.due_date,
          'assignee_user_id', t.assignee_user_id,
          'client_visible', t.client_visible,
          'created_by_user_id', t.created_by_user_id,
          'created_at', t.created_at,
          'updated_at', t.updated_at,
          'completed_at', t.completed_at,
          'source_request_id', t.source_request_id
        ) ORDER BY t.created_at DESC, t.id DESC
      ) FILTER (WHERE t.id IS NOT NULL) as tasks_json
    FROM matching_orgs mo
    INNER JOIN connections c ON (
      (p_view_type = 'agency' AND c.client_id = mo.id) OR
      (p_view_type != 'agency' AND c.agency_id = mo.id)
    )
    LEFT JOIN tasks t ON t.connection_id = c.id
      AND t.deleted_at IS NULL
      AND (p_status_filter IS NULL OR t.status::text = ANY(p_status_filter))
      AND (
        (p_assigned_to_user_id IS NULL AND p_assigned_to_user_ids IS NULL) OR
        (p_assigned_to_user_id IS NOT NULL AND t.assignee_user_id = p_assigned_to_user_id) OR
        (p_assigned_to_user_ids IS NOT NULL AND t.assignee_user_id = ANY(p_assigned_to_user_ids))
      )
    WHERE c.id = ANY(p_connection_ids)
    GROUP BY mo.id
  )
  SELECT 
    mo.id as client_id,
    mo.name as client_name,
    COALESCE(mo.logo_url, '') as client_logo_url,
    COALESCE(ct.tasks_json, '[]'::jsonb) as tasks
  FROM matching_orgs mo
  LEFT JOIN client_tasks ct ON mo.id = ct.org_id
  ORDER BY mo.name ASC;
$$;


--
-- Name: FUNCTION search_clients_with_tasks(p_search_text text, p_connection_ids uuid[], p_view_type text, p_status_filter text[], p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.search_clients_with_tasks(p_search_text text, p_connection_ids uuid[], p_view_type text, p_status_filter text[], p_assigned_to_user_id uuid, p_assigned_to_user_ids uuid[]) IS 'Searches organization names and returns clients with their tasks pre-loaded as JSONB. Used for atomic search results that eliminate timing issues. Returns max 50 clients.';


--
-- Name: search_requests_global(text, uuid[], uuid, uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_requests_global(p_search_query text, p_connection_ids uuid[], p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_created_by_user_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, title text, description text, status text, project_id uuid, project_name_cached text, connection_id uuid, created_by_user_id uuid, assignee_user_id uuid, created_at timestamp with time zone, created_by_org_id uuid, rank real, total_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_tsquery tsquery;
  v_total_count BIGINT;
BEGIN
  -- Convert search query to tsquery format
  v_tsquery := plainto_tsquery('english', p_search_query);
  
  -- Get total count of matching requests
  SELECT COUNT(*) INTO v_total_count
  FROM public.requests r
  WHERE r.search_vector @@ v_tsquery
    AND r.connection_id = ANY(p_connection_ids)
    AND r.deleted_at IS NULL
    AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
    AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id);
  
  -- Return requests with relevance ranking
  RETURN QUERY
  SELECT 
    r.id,
    r.title,
    r.description,
    r.status,
    r.project_id,
    r.project_name_cached,
    r.connection_id,
    r.created_by_user_id,
    r.assignee_user_id,
    r.created_at,
    r.created_by_org_id,
    ts_rank(r.search_vector, v_tsquery) as rank,
    v_total_count as total_count
  FROM public.requests r
  WHERE r.search_vector @@ v_tsquery
    AND r.connection_id = ANY(p_connection_ids)
    AND r.deleted_at IS NULL
    AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
    AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
  ORDER BY 
    ts_rank(r.search_vector, v_tsquery) DESC,  -- Relevance first
    r.created_at DESC  -- Then by date as tiebreaker
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


--
-- Name: search_tasks_global(text, uuid[], uuid, uuid[], integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_tasks_global(p_search_query text, p_connection_ids uuid[], p_assigned_to_user_id uuid DEFAULT NULL::uuid, p_assigned_to_user_ids uuid[] DEFAULT NULL::uuid[], p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, connection_id uuid, project_id uuid, title text, description text, status text, due_date timestamp with time zone, assignee_user_id uuid, client_visible boolean, created_by_user_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, completed_at timestamp with time zone, source_request_id uuid, rank real, total_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_tsquery tsquery;
  v_total_count BIGINT;
BEGIN
  -- Convert search query to tsquery format
  v_tsquery := plainto_tsquery('english', p_search_query);
  
  -- Get total count of matching tasks
  SELECT COUNT(*) INTO v_total_count
  FROM public.tasks t
  WHERE t.search_vector @@ v_tsquery
    AND t.connection_id = ANY(p_connection_ids)
    AND t.deleted_at IS NULL
    AND (p_assigned_to_user_id IS NULL OR t.assignee_user_id = p_assigned_to_user_id)
    AND (p_assigned_to_user_ids IS NULL OR t.assignee_user_id = ANY(p_assigned_to_user_ids));
  
  -- Return tasks with relevance ranking
  RETURN QUERY
  SELECT 
    t.id,
    t.connection_id,
    t.project_id,
    t.title,
    t.description,
    t.status,
    t.due_date,
    t.assignee_user_id,
    t.client_visible,
    t.created_by_user_id,
    t.created_at,
    t.updated_at,
    t.completed_at,
    t.source_request_id,
    ts_rank(t.search_vector, v_tsquery) as rank,
    v_total_count as total_count
  FROM public.tasks t
  WHERE t.search_vector @@ v_tsquery
    AND t.connection_id = ANY(p_connection_ids)
    AND t.deleted_at IS NULL
    AND (p_assigned_to_user_id IS NULL OR t.assignee_user_id = p_assigned_to_user_id)
    AND (p_assigned_to_user_ids IS NULL OR t.assignee_user_id = ANY(p_assigned_to_user_ids))
  ORDER BY 
    ts_rank(t.search_vector, v_tsquery) DESC,  -- Relevance first
    t.created_at DESC  -- Then by date as tiebreaker
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


--
-- Name: sync_profile_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_profile_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.profiles
     set email = new.email,
         updated_at = now()
   where id = new.id;
  return new;
end;
$$;


--
-- Name: update_request_search_vector(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_request_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  org_names TEXT := '';
BEGIN
  -- Fetch both client and agency organization names
  SELECT COALESCE(
    string_agg(DISTINCT o.name, ' '), 
    ''
  ) INTO org_names
  FROM public.connections c
  LEFT JOIN public.organizations o ON (
    o.id = c.client_id OR o.id = c.agency_id
  )
  WHERE c.id = NEW.connection_id
  AND o.name IS NOT NULL;
  
  -- Update search_vector with request title (weight A) and organization names (weight B)
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', org_names), 'B');
  
  RETURN NEW;
END;
$$;


--
-- Name: update_requests_on_org_name_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_requests_on_org_name_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update all requests connected to this organization
  -- Recalculate search_vector using the same logic as the trigger
  UPDATE public.requests r
  SET search_vector = 
    setweight(to_tsvector('english', COALESCE(r.title, '')), 'A') ||
    setweight(
      to_tsvector('english', 
        COALESCE((
          SELECT string_agg(DISTINCT o.name, ' ')
          FROM public.connections c
          LEFT JOIN public.organizations o ON (
            o.id = c.client_id OR o.id = c.agency_id
          )
          WHERE c.id = r.connection_id
          AND o.name IS NOT NULL
        ), '')
      ), 
      'B'
    )
  WHERE r.connection_id IN (
    SELECT id FROM public.connections 
    WHERE client_id = NEW.id OR agency_id = NEW.id
  )
  AND r.deleted_at IS NULL;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_task_search_vector(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_task_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  org_names TEXT := '';
BEGIN
  -- Fetch both client and agency organization names
  SELECT COALESCE(
    string_agg(DISTINCT o.name, ' '), 
    ''
  ) INTO org_names
  FROM public.connections c
  LEFT JOIN public.organizations o ON (
    o.id = c.client_id OR o.id = c.agency_id
  )
  WHERE c.id = NEW.connection_id
  AND o.name IS NOT NULL;
  
  -- Update search_vector with task title (weight A) and organization names (weight B)
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', org_names), 'B');
  
  RETURN NEW;
END;
$$;


--
-- Name: update_tasks_on_org_name_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_tasks_on_org_name_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update all tasks connected to this organization
  -- Recalculate search_vector using the same logic as the trigger
  UPDATE public.tasks t
  SET search_vector = 
    setweight(to_tsvector('english', COALESCE(t.title, '')), 'A') ||
    setweight(
      to_tsvector('english', 
        COALESCE((
          SELECT string_agg(DISTINCT o.name, ' ')
          FROM public.connections c
          LEFT JOIN public.organizations o ON (
            o.id = c.client_id OR o.id = c.agency_id
          )
          WHERE c.id = t.connection_id
          AND o.name IS NOT NULL
        ), '')
      ), 
      'B'
    )
  WHERE t.connection_id IN (
    SELECT id FROM public.connections 
    WHERE client_id = NEW.id OR agency_id = NEW.id
  )
  AND t.deleted_at IS NULL;
  
  RETURN NEW;
END;
$$;


--
-- Name: user_can_view_org_members(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_can_view_org_members(org_id_param uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.org_id = org_id_param
  );
$$;


--
-- Name: user_has_org_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_org_access(org_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = org_id 
      AND o.deleted_at IS NULL
      AND (
        o.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM memberships m
          WHERE m.org_id = org_id 
            AND m.user_id = auth.uid()
        )
      )
  );
END;
$$;


--
-- Name: user_is_in_my_owned_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_is_in_my_owned_org(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.organizations o
    join public.memberships m on m.org_id = o.id
    where o.owner_id = auth.uid()
      and o.deleted_at is null
      and m.user_id = p_user_id
  );
$$;


--
-- Name: user_is_member_of_org(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_is_member_of_org(p_org_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = p_user_id
  );
$$;


--
-- Name: user_is_owner_of_org(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_is_owner_of_org(p_org_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.organizations o
    where o.id = p_org_id
      and o.owner_id = p_user_id
      and o.deleted_at is null
  );
$$;


--
-- Name: users_share_org(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_share_org(p_user_a uuid, p_user_b uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.memberships ma
    join public.memberships mb
      on mb.org_id = ma.org_id
    where ma.user_id = p_user_a
      and mb.user_id = p_user_b
  );
$$;


--
-- Name: validate_invitation_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_invitation_token(token uuid) RETURNS TABLE(is_valid boolean, org_name text, invited_email text, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN mi.id IS NOT NULL AND mi.status = 'pending' AND mi.expires_at > NOW() 
      THEN TRUE 
      ELSE FALSE 
    END as is_valid,
    o.name as org_name,
    mi.invited_email,
    mi.expires_at
  FROM membership_invitations mi
  LEFT JOIN organizations o ON mi.org_id = o.id
  WHERE mi.invite_token = token;
END;
$$;


--
-- Name: verify_invite_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_invite_token(token_hash text) RETURNS TABLE(connection_id uuid, client_id uuid, invited_email text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Return connection details if token hash matches and is not expired
  -- Token is already hashed in the application layer (Node.js)
  -- Returns the draft org ID (client_id for agency-invited clients, agency_id for client-invited agencies)
  -- The client_id field is used generically to return the draft org ID
  RETURN QUERY
  SELECT
    c.id AS connection_id,
    CASE 
      -- If client org is draft, return client_id
      WHEN EXISTS (
        SELECT 1 FROM public.organizations o 
        WHERE o.id = c.client_id AND o.is_draft = true
      ) THEN c.client_id
      -- If agency org is draft, return agency_id
      WHEN EXISTS (
        SELECT 1 FROM public.organizations o 
        WHERE o.id = c.agency_id AND o.is_draft = true
      ) THEN c.agency_id
      -- Fallback (shouldn't happen if data is consistent)
      ELSE c.client_id
    END AS client_id,
    c.invited_email
  FROM public.connections c
  WHERE c.invite_token = token_hash
    AND c.invited_at IS NOT NULL
    AND c.invited_at > (NOW() - INTERVAL '7 days')
    AND c.connection_status IN ('internal', 'invited');
END;
$$;


--
-- Name: FUNCTION verify_invite_token(token_hash text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.verify_invite_token(token_hash text) IS 'Verifies an invite token hash (pre-hashed in Node.js) and checks against connections table. Returns connection details if token is valid and not expired (7 days). Accepts both internal and invited connection statuses. Works for both agency-inviting-client and client-inviting-agency flows. Returns the draft org ID (client_id field contains the draft org ID, whether it is a client or agency org).';


--
-- Name: verify_member_invite_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_member_invite_token(p_token_hash text) RETURNS TABLE(id uuid, org_id uuid, invited_email text, role public.role)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Return invitation details if token hash matches and is not expired
  -- Token is already hashed in the application layer (Node.js)
  -- Use p_token_hash parameter name to avoid conflict with column name
  RETURN QUERY
  SELECT
    mi.id,
    mi.org_id,
    mi.invited_email,
    mi.role
  FROM public.membership_invitations mi
  WHERE mi.token_hash = p_token_hash
    AND mi.status IN ('pending', 'accepted')
    AND mi.expires_at > NOW();
END;
$$;


--
-- Name: FUNCTION verify_member_invite_token(p_token_hash text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.verify_member_invite_token(p_token_hash text) IS 'Verifies a member invitation token hash (pre-hashed in Node.js) and checks against membership_invitations table. Returns invitation details if token is valid, status is pending or accepted, and not expired.';


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_;

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: lock_top_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


--
-- Name: objects_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: objects_update_level_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_level_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: connection_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connection_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid NOT NULL,
    url text NOT NULL,
    label text NOT NULL,
    client_visible boolean DEFAULT false NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE connection_resources; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.connection_resources IS 'Links to documents, dashboard, or folders relevant to a connection';


--
-- Name: connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agency_id uuid NOT NULL,
    client_id uuid NOT NULL,
    agency_primary_contact_id uuid,
    client_primary_contact_id uuid,
    connection_status public.connection_status DEFAULT 'internal'::public.connection_status NOT NULL,
    engagement_status public.engagement_status,
    health_status public.health_status,
    contract_value numeric(12,2),
    contract_end_on date,
    invited_email text,
    invited_at timestamp with time zone,
    invite_token text,
    connected_at timestamp with time zone,
    disconnected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_org_id uuid
);


--
-- Name: TABLE connections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.connections IS 'Links an agency and a client organization';


--
-- Name: membership_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membership_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    invited_by_user uuid,
    invited_email text NOT NULL,
    role public.role DEFAULT 'member'::public.role NOT NULL,
    token_hash text NOT NULL,
    status public."member_invitation_status " DEFAULT 'pending'::public."member_invitation_status " NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE membership_invitations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.membership_invitations IS 'Invitations for users to join an organization';


--
-- Name: memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.role DEFAULT 'member'::public.role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.memberships IS 'Links users to organizations';


--
-- Name: organization_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    url text NOT NULL,
    label text NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE organization_resources; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organization_resources IS 'Links to documents, dashboard, or folders relevant to an organization';


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type public.org_type NOT NULL,
    name text NOT NULL,
    currency_code public.currency_code DEFAULT 'EUR'::public.currency_code NOT NULL,
    connection_code text NOT NULL,
    slug text NOT NULL,
    description text,
    website text,
    industry text,
    logo_url text,
    owner_id uuid DEFAULT auth.uid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    created_by_org_id uuid,
    is_draft boolean DEFAULT false NOT NULL,
    claimed_at timestamp with time zone,
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_price_id text,
    billing_status public.billing_status DEFAULT 'free'::public.billing_status NOT NULL,
    current_period_end timestamp with time zone,
    is_demo boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE organizations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organizations IS 'Stores all organizations (agencies or clients)';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    first_name text,
    last_name text,
    job_title text,
    avatar_url text,
    deleted_at timestamp with time zone,
    updated_at timestamp with time zone,
    is_demo boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.profiles IS 'Stores public profile information for users';


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    status public.project_status DEFAULT 'planned'::public.project_status NOT NULL,
    start_date date,
    end_date date,
    value_amount numeric(12,2),
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid
);


--
-- Name: TABLE projects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.projects IS 'High-level projects that group related tasks and requests for clients and agencies';


--
-- Name: request_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    created_by_user_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: TABLE request_comments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.request_comments IS 'Stores all user comments associated with a request';


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    created_by_user_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: TABLE task_comments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.task_comments IS 'Stores all user comments associated with a task';


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: messages_2025_12_29; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_12_29 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2025_12_30; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_12_30 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2025_12_31; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2025_12_31 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_01_01; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_01_01 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_01_02; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_01_02 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_01_03; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_01_03 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_01_04; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_01_04 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: messages_2025_12_29; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_12_29 FOR VALUES FROM ('2025-12-29 00:00:00') TO ('2025-12-30 00:00:00');


--
-- Name: messages_2025_12_30; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_12_30 FOR VALUES FROM ('2025-12-30 00:00:00') TO ('2025-12-31 00:00:00');


--
-- Name: messages_2025_12_31; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2025_12_31 FOR VALUES FROM ('2025-12-31 00:00:00') TO ('2026-01-01 00:00:00');


--
-- Name: messages_2026_01_01; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_01_01 FOR VALUES FROM ('2026-01-01 00:00:00') TO ('2026-01-02 00:00:00');


--
-- Name: messages_2026_01_02; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_01_02 FOR VALUES FROM ('2026-01-02 00:00:00') TO ('2026-01-03 00:00:00');


--
-- Name: messages_2026_01_03; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_01_03 FOR VALUES FROM ('2026-01-03 00:00:00') TO ('2026-01-04 00:00:00');


--
-- Name: messages_2026_01_04; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_01_04 FOR VALUES FROM ('2026-01-04 00:00:00') TO ('2026-01-05 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: requests Requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT "Requests_pkey" PRIMARY KEY (id);


--
-- Name: connection_resources connection_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_resources
    ADD CONSTRAINT connection_links_pkey PRIMARY KEY (id);


--
-- Name: connections connections_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_invite_token_key UNIQUE (invite_token);


--
-- Name: connections connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_pkey PRIMARY KEY (id);


--
-- Name: membership_invitations membership_invitations_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_invitations
    ADD CONSTRAINT membership_invitations_invite_token_key UNIQUE (token_hash);


--
-- Name: membership_invitations membership_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_invitations
    ADD CONSTRAINT membership_invitations_pkey PRIMARY KEY (id);


--
-- Name: memberships memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);


--
-- Name: organization_resources organization_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_resources
    ADD CONSTRAINT organization_resources_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_connection_code_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_connection_code_key1 UNIQUE (connection_code);


--
-- Name: organizations organizations_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey1 PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key1 UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey1 PRIMARY KEY (id);


--
-- Name: request_comments request_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT request_comments_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: membership_invitations uq_invite_token_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_invitations
    ADD CONSTRAINT uq_invite_token_hash UNIQUE (token_hash);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_12_29 messages_2025_12_29_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_12_29
    ADD CONSTRAINT messages_2025_12_29_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_12_30 messages_2025_12_30_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_12_30
    ADD CONSTRAINT messages_2025_12_30_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2025_12_31 messages_2025_12_31_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2025_12_31
    ADD CONSTRAINT messages_2025_12_31_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_01_01 messages_2026_01_01_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_01_01
    ADD CONSTRAINT messages_2026_01_01_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_01_02 messages_2026_01_02_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_01_02
    ADD CONSTRAINT messages_2026_01_02_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_01_03 messages_2026_01_03_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_01_03
    ADD CONSTRAINT messages_2026_01_03_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_01_04 messages_2026_01_04_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_01_04
    ADD CONSTRAINT messages_2026_01_04_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: idx_connections_agency_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_agency_contact ON public.connections USING btree (agency_primary_contact_id) WHERE (agency_primary_contact_id IS NOT NULL);


--
-- Name: idx_connections_agency_contact_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_agency_contact_composite ON public.connections USING btree (agency_id, agency_primary_contact_id) WHERE (agency_primary_contact_id IS NOT NULL);


--
-- Name: idx_connections_agency_contract_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_agency_contract_end ON public.connections USING btree (agency_id, contract_end_on) WHERE (contract_end_on IS NOT NULL);


--
-- Name: idx_connections_agency_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_agency_created ON public.connections USING btree (agency_id, created_at DESC);


--
-- Name: idx_connections_agency_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_agency_created_desc ON public.connections USING btree (agency_id, created_at DESC);


--
-- Name: idx_connections_agency_health; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_agency_health ON public.connections USING btree (agency_id, health_status) WHERE (health_status IS NOT NULL);


--
-- Name: idx_connections_agency_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_agency_id ON public.connections USING btree (agency_id);


--
-- Name: idx_connections_agency_id_for_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_agency_id_for_sort ON public.connections USING btree (agency_id, id) WHERE (connection_status <> 'disconnected'::public.connection_status);


--
-- Name: idx_connections_agency_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_agency_status ON public.connections USING btree (agency_id, connection_status) WHERE (connection_status <> 'disconnected'::public.connection_status);


--
-- Name: idx_connections_agency_status_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_agency_status_created_desc ON public.connections USING btree (agency_id, connection_status, created_at DESC) WHERE (connection_status <> 'disconnected'::public.connection_status);


--
-- Name: idx_connections_client_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_client_created ON public.connections USING btree (client_id, created_at DESC);


--
-- Name: idx_connections_client_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_client_created_desc ON public.connections USING btree (client_id, created_at DESC);


--
-- Name: idx_connections_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_client_id ON public.connections USING btree (client_id);


--
-- Name: idx_connections_client_id_for_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_client_id_for_sort ON public.connections USING btree (client_id, id) WHERE (connection_status <> 'disconnected'::public.connection_status);


--
-- Name: idx_connections_client_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_client_status ON public.connections USING btree (client_id, connection_status) WHERE (connection_status = ANY (ARRAY['invited'::public.connection_status, 'connected'::public.connection_status, 'disconnected'::public.connection_status]));


--
-- Name: idx_connections_client_status_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_client_status_created_desc ON public.connections USING btree (client_id, connection_status, created_at DESC) WHERE (connection_status <> 'disconnected'::public.connection_status);


--
-- Name: idx_connections_connection_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_connection_status ON public.connections USING btree (connection_status) WHERE (connection_status IS NOT NULL);


--
-- Name: idx_connections_contract_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_contract_end ON public.connections USING btree (agency_id, contract_end_on) WHERE (contract_end_on IS NOT NULL);


--
-- Name: idx_connections_contract_end_on; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_contract_end_on ON public.connections USING btree (contract_end_on) WHERE (contract_end_on IS NOT NULL);


--
-- Name: idx_connections_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_created_at ON public.connections USING btree (created_at DESC);


--
-- Name: idx_connections_engagement_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_engagement_status ON public.connections USING btree (engagement_status) WHERE (engagement_status IS NOT NULL);


--
-- Name: idx_connections_health_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_health_name ON public.connections USING btree (health_status, agency_id) WHERE (health_status IS NOT NULL);


--
-- Name: idx_connections_health_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connections_health_status ON public.connections USING btree (agency_id, health_status);


--
-- Name: idx_invites_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_created_at ON public.membership_invitations USING btree (created_at DESC);


--
-- Name: idx_invites_lower_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_lower_email ON public.membership_invitations USING btree (lower(invited_email));


--
-- Name: idx_invites_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_org ON public.membership_invitations USING btree (org_id);


--
-- Name: idx_invites_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_token_hash ON public.membership_invitations USING btree (token_hash);


--
-- Name: idx_membership_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_membership_invitations_email ON public.membership_invitations USING btree (invited_email);


--
-- Name: idx_membership_invitations_invited_email_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_membership_invitations_invited_email_trgm ON public.membership_invitations USING gin (lower(invited_email) public.gin_trgm_ops) WHERE (status = 'pending'::public."member_invitation_status ");


--
-- Name: idx_membership_invitations_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_membership_invitations_org_id ON public.membership_invitations USING btree (org_id);


--
-- Name: idx_membership_invitations_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_membership_invitations_org_status ON public.membership_invitations USING btree (org_id, status, created_at DESC) WHERE (status = 'pending'::public."member_invitation_status ");


--
-- Name: idx_membership_invitations_org_status_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_membership_invitations_org_status_expires ON public.membership_invitations USING btree (org_id, status, expires_at) WHERE (status = 'pending'::public."member_invitation_status ");


--
-- Name: idx_membership_invitations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_membership_invitations_status ON public.membership_invitations USING btree (org_id, status);


--
-- Name: idx_memberships_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_created_at ON public.memberships USING btree (created_at DESC);


--
-- Name: idx_memberships_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_org_id ON public.memberships USING btree (org_id);


--
-- Name: idx_memberships_org_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_org_role ON public.memberships USING btree (org_id, role);


--
-- Name: idx_memberships_org_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_org_user ON public.memberships USING btree (org_id, user_id);


--
-- Name: idx_memberships_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_user_id ON public.memberships USING btree (user_id);


--
-- Name: idx_memberships_user_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_memberships_user_org ON public.memberships USING btree (user_id, org_id);


--
-- Name: idx_organizations_connection_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_connection_code ON public.organizations USING btree (connection_code);


--
-- Name: idx_organizations_id_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_id_owner ON public.organizations USING btree (id, owner_id);


--
-- Name: idx_organizations_name_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_name_lower ON public.organizations USING btree (lower(COALESCE(name, 'Unknown'::text)));


--
-- Name: INDEX idx_organizations_name_lower; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_organizations_name_lower IS 'Optimizes display name sorting in flat pagination';


--
-- Name: idx_organizations_name_pattern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_name_pattern ON public.organizations USING btree (name text_pattern_ops) WHERE ((deleted_at IS NULL) AND (is_draft = false));


--
-- Name: idx_organizations_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_owner ON public.organizations USING btree (owner_id);


--
-- Name: idx_organizations_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_owner_id ON public.organizations USING btree (owner_id);


--
-- Name: idx_organizations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_slug ON public.organizations USING btree (slug);


--
-- Name: idx_organizations_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_type ON public.organizations USING btree (type);


--
-- Name: idx_orgs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orgs_created_at ON public.organizations USING btree (created_at DESC);


--
-- Name: idx_orgs_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orgs_not_deleted ON public.organizations USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_orgs_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orgs_owner ON public.organizations USING btree (owner_id);


--
-- Name: idx_orgs_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_orgs_slug_unique ON public.organizations USING btree (slug);


--
-- Name: idx_profiles_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_deleted_at ON public.profiles USING btree (deleted_at);


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);


--
-- Name: idx_profiles_email_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email_trgm ON public.profiles USING gin (lower(email) public.gin_trgm_ops) WHERE ((deleted_at IS NULL) AND (email IS NOT NULL));


--
-- Name: idx_profiles_first_name_asc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_first_name_asc ON public.profiles USING btree (first_name) WHERE (deleted_at IS NULL);


--
-- Name: idx_profiles_first_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_first_name_trgm ON public.profiles USING gin (lower(first_name) public.gin_trgm_ops) WHERE (deleted_at IS NULL);


--
-- Name: idx_profiles_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_id ON public.profiles USING btree (id);


--
-- Name: idx_profiles_last_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_last_name_trgm ON public.profiles USING gin (lower(last_name) public.gin_trgm_ops) WHERE (deleted_at IS NULL);


--
-- Name: idx_profiles_lower_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_lower_email ON public.profiles USING btree (lower(email));


--
-- Name: idx_profiles_name_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_name_search ON public.profiles USING btree (first_name, last_name) WHERE (deleted_at IS NULL);


--
-- Name: idx_profiles_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_name_trgm ON public.profiles USING gin (lower(((COALESCE(first_name, ''::text) || ' '::text) || COALESCE(last_name, ''::text))) public.gin_trgm_ops) WHERE (deleted_at IS NULL);


--
-- Name: idx_profiles_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_not_deleted ON public.profiles USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_projects_connection_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_connection_name ON public.projects USING btree (connection_id, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_projects_connection_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_connection_not_deleted ON public.projects USING btree (connection_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_projects_connection_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_connection_status_created ON public.projects USING btree (connection_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_projects_end_date_asc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_end_date_asc ON public.projects USING btree (connection_id, end_date, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_projects_name_asc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_name_asc ON public.projects USING btree (connection_id, name, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_projects_name_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_name_desc ON public.projects USING btree (connection_id, name DESC, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_projects_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_name_trgm ON public.projects USING gin (lower(name) public.gin_trgm_ops) WHERE (deleted_at IS NULL);


--
-- Name: idx_projects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_status ON public.projects USING btree (connection_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_request_comments_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_comments_request_id ON public.request_comments USING btree (request_id);


--
-- Name: idx_request_comments_request_id_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_comments_request_id_deleted ON public.request_comments USING btree (request_id, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_active_title_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_active_title_gin ON public.requests USING gin (title public.gin_trgm_ops) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_assignee ON public.requests USING btree (connection_id, assignee_user_id, created_at DESC) WHERE ((deleted_at IS NULL) AND (assignee_user_id IS NOT NULL));


--
-- Name: idx_requests_assignee_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_assignee_user ON public.requests USING btree (assignee_user_id) WHERE (assignee_user_id IS NOT NULL);


--
-- Name: idx_requests_assignee_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_assignee_user_id ON public.requests USING btree (assignee_user_id) WHERE ((deleted_at IS NULL) AND (assignee_user_id IS NOT NULL));


--
-- Name: idx_requests_connection_assignee_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_assignee_created ON public.requests USING btree (connection_id, assignee_user_id, created_at DESC) WHERE ((deleted_at IS NULL) AND (assignee_user_id IS NOT NULL));


--
-- Name: idx_requests_connection_assignee_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_assignee_status ON public.requests USING btree (connection_id, assignee_user_id, status) WHERE (deleted_at IS NULL);


--
-- Name: INDEX idx_requests_connection_assignee_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_requests_connection_assignee_status IS 'Optimizes assignee filtering for requests in a connection';


--
-- Name: idx_requests_connection_created_by_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_created_by_created ON public.requests USING btree (connection_id, created_by_user_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_connection_created_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_created_desc ON public.requests USING btree (connection_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_connection_deleted_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_deleted_created ON public.requests USING btree (connection_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_connection_deleted_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_deleted_title ON public.requests USING btree (connection_id, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_connection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_id ON public.requests USING btree (connection_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_connection_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_id_status ON public.requests USING btree (connection_id, status) WHERE (deleted_at IS NULL);


--
-- Name: INDEX idx_requests_connection_id_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_requests_connection_id_status IS 'Optimizes connection_id filtering and excluded_connection_ids filter';


--
-- Name: idx_requests_connection_ids_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_ids_status_created ON public.requests USING btree (connection_id, status, created_at DESC, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_connection_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_not_deleted ON public.requests USING btree (connection_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_connection_pagination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_pagination ON public.requests USING btree (connection_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_connection_status_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_status_count ON public.requests USING btree (connection_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_connection_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_status_created ON public.requests USING btree (connection_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_connection_status_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_status_created_at ON public.requests USING btree (connection_id, status, created_at DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: INDEX idx_requests_connection_status_created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_requests_connection_status_created_at IS 'Optimizes status-based queries for requests in a connection, ordered by created_at DESC';


--
-- Name: idx_requests_connection_status_new; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_status_new ON public.requests USING btree (connection_id, status) WHERE ((deleted_at IS NULL) AND (status = 'new'::public.request_status));


--
-- Name: idx_requests_connection_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_connection_title_trgm ON public.requests USING gin (title public.gin_trgm_ops) WHERE ((deleted_at IS NULL) AND (connection_id IS NOT NULL));


--
-- Name: INDEX idx_requests_connection_title_trgm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_requests_connection_title_trgm IS 'Optimizes title search queries for requests in a connection using trigram matching';


--
-- Name: idx_requests_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_created_by ON public.requests USING btree (connection_id, created_by_user_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_created_by_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_created_by_user ON public.requests USING btree (created_by_user_id) WHERE (created_by_user_id IS NOT NULL);


--
-- Name: idx_requests_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_created_by_user_id ON public.requests USING btree (created_by_user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_project_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_project_connection ON public.requests USING btree (project_id, connection_id) WHERE ((deleted_at IS NULL) AND (project_id IS NOT NULL));


--
-- Name: idx_requests_project_name_cached; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_project_name_cached ON public.requests USING btree (project_name_cached) WHERE ((deleted_at IS NULL) AND (project_name_cached IS NOT NULL));


--
-- Name: idx_requests_search_vector_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_search_vector_gin ON public.requests USING gin (search_vector) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_status ON public.requests USING btree (connection_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_status_connection_created_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_status_connection_created_id ON public.requests USING btree (status, connection_id, created_at DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: INDEX idx_requests_status_connection_created_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_requests_status_connection_created_id IS 'Optimizes flat pagination query: ORDER BY status, display_name, created_at DESC, id DESC';


--
-- Name: idx_requests_title_gin_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_title_gin_trgm ON public.requests USING gin (title public.gin_trgm_ops);


--
-- Name: idx_requests_title_pattern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_title_pattern ON public.requests USING btree (title text_pattern_ops) WHERE (deleted_at IS NULL);


--
-- Name: idx_requests_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requests_title_trgm ON public.requests USING gin (lower(title) public.gin_trgm_ops) WHERE (deleted_at IS NULL);


--
-- Name: idx_task_comments_task_id_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_comments_task_id_deleted ON public.task_comments USING btree (task_id, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assignee ON public.tasks USING btree (connection_id, assignee_user_id, created_at DESC, id DESC) WHERE ((deleted_at IS NULL) AND (assignee_user_id IS NOT NULL));


--
-- Name: idx_tasks_assignee_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assignee_user_id ON public.tasks USING btree (assignee_user_id) WHERE ((deleted_at IS NULL) AND (assignee_user_id IS NOT NULL));


--
-- Name: idx_tasks_connection_assignee_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_assignee_status ON public.tasks USING btree (connection_id, assignee_user_id, status) WHERE (deleted_at IS NULL);


--
-- Name: INDEX idx_tasks_connection_assignee_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_tasks_connection_assignee_status IS 'Optimizes assignee filtering for tasks in a connection';


--
-- Name: idx_tasks_connection_ids_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_ids_assignee ON public.tasks USING btree (connection_id, assignee_user_id, deleted_at) WHERE ((deleted_at IS NULL) AND (assignee_user_id IS NOT NULL));


--
-- Name: idx_tasks_connection_ids_assignee_array; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_ids_assignee_array ON public.tasks USING btree (connection_id, assignee_user_id, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_connection_ids_completed_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_ids_completed_created ON public.tasks USING btree (connection_id, completed_at DESC NULLS LAST, created_at DESC, deleted_at) WHERE ((deleted_at IS NULL) AND (status = 'done'::public.task_status));


--
-- Name: idx_tasks_connection_ids_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_ids_count ON public.tasks USING btree (connection_id, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_connection_ids_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_ids_deleted ON public.tasks USING btree (connection_id, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_connection_ids_due_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_ids_due_created ON public.tasks USING btree (connection_id, due_date, created_at DESC, deleted_at) WHERE ((deleted_at IS NULL) AND (status <> 'done'::public.task_status));


--
-- Name: idx_tasks_connection_ids_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_ids_status_created ON public.tasks USING btree (connection_id, status, created_at DESC, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_connection_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_not_deleted ON public.tasks USING btree (connection_id, created_at DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_connection_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_status_created ON public.tasks USING btree (connection_id, status, created_at DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_connection_status_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_status_created_at ON public.tasks USING btree (connection_id, status, created_at DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: INDEX idx_tasks_connection_status_created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_tasks_connection_status_created_at IS 'Optimizes status-based queries for tasks in a connection, ordered by created_at DESC';


--
-- Name: idx_tasks_connection_status_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_status_due ON public.tasks USING btree (connection_id, status, due_date) WHERE ((deleted_at IS NULL) AND (status <> 'done'::public.task_status));


--
-- Name: idx_tasks_connection_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_connection_title_trgm ON public.tasks USING gin (title public.gin_trgm_ops) WHERE ((deleted_at IS NULL) AND (connection_id IS NOT NULL));


--
-- Name: INDEX idx_tasks_connection_title_trgm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.idx_tasks_connection_title_trgm IS 'Optimizes title search queries for tasks in a connection using trigram matching';


--
-- Name: idx_tasks_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_created_by ON public.tasks USING btree (connection_id, created_by_user_id, created_at DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_description_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_description_trgm ON public.tasks USING gin (lower(description) public.gin_trgm_ops) WHERE ((deleted_at IS NULL) AND (description IS NOT NULL));


--
-- Name: idx_tasks_project_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_project_connection ON public.tasks USING btree (project_id, connection_id) WHERE ((deleted_at IS NULL) AND (project_id IS NOT NULL));


--
-- Name: idx_tasks_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_project_id ON public.tasks USING btree (connection_id, project_id, created_at DESC) WHERE ((deleted_at IS NULL) AND (project_id IS NOT NULL));


--
-- Name: idx_tasks_search_vector_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_search_vector_gin ON public.tasks USING gin (search_vector) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (connection_id, status, created_at DESC, id DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_tasks_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_title_trgm ON public.tasks USING gin (lower(title) public.gin_trgm_ops) WHERE (deleted_at IS NULL);


--
-- Name: requests_project_name_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX requests_project_name_trgm_idx ON public.requests USING gin (lower(project_name_cached) public.gin_trgm_ops) WHERE (deleted_at IS NULL);


--
-- Name: ux_invites_org_email_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_invites_org_email_pending ON public.membership_invitations USING btree (org_id, invited_email) WHERE (status = 'pending'::public."member_invitation_status ");


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2025_12_29_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2025_12_29_inserted_at_topic_idx ON realtime.messages_2025_12_29 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2025_12_30_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2025_12_30_inserted_at_topic_idx ON realtime.messages_2025_12_30 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2025_12_31_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2025_12_31_inserted_at_topic_idx ON realtime.messages_2025_12_31 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_01_01_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_01_01_inserted_at_topic_idx ON realtime.messages_2026_01_01 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_01_02_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_01_02_inserted_at_topic_idx ON realtime.messages_2026_01_02 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_01_03_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_01_03_inserted_at_topic_idx ON realtime.messages_2026_01_03 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_01_04_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_01_04_inserted_at_topic_idx ON realtime.messages_2026_01_04 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree (subscription_id, entity, filters);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: messages_2025_12_29_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_12_29_inserted_at_topic_idx;


--
-- Name: messages_2025_12_29_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_12_29_pkey;


--
-- Name: messages_2025_12_30_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_12_30_inserted_at_topic_idx;


--
-- Name: messages_2025_12_30_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_12_30_pkey;


--
-- Name: messages_2025_12_31_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2025_12_31_inserted_at_topic_idx;


--
-- Name: messages_2025_12_31_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2025_12_31_pkey;


--
-- Name: messages_2026_01_01_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_01_01_inserted_at_topic_idx;


--
-- Name: messages_2026_01_01_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_01_01_pkey;


--
-- Name: messages_2026_01_02_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_01_02_inserted_at_topic_idx;


--
-- Name: messages_2026_01_02_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_01_02_pkey;


--
-- Name: messages_2026_01_03_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_01_03_inserted_at_topic_idx;


--
-- Name: messages_2026_01_03_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_01_03_pkey;


--
-- Name: messages_2026_01_04_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_01_04_inserted_at_topic_idx;


--
-- Name: messages_2026_01_04_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_01_04_pkey;


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: users on_auth_user_email_updated; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_email_updated AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();


--
-- Name: memberships memberships_no_draft_orgs_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER memberships_no_draft_orgs_trigger BEFORE INSERT ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.check_no_draft_org_membership();


--
-- Name: TRIGGER memberships_no_draft_orgs_trigger ON memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER memberships_no_draft_orgs_trigger ON public.memberships IS 'Prevents inserting memberships into draft organizations. Draft orgs are only visible through connections, never as active contexts.';


--
-- Name: organizations on_billing_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_billing_status_change AFTER UPDATE OF billing_status ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_billing_downgrade();


--
-- Name: organizations organizations_update_requests_search; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER organizations_update_requests_search AFTER UPDATE OF name ON public.organizations FOR EACH ROW WHEN ((old.name IS DISTINCT FROM new.name)) EXECUTE FUNCTION public.update_requests_on_org_name_change();


--
-- Name: organizations organizations_update_tasks_search; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER organizations_update_tasks_search AFTER UPDATE OF name ON public.organizations FOR EACH ROW WHEN ((old.name IS DISTINCT FROM new.name)) EXECUTE FUNCTION public.update_tasks_on_org_name_change();


--
-- Name: requests requests_search_vector_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER requests_search_vector_update BEFORE INSERT OR UPDATE OF title, connection_id ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_request_search_vector();


--
-- Name: tasks tasks_search_vector_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tasks_search_vector_update BEFORE INSERT OR UPDATE OF title, connection_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_task_search_vector();


--
-- Name: memberships trg_lock_membership_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lock_membership_identity BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public._lock_membership_identity();


--
-- Name: memberships trg_lock_membership_org; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lock_membership_org BEFORE UPDATE OF org_id ON public.memberships FOR EACH ROW EXECUTE FUNCTION public._lock_membership_org();


--
-- Name: projects trg_project_name_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_project_name_update AFTER UPDATE OF name ON public.projects FOR EACH ROW WHEN ((old.name IS DISTINCT FROM new.name)) EXECUTE FUNCTION public.fn_sync_project_name_to_requests();


--
-- Name: requests trg_requests_project_cache; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_requests_project_cache BEFORE INSERT OR UPDATE OF project_id ON public.requests FOR EACH ROW EXECUTE FUNCTION public.fn_set_request_project_name();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: requests Requests_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT "Requests_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE CASCADE;


--
-- Name: requests Requests_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT "Requests_created_by_user_id_fkey" FOREIGN KEY (created_by_user_id) REFERENCES public.profiles(id);


--
-- Name: connection_resources connection_links_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_resources
    ADD CONSTRAINT connection_links_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE CASCADE;


--
-- Name: connection_resources connection_links_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_resources
    ADD CONSTRAINT connection_links_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.profiles(id);


--
-- Name: connections connections_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: connections connections_agency_primary_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_agency_primary_contact_id_fkey FOREIGN KEY (agency_primary_contact_id) REFERENCES public.profiles(id);


--
-- Name: connections connections_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: connections connections_client_primary_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_client_primary_contact_id_fkey FOREIGN KEY (client_primary_contact_id) REFERENCES public.profiles(id);


--
-- Name: connections connections_created_by_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_created_by_org_id_fkey FOREIGN KEY (created_by_org_id) REFERENCES public.organizations(id);


--
-- Name: membership_invitations membership_invitations_invited_by_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_invitations
    ADD CONSTRAINT membership_invitations_invited_by_user_fkey FOREIGN KEY (invited_by_user) REFERENCES public.profiles(id);


--
-- Name: membership_invitations membership_invitations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_invitations
    ADD CONSTRAINT membership_invitations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: memberships memberships_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: memberships memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: organization_resources organization_resources_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_resources
    ADD CONSTRAINT organization_resources_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.profiles(id);


--
-- Name: organization_resources organization_resources_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_resources
    ADD CONSTRAINT organization_resources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_created_by_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_created_by_org_id_fkey FOREIGN KEY (created_by_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);


--
-- Name: projects projects_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE CASCADE;


--
-- Name: projects projects_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.profiles(id);


--
-- Name: projects projects_deleted_by_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_deleted_by_user_id_fkey1 FOREIGN KEY (deleted_by_user_id) REFERENCES public.profiles(id);


--
-- Name: request_comments request_comments_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT request_comments_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.profiles(id);


--
-- Name: request_comments request_comments_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT request_comments_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- Name: requests requests_assignee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_assignee_user_id_fkey FOREIGN KEY (assignee_user_id) REFERENCES public.profiles(id);


--
-- Name: requests requests_created_by_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_created_by_org_id_fkey FOREIGN KEY (created_by_org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: requests requests_deleted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES public.profiles(id);


--
-- Name: requests requests_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: task_comments task_comments_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.profiles(id);


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assignee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assignee_user_id_fkey FOREIGN KEY (assignee_user_id) REFERENCES public.profiles(id);


--
-- Name: tasks tasks_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.profiles(id);


--
-- Name: tasks tasks_deleted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES public.profiles(id);


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: tasks tasks_source_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_source_request_id_fkey FOREIGN KEY (source_request_id) REFERENCES public.requests(id);


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: connection_resources Agency members can create connection links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agency members can create connection links" ON public.connection_resources FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = connection_resources.connection_id) AND public.auth_user_is_member_of(c.agency_id) AND (c.connection_status <> 'disconnected'::public.connection_status)))) AND (created_by_user_id = auth.uid())));


--
-- Name: projects Agency members can create projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agency members can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = projects.connection_id) AND public.auth_user_is_member_of(c.agency_id) AND (c.connection_status <> 'disconnected'::public.connection_status)))));


--
-- Name: tasks Agency members can create tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agency members can create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = tasks.connection_id) AND public.auth_user_is_member_of(c.agency_id)))) AND (created_by_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.connections c2
  WHERE ((c2.id = tasks.connection_id) AND (c2.connection_status <> 'disconnected'::public.connection_status))))));


--
-- Name: connection_resources Agency members can delete connection links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agency members can delete connection links" ON public.connection_resources FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = connection_resources.connection_id) AND public.auth_user_is_member_of(c.agency_id) AND (c.connection_status <> 'disconnected'::public.connection_status)))));


--
-- Name: projects Agency members can soft delete projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agency members can soft delete projects" ON public.projects FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = projects.connection_id) AND public.auth_user_is_member_of(c.agency_id) AND (c.connection_status = 'disconnected'::public.connection_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = projects.connection_id) AND public.auth_user_is_member_of(c.agency_id) AND (c.connection_status = 'connected'::public.connection_status)))));


--
-- Name: connection_resources Agency members can update connection links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agency members can update connection links" ON public.connection_resources FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = connection_resources.connection_id) AND public.auth_user_is_member_of(c.agency_id) AND (c.connection_status <> 'disconnected'::public.connection_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = connection_resources.connection_id) AND public.auth_user_is_member_of(c.agency_id) AND (c.connection_status <> 'disconnected'::public.connection_status)))));


--
-- Name: projects Agency members can update projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agency members can update projects" ON public.projects FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = projects.connection_id) AND public.auth_user_is_member_of(c.agency_id) AND (c.connection_status <> 'disconnected'::public.connection_status))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = projects.connection_id) AND public.auth_user_is_member_of(c.agency_id) AND (c.connection_status <> 'disconnected'::public.connection_status)))));


--
-- Name: tasks Agency members can update tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agency members can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = tasks.connection_id) AND public.auth_user_is_member_of(c.agency_id)))) AND (EXISTS ( SELECT 1
   FROM public.connections c2
  WHERE ((c2.id = tasks.connection_id) AND (c2.connection_status <> 'disconnected'::public.connection_status)))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = tasks.connection_id) AND public.auth_user_is_member_of(c.agency_id)))) AND (EXISTS ( SELECT 1
   FROM public.connections c2
  WHERE ((c2.id = tasks.connection_id) AND (c2.connection_status <> 'disconnected'::public.connection_status))))));


--
-- Name: projects Agency members can view deleted projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agency members can view deleted projects" ON public.projects FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = projects.connection_id) AND public.auth_user_is_member_of(c.agency_id)))));


--
-- Name: tasks Agency members can view deleted tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agency members can view deleted tasks" ON public.tasks FOR SELECT TO authenticated USING (((deleted_at IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = tasks.connection_id) AND public.auth_user_is_member_of(c.agency_id))))));


--
-- Name: tasks Client assignee can update status only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Client assignee can update status only" ON public.tasks FOR UPDATE TO authenticated USING (((assignee_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = tasks.connection_id) AND public.auth_user_is_member_of(c.client_id)))) AND (EXISTS ( SELECT 1
   FROM public.connections c2
  WHERE ((c2.id = tasks.connection_id) AND (c2.connection_status <> 'disconnected'::public.connection_status)))))) WITH CHECK (((assignee_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = tasks.connection_id) AND public.auth_user_is_member_of(c.client_id)))) AND (EXISTS ( SELECT 1
   FROM public.connections c2
  WHERE ((c2.id = tasks.connection_id) AND (c2.connection_status <> 'disconnected'::public.connection_status))))));


--
-- Name: memberships Connected org members can view memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Connected org members can view memberships" ON public.memberships FOR SELECT TO authenticated USING (public.auth_user_is_member_of_connected_org(org_id));


--
-- Name: profiles Connected org members can view profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Connected org members can view profiles" ON public.profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.memberships m
  WHERE ((m.user_id = profiles.id) AND public.auth_user_is_member_of_connected_org(m.org_id)))));


--
-- Name: memberships Member can leave (self-delete), but not if they’re the owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Member can leave (self-delete), but not if they’re the owner" ON public.memberships FOR DELETE TO authenticated USING (((user_id = auth.uid()) AND (NOT public.user_is_owner_of_org(org_id, user_id))));


--
-- Name: organization_resources Members can create organization resources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can create organization resources" ON public.organization_resources FOR INSERT TO authenticated WITH CHECK (public.auth_user_is_member_of(organization_id));


--
-- Name: organization_resources Members can delete organization resources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can delete organization resources" ON public.organization_resources FOR DELETE TO authenticated USING (public.auth_user_is_member_of(organization_id));


--
-- Name: organization_resources Members can update organization resources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can update organization resources" ON public.organization_resources FOR UPDATE TO authenticated USING (public.auth_user_is_member_of(organization_id)) WITH CHECK (public.auth_user_is_member_of(organization_id));


--
-- Name: request_comments Members can update their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can update their own comments" ON public.request_comments FOR UPDATE TO authenticated USING ((created_by_user_id = auth.uid())) WITH CHECK ((created_by_user_id = auth.uid()));


--
-- Name: task_comments Members can update their own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can update their own comments" ON public.task_comments FOR UPDATE TO authenticated USING ((created_by_user_id = auth.uid())) WITH CHECK ((created_by_user_id = auth.uid()));


--
-- Name: requests Members can view deleted requests created by their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view deleted requests created by their org" ON public.requests FOR SELECT TO authenticated USING (public.auth_user_is_member_of(created_by_org_id));


--
-- Name: membership_invitations Members can view invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view invitations" ON public.membership_invitations FOR SELECT TO authenticated USING (public.auth_user_owns_org(org_id));


--
-- Name: organization_resources Members can view organization resources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view organization resources" ON public.organization_resources FOR SELECT TO authenticated USING (public.auth_user_is_member_of(organization_id));


--
-- Name: request_comments Members of connected orgs can create request comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members of connected orgs can create request comments" ON public.request_comments FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM (public.requests r
     JOIN public.connections c ON ((c.id = r.connection_id)))
  WHERE ((r.id = request_comments.request_id) AND (r.deleted_at IS NULL) AND (public.auth_user_is_member_of(c.agency_id) OR public.auth_user_is_member_of(c.client_id))))) AND (created_by_user_id = auth.uid())));


--
-- Name: requests Members of connected orgs can create requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members of connected orgs can create requests" ON public.requests FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = requests.connection_id) AND (public.auth_user_is_member_of(c.agency_id) OR public.auth_user_is_member_of(c.client_id))))) AND (created_by_org_id IS NOT NULL) AND (created_by_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.connections c2
  WHERE ((c2.id = requests.connection_id) AND (c2.connection_status <> 'disconnected'::public.connection_status))))));


--
-- Name: connection_resources Members of connected orgs can view connection links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members of connected orgs can view connection links" ON public.connection_resources FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = connection_resources.connection_id) AND (public.auth_user_is_member_of(c.agency_id) OR (public.auth_user_is_member_of(c.client_id) AND (connection_resources.client_visible = true)))))));


--
-- Name: projects Members of connected orgs can view projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members of connected orgs can view projects" ON public.projects FOR SELECT TO authenticated USING (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = projects.connection_id) AND (public.auth_user_is_member_of(c.agency_id) OR public.auth_user_is_member_of(c.client_id)))))));


--
-- Name: request_comments Members of connected orgs can view request comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members of connected orgs can view request comments" ON public.request_comments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.requests r
     JOIN public.connections c ON ((c.id = r.connection_id)))
  WHERE ((r.id = request_comments.request_id) AND (r.deleted_at IS NULL) AND (public.auth_user_is_member_of(c.agency_id) OR public.auth_user_is_member_of(c.client_id))))));


--
-- Name: requests Members of connected orgs can view requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members of connected orgs can view requests" ON public.requests FOR SELECT TO authenticated USING (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = requests.connection_id) AND (public.auth_user_is_member_of(c.agency_id) OR public.auth_user_is_member_of(c.client_id)))))));


--
-- Name: task_comments Members of connected orgs can view task comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members of connected orgs can view task comments" ON public.task_comments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.tasks t
     JOIN public.connections c ON ((c.id = t.connection_id)))
  WHERE ((t.id = task_comments.task_id) AND (public.auth_user_is_member_of(c.agency_id) OR (public.auth_user_is_member_of(c.client_id) AND ((t.client_visible = true) OR (t.assignee_user_id = auth.uid()))))))));


--
-- Name: tasks Members of connected orgs can view tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members of connected orgs can view tasks" ON public.tasks FOR SELECT TO authenticated USING (((deleted_at IS NULL) AND ((EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = tasks.connection_id) AND public.auth_user_is_member_of(c.agency_id)))) OR (EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = tasks.connection_id) AND public.auth_user_is_member_of(c.client_id) AND ((tasks.client_visible = true) OR (tasks.assignee_user_id = auth.uid()))))))));


--
-- Name: requests Members of creating org can soft delete requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members of creating org can soft delete requests" ON public.requests FOR UPDATE TO authenticated USING ((public.auth_user_is_member_of(created_by_org_id) AND (EXISTS ( SELECT 1
   FROM public.connections c2
  WHERE ((c2.id = requests.connection_id) AND (c2.connection_status <> 'disconnected'::public.connection_status)))))) WITH CHECK ((public.auth_user_is_member_of(created_by_org_id) AND (deleted_at IS NOT NULL) AND (deleted_by_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.connections c2
  WHERE ((c2.id = requests.connection_id) AND (c2.connection_status <> 'disconnected'::public.connection_status))))));


--
-- Name: requests Members of creating org can update requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members of creating org can update requests" ON public.requests FOR UPDATE TO authenticated USING (((public.auth_user_is_member_of(created_by_org_id) OR (EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = requests.connection_id) AND public.auth_user_is_member_of(c.agency_id))))) AND (EXISTS ( SELECT 1
   FROM public.connections c2
  WHERE ((c2.id = requests.connection_id) AND (c2.connection_status <> 'disconnected'::public.connection_status)))))) WITH CHECK (((public.auth_user_is_member_of(created_by_org_id) OR (EXISTS ( SELECT 1
   FROM public.connections c
  WHERE ((c.id = requests.connection_id) AND public.auth_user_is_member_of(c.agency_id))))) AND (EXISTS ( SELECT 1
   FROM public.connections c2
  WHERE ((c2.id = requests.connection_id) AND (c2.connection_status <> 'disconnected'::public.connection_status))))));


--
-- Name: memberships Org members can view memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view memberships" ON public.memberships FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.auth_user_is_member_of(org_id) OR public.auth_user_owns_org(org_id)));


--
-- Name: membership_invitations Owner can create invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can create invites" ON public.membership_invitations FOR INSERT TO authenticated WITH CHECK (public.auth_user_owns_org(org_id));


--
-- Name: memberships Owner can remove a member (not self, not the owner); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can remove a member (not self, not the owner)" ON public.memberships FOR DELETE TO authenticated USING ((public.auth_user_owns_org(org_id) AND (user_id <> auth.uid()) AND (NOT public.user_is_owner_of_org(org_id, user_id))));


--
-- Name: memberships Owner can update other memberships (never self); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner can update other memberships (never self)" ON public.memberships FOR UPDATE TO authenticated USING ((public.auth_user_owns_org(org_id) AND (user_id <> auth.uid()) AND (NOT public.user_is_owner_of_org(org_id, user_id)))) WITH CHECK ((public.auth_user_owns_org(org_id) AND (user_id <> auth.uid()) AND (NOT public.user_is_owner_of_org(org_id, user_id)) AND (NOT (EXISTS ( SELECT 1
   FROM public.organizations
  WHERE ((organizations.id = memberships.org_id) AND (organizations.is_draft = true)))))));


--
-- Name: membership_invitations Owners can delete an invitation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete an invitation" ON public.membership_invitations FOR DELETE TO authenticated USING (public.auth_user_owns_org(org_id));


--
-- Name: membership_invitations Owners can update an invitation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update an invitation" ON public.membership_invitations FOR UPDATE TO authenticated USING (public.auth_user_owns_org(org_id)) WITH CHECK (public.auth_user_owns_org(org_id));


--
-- Name: organizations Owners can update their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update their organizations" ON public.organizations FOR UPDATE TO authenticated USING (public.auth_user_owns_org(id)) WITH CHECK ((deleted_at IS NULL));


--
-- Name: profiles Self, same-org, or org-owner can view profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Self, same-org, or org-owner can view profiles" ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.users_share_org(id, auth.uid()) OR (public.user_is_in_my_owned_org(id) AND (deleted_at IS NULL))));


--
-- Name: connections Users can create connections for their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create connections for their organization" ON public.connections FOR INSERT TO authenticated WITH CHECK ((public.auth_user_is_member_of(agency_id) OR public.auth_user_is_member_of(client_id) OR ((agency_id = (current_setting('app.current_org_id'::text, true))::uuid) AND (EXISTS ( SELECT 1
   FROM public.organizations o2
  WHERE ((o2.id = connections.client_id) AND (o2.is_draft = true) AND (o2.created_by_org_id = connections.agency_id)))))));


--
-- Name: memberships Users can create memberships in non-draft organizations only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create memberships in non-draft organizations only" ON public.memberships FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.organizations
  WHERE ((organizations.id = memberships.org_id) AND (organizations.is_draft = false) AND (organizations.deleted_at IS NULL)))) AND (EXISTS ( SELECT 1
   FROM public.organizations
  WHERE ((organizations.id = memberships.org_id) AND (organizations.owner_id = auth.uid()))))));


--
-- Name: POLICY "Users can create memberships in non-draft organizations only" ON memberships; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Users can create memberships in non-draft organizations only" ON public.memberships IS 'Prevents creating memberships in draft organizations. Draft orgs cannot have members and cannot become active contexts.';


--
-- Name: organizations Users can create orgs if they don't have existing membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create orgs if they don't have existing membership" ON public.organizations FOR INSERT TO authenticated WITH CHECK ((((owner_id = auth.uid()) AND (created_by_org_id IS NULL) AND (NOT (EXISTS ( SELECT 1
   FROM public.memberships m
  WHERE (m.user_id = auth.uid()))))) OR ((owner_id = auth.uid()) AND (type = 'client'::public.org_type) AND (is_draft = true) AND (created_by_org_id IS NOT NULL) AND (public.auth_user_owns_org(created_by_org_id) OR public.user_is_member_of_org(created_by_org_id, auth.uid())))));


--
-- Name: connections Users can update connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update connections" ON public.connections FOR UPDATE TO authenticated USING ((public.auth_user_is_member_of(agency_id) OR public.auth_user_is_member_of(client_id))) WITH CHECK ((public.auth_user_is_member_of(agency_id) OR public.auth_user_is_member_of(client_id)));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: connections Users can view connections they are part of; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view connections they are part of" ON public.connections FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.memberships
  WHERE ((memberships.user_id = auth.uid()) AND (memberships.org_id = connections.agency_id)))) OR (EXISTS ( SELECT 1
   FROM public.memberships
  WHERE ((memberships.user_id = auth.uid()) AND (memberships.org_id = connections.client_id))))));


--
-- Name: organizations Users can view organizations they are connected to; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view organizations they are connected to" ON public.organizations FOR SELECT TO authenticated USING (((deleted_at IS NULL) AND ((EXISTS ( SELECT 1
   FROM (public.connections c
     JOIN public.memberships m ON ((m.org_id = c.agency_id)))
  WHERE ((m.user_id = auth.uid()) AND (c.client_id = organizations.id)))) OR (EXISTS ( SELECT 1
   FROM (public.connections c
     JOIN public.memberships m ON ((m.org_id = c.client_id)))
  WHERE ((m.user_id = auth.uid()) AND (c.agency_id = organizations.id)))) OR ((is_draft = true) AND (created_by_org_id IS NOT NULL) AND (public.auth_user_owns_org(created_by_org_id) OR public.user_is_member_of_org(created_by_org_id, auth.uid()))))));


--
-- Name: organizations Users can view organizations they are members of; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view organizations they are members of" ON public.organizations FOR SELECT TO authenticated USING (((deleted_at IS NULL) AND ((public.auth_user_is_member_of(id) OR public.auth_user_owns_org(id)) AND (is_draft = false))));


--
-- Name: task_comments Users who can view task can comment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users who can view task can comment" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM (public.tasks t
     JOIN public.connections c ON ((c.id = t.connection_id)))
  WHERE ((t.id = task_comments.task_id) AND (public.auth_user_is_member_of(c.agency_id) OR (public.auth_user_is_member_of(c.client_id) AND ((t.client_visible = true) OR (t.assignee_user_id = auth.uid()))))))) AND (created_by_user_id = auth.uid())));


--
-- Name: connection_resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connection_resources ENABLE ROW LEVEL SECURITY;

--
-- Name: connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

--
-- Name: membership_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.membership_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_resources ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: request_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.request_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

--
-- Name: task_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Allow deletion of draft organization logos 1peuqw_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow deletion of draft organization logos 1peuqw_0" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'logos'::text) AND ((storage.foldername(name))[1] IN ( SELECT (o.id)::text AS id
   FROM (public.organizations o
     JOIN public.connections c ON ((c.client_id = o.id)))
  WHERE (((o.is_draft = true) AND (EXISTS ( SELECT 1
           FROM public.memberships m
          WHERE ((m.org_id = c.agency_id) AND (m.user_id = auth.uid()))))) OR (EXISTS ( SELECT 1
           FROM public.organizations a
          WHERE ((a.id = c.agency_id) AND (a.owner_id = auth.uid())))))))));


--
-- Name: objects Allow deletion of organization logos by owner 1peuqw_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow deletion of organization logos by owner 1peuqw_0" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'logos'::text) AND ((storage.foldername(name))[1] IN ( SELECT (o.id)::text AS id
   FROM public.organizations o
  WHERE ((o.owner_id = auth.uid()) AND (o.deleted_at IS NULL))))));


--
-- Name: objects Authenticated users can update avatars 1oj01fe_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can update avatars 1oj01fe_0" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text)));


--
-- Name: objects Authenticated users can update logos 1peuqw_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can update logos 1peuqw_0" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'logos'::text) AND (auth.role() = 'authenticated'::text)));


--
-- Name: objects Authenticated users can upload to avatars 1oj01fe_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload to avatars 1oj01fe_0" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));


--
-- Name: objects Authenticated users can upload to logos 1peuqw_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload to logos 1peuqw_0" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'logos'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));


--
-- Name: objects Authenticated users can view avatars 1oj01fe_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can view avatars 1oj01fe_0" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text)));


--
-- Name: objects Authenticated users can view logos 1peuqw_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can view logos 1peuqw_0" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'logos'::text) AND (auth.role() = 'authenticated'::text)));


--
-- Name: objects Organization owners can delete member avatars 1oj01fe_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Organization owners can delete member avatars 1oj01fe_0" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] IN ( SELECT (m.user_id)::text AS user_id
   FROM (public.memberships m
     JOIN public.organizations o ON ((o.id = m.org_id)))
  WHERE ((o.owner_id = auth.uid()) AND (o.deleted_at IS NULL))))));


--
-- Name: objects Users can delete their own avatar 1oj01fe_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Users can delete their own avatar 1oj01fe_0" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: -
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict OEyGs4Kl6JnwNkntsJi9jyTpageEUedCntXFrJgx3MVi832H1Iuha4Dn0l1AJpb

