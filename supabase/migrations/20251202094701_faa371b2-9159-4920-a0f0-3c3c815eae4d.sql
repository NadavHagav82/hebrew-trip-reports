-- Add org_admin role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'org_admin';