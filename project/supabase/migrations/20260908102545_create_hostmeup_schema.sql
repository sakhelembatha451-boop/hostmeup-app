/*
# HostMeUp - Core Schema

## Overview
Creates the database foundation for HostMeUp, a marketplace platform connecting Artists and Event Hosts.

## New Tables

### profiles
- Extends Supabase auth.users with marketplace-specific data.
- `id` (uuid, PK, references auth.users) — one-to-one with each auth account.
- `role` (text, NOT NULL, CHECK 'artist' or 'host') — user type, set at signup, immutable after.
- `full_name`, `avatar_url`, `bio`, `location` — public profile fields.
- `created_at`, `updated_at` — timestamps.

### artist_profiles
- Extended profile data only for users with role = 'artist'.
- `user_id` (uuid, UNIQUE, references profiles) — one-to-one with the artist's profile.
- `stage_name` — performance name.
- `performance_roles` (text[]) — e.g. ["DJ", "Vocalist", "Guitarist"].
- `genres` (text[]) — e.g. ["Jazz", "Electronic", "Rock"].
- `base_rate` (numeric) — performance fee.
- `rate_unit` (text, default 'hour') — 'hour' or 'event'.
- Social links: `spotify_url`, `instagram_url`, `soundcloud_url`, `youtube_url`, `website_url`.
- `media_urls` (text[]) — portfolio image URLs.
- `created_at`, `updated_at`.

### bookings
- A Host's request to book an Artist for an event.
- `artist_id` (uuid, references profiles) — the artist being booked.
- `host_id` (uuid, DEFAULT auth.uid(), references profiles) — the host making the request.
- `event_name`, `event_date` (date), `start_time` (text), `gig_duration` (text).
- `equipment_needed` (text[]) — e.g. ["PA System", "Microphones"].
- `location` (text) — event venue/address.
- `notes` (text) — additional details from the host.
- `status` (text, default 'pending', CHECK 'pending'|'accepted'|'declined'|'cancelled').
- `created_at`, `updated_at`.

## Automation
- Trigger `on_auth_user_created` fires after every new auth.users row.
- `handle_new_user()` (SECURITY DEFINER) inserts a profiles row using role + full_name from signup metadata.
- If role = 'artist', also creates an empty artist_profiles row.
- Trigger `no_role_change` prevents updating the role column after signup.

## Security (RLS)
- **profiles**: all authenticated users can SELECT (needed for browsing). Users can UPDATE only their own row. No direct INSERT/DELETE (trigger handles inserts).
- **artist_profiles**: all authenticated users can SELECT (browse). Only the profile owner can INSERT/UPDATE/DELETE.
- **bookings**: SELECT visible to both the host and the artist on the booking. INSERT only by the host (auth.uid() = host_id). UPDATE allowed by either party (host cancels, artist accepts/declines). WITH CHECK prevents changing ownership columns.
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('artist', 'host')),
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  bio text DEFAULT '',
  location text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============ ARTIST_PROFILES ============
CREATE TABLE IF NOT EXISTS artist_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  stage_name text DEFAULT '',
  performance_roles text[] DEFAULT '{}',
  genres text[] DEFAULT '{}',
  base_rate numeric,
  rate_unit text DEFAULT 'hour',
  spotify_url text,
  instagram_url text,
  soundcloud_url text,
  youtube_url text,
  website_url text,
  media_urls text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE artist_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist_profiles_select_all" ON artist_profiles;
CREATE POLICY "artist_profiles_select_all"
  ON artist_profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "artist_profiles_insert_own" ON artist_profiles;
CREATE POLICY "artist_profiles_insert_own"
  ON artist_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "artist_profiles_update_own" ON artist_profiles;
CREATE POLICY "artist_profiles_update_own"
  ON artist_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "artist_profiles_delete_own" ON artist_profiles;
CREATE POLICY "artist_profiles_delete_own"
  ON artist_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============ BOOKINGS ============
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  host_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  event_name text NOT NULL DEFAULT '',
  event_date date NOT NULL,
  start_time text,
  gig_duration text NOT NULL DEFAULT '',
  equipment_needed text[] DEFAULT '{}',
  location text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_select_parties" ON bookings;
CREATE POLICY "bookings_select_parties"
  ON bookings FOR SELECT TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = artist_id);

DROP POLICY IF EXISTS "bookings_insert_host" ON bookings;
CREATE POLICY "bookings_insert_host"
  ON bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "bookings_update_parties" ON bookings;
CREATE POLICY "bookings_update_parties"
  ON bookings FOR UPDATE TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = artist_id)
  WITH CHECK (auth.uid() = host_id OR auth.uid() = artist_id);

-- ============ TRIGGERS ============

-- Auto-create profile (+ artist_profile) on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'host'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  IF NEW.raw_user_meta_data->>'role' = 'artist' THEN
    INSERT INTO public.artist_profiles (user_id)
    VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent role changes after signup
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role <> OLD.role THEN
    RAISE EXCEPTION 'Role cannot be changed after signup';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS no_role_change ON profiles;
CREATE TRIGGER no_role_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_change();

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_bookings_host_id ON bookings(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_artist_id ON bookings(artist_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_artist_profiles_user_id ON artist_profiles(user_id);
