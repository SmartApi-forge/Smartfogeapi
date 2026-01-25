-- Add transfer code and claim URL fields to deployments table
-- These are used for transferring project ownership to users

ALTER TABLE public.deployments
ADD COLUMN IF NOT EXISTS transfer_code TEXT,
ADD COLUMN IF NOT EXISTS claim_url TEXT;

-- Add index for transfer code lookup
CREATE INDEX IF NOT EXISTS idx_deployments_transfer_code ON public.deployments(transfer_code);

COMMENT ON COLUMN public.deployments.transfer_code IS 'Transfer code for claiming project ownership';
COMMENT ON COLUMN public.deployments.claim_url IS 'URL for claiming project ownership';
