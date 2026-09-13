/*
# Add talent_category to artist_profiles

## Overview
Expands HostMeUp beyond musical artists to support all creative talent types.

## Changes
- Adds `talent_category` column to `artist_profiles` table.
- Valid categories: 'singer_vocalist', 'producer_engineer', 'performer_dj', 'beauty_professional', 'model', 'photographer_videographer'.
- Backfill: existing artist profiles get 'performer_dj' as a sensible default.
- Adds `media_types` jsonb column to store typed media entries (photo/audio/video) keyed by category needs.
- Keeps existing `media_urls` text[] for backward compatibility.

## Security
- No RLS policy changes needed — existing ownership policies cover the new columns.
*/

ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS talent_category text DEFAULT 'performer_dj'
  CHECK (talent_category IN (
    'singer_vocalist',
    'producer_engineer',
    'performer_dj',
    'beauty_professional',
    'model',
    'photographer_videographer'
  ));

-- Add media_items table for typed media (photo, audio, video) with captions
CREATE TABLE IF NOT EXISTS media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_profile_id uuid NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('photo', 'audio', 'video')),
  url text NOT NULL,
  title text DEFAULT '',
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_items_select_all" ON media_items;
CREATE POLICY "media_items_select_all"
  ON media_items FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "media_items_insert_own" ON media_items;
CREATE POLICY "media_items_insert_own"
  ON media_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM artist_profiles
    WHERE artist_profiles.id = media_items.artist_profile_id
    AND artist_profiles.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "media_items_update_own" ON media_items;
CREATE POLICY "media_items_update_own"
  ON media_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM artist_profiles
    WHERE artist_profiles.id = media_items.artist_profile_id
    AND artist_profiles.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM artist_profiles
    WHERE artist_profiles.id = media_items.artist_profile_id
    AND artist_profiles.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "media_items_delete_own" ON media_items;
CREATE POLICY "media_items_delete_own"
  ON media_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM artist_profiles
    WHERE artist_profiles.id = media_items.artist_profile_id
    AND artist_profiles.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_media_items_profile ON media_items(artist_profile_id);

-- Update handle_new_user to also set talent_category from signup metadata
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
    INSERT INTO public.artist_profiles (user_id, talent_category)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'talent_category', 'performer_dj')
    );
  END IF;

  RETURN NEW;
END;
$$;
