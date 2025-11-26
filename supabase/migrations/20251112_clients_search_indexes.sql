-- Indexes for optimizing clients search, sort, and pagination

CREATE INDEX IF NOT EXISTS idx_connections_agency_id ON public.connections(agency_id);

CREATE INDEX IF NOT EXISTS idx_connections_connection_status ON public.connections(connection_status) WHERE connection_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_connections_engagement_status ON public.connections(engagement_status) WHERE engagement_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_connections_health_status ON public.connections(health_status) WHERE health_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_connections_contract_end_on ON public.connections(contract_end_on) WHERE contract_end_on IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_connections_agency_created_desc ON public.connections(agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_organizations_name_pattern ON public.organizations(name text_pattern_ops) WHERE deleted_at IS NULL AND is_draft = false;

CREATE INDEX IF NOT EXISTS idx_profiles_name_search ON public.profiles(first_name, last_name) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_connections_agency_contact ON public.connections(agency_primary_contact_id) WHERE agency_primary_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_connections_health_name ON public.connections(health_status, agency_id) WHERE health_status IS NOT NULL;

