-- Fix permissions for system_settings table
-- Previous script only granted SELECT to authenticated users.
-- We need to grant INSERT and UPDATE as well, otherwise RLS policies for these operations won't even be checked.
GRANT INSERT, UPDATE, DELETE ON system_settings TO authenticated;

-- Ensure RLS policy covers ALL operations (it does, but good to double check)
-- "Allow admin full access system_settings" is FOR ALL, so it covers INSERT/UPDATE/DELETE.
