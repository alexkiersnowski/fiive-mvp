-- ============================================================================
-- Migration: Add RLS policy for deleting draft client organization logos
-- Date: 2025-11-14
-- Description: Allows authenticated users to delete logo files from the 'logos'
--              bucket for draft client organizations, but only if they are
--              members of the agency that owns the connection to that draft client.
-- ============================================================================

-- Drop existing policy if it exists (in case it was created manually)
DROP POLICY IF EXISTS "Allow deletion of draft organization logos" ON storage.objects;

-- Create RLS policy for deleting draft client logos
-- Only allows deletion if:
-- 1. The file is in the 'logos' bucket
-- 2. The organization (identified by folder name) is a draft client
-- 3. A connection exists linking the draft client to an agency
-- 4. The authenticated user is a member of that agency OR is the owner of that agency
CREATE POLICY "Allow deletion of draft organization logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos' AND
  (storage.foldername(name))[1] IN (
    SELECT o.id::text 
    FROM public.organizations o
    INNER JOIN public.connections c ON c.client_id = o.id
    WHERE o.is_draft = true
      AND (
        -- User is a member of the agency
        EXISTS (
          SELECT 1 
          FROM public.memberships m 
          WHERE m.org_id = c.agency_id 
            AND m.user_id = auth.uid()
        )
        OR
        -- User is the owner of the agency
        EXISTS (
          SELECT 1 
          FROM public.organizations a 
          WHERE a.id = c.agency_id 
            AND a.owner_id = auth.uid()
        )
      )
  )
);

COMMENT ON POLICY "Allow deletion of draft organization logos" ON storage.objects
IS 'Allows authenticated users to delete logo files for draft client organizations, but only if they are members or owners of the agency that has a connection to that draft client.';

