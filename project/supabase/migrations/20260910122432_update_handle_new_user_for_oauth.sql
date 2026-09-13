/*
# Update handle_new_user for Google OAuth compatibility

## Overview
The original `handle_new_user` trigger fires on auth.users INSERT and reads role/full_name from `raw_user_meta_data`. For Google OAuth users, the initial insert may not have role metadata (it's set via `updateUser` after the OAuth redirect). This migration updates the trigger to:
1. Be idempotent — check if a profile already exists before inserting (prevents duplicate key errors on OAuth flows).
2. Fall back to 'host' role and Google-provided name if role/full_name metadata is absent.
3. Also check `raw_app_meta_data` as a secondary source for role.

## Modified Functions
- `handle_new_user()` — rewritten to handle OAuth users gracefully.

## Security
- No RLS changes. The function remains SECURITY DEFINER with search_path = public.
*/
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if the profile doesn't already exist (idempotent for OAuth flows)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.profiles (id, role, full_name)
    VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data->>'role',
        NEW.raw_app_meta_data->>'role',
        'host'
      ),
      COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        ''
      )
    );

    -- Create artist_profile if role is artist
    IF COALESCE(NEW.raw_user_meta_data->>'role', NEW.raw_app_meta_data->>'role', 'host') = 'artist' THEN
      INSERT INTO public.artist_profiles (user_id)
      VALUES (NEW.id)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
