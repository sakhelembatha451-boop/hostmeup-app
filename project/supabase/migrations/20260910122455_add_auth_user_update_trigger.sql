/*
# Add auth user update trigger for OAuth role sync

## Overview
When a Google OAuth user signs in, the `handle_new_user` trigger creates a profile with default 'host' role (since role metadata isn't available at insert time). After the OAuth redirect, the app calls `updateUser` to set role/full_name metadata. This migration adds a trigger on `auth.users` UPDATE that syncs the profile's role and full_name from the updated metadata, and creates an `artist_profiles` row if the role is now 'artist'.

## New Functions
- `sync_user_profile()` — fires AFTER UPDATE on auth.users, updates the corresponding profiles row.

## New Triggers
- `on_auth_user_updated` — AFTER UPDATE ON auth.users.

## Security
- Function is SECURITY DEFINER with search_path = public.
- The `prevent_role_change` trigger on profiles will block role changes, but this function runs as SECURITY DEFINER (bypasses triggers on profiles? No — triggers still fire). We need to handle this carefully: the sync function should only set role if the profile was just created with the default 'host' value and the metadata now specifies a different role.
*/
CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_full_name text;
  v_existing_role text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', NEW.raw_app_meta_data->>'role', 'host');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');

  -- Only update if profile exists
  SELECT role INTO v_existing_role FROM public.profiles WHERE id = NEW.id;

  IF FOUND THEN
    -- Only sync role if it hasn't been explicitly set yet (still 'host' default from OAuth)
    -- This prevents overriding a role the user chose at email signup
    IF v_existing_role = 'host' AND v_role = 'artist' THEN
      -- Temporarily disable the role change guard by using a session variable
      -- We can't disable triggers per-statement easily, so we'll use a different approach:
      -- Directly update the row, which will trigger prevent_role_change.
      -- Instead, delete and re-insert the profile with the correct role.
      -- Actually, simpler: just update role and full_name. The prevent_role_change trigger
      -- will raise an exception. So we need to work around it.
      -- The cleanest approach: use a PERFORM with SET ROLE to bypass the trigger.
      -- But SECURITY DEFINER already runs as the function owner (postgres), and triggers
      -- still fire. So let's use a GUC flag that the trigger checks.

      -- Set a flag that prevent_role_change should allow this one update
      PERFORM set_config('hostmeup.allow_role_sync', 'true', true);

      UPDATE public.profiles
      SET role = v_role, full_name = v_full_name, updated_at = now()
      WHERE id = NEW.id;

      PERFORM set_config('hostmeup.allow_role_sync', 'false', true);

      -- Create artist profile if needed
      IF v_role = 'artist' THEN
        INSERT INTO public.artist_profiles (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
      END IF;
    ELSE
      -- Just update full_name if it's empty or different
      UPDATE public.profiles
      SET full_name = CASE WHEN v_full_name <> '' THEN v_full_name ELSE full_name END,
          updated_at = now()
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Update prevent_role_change to check the GUC flag
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role <> OLD.role THEN
    -- Allow role sync from the sync_user_profile function
    IF current_setting('hostmeup.allow_role_sync', true) = 'true' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Role cannot be changed after signup';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();
