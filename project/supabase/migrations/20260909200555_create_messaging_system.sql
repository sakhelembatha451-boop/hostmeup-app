/*
# Messaging & Notification System for HostMeUp

## Overview
Adds a complete direct messaging system between users and the platform admin, plus booking-linked conversation threads and notification tracking.

## New Tables

### conversations
- Thread between a user and admin, optionally linked to a booking.
- `id` (uuid, PK)
- `user_id` (uuid, references profiles) — the non-admin participant
- `booking_id` (uuid, nullable, references bookings) — optional link to a booking request
- `subject` (text) — conversation title/summary
- `type` (text, CHECK 'direct' | 'booking') — direct message to admin or booking-linked chat
- `created_at`, `updated_at` — timestamps

### messages
- Individual messages within a conversation.
- `id` (uuid, PK)
- `conversation_id` (uuid, references conversations ON DELETE CASCADE)
- `sender_id` (uuid, references profiles) — who sent the message
- `body` (text) — message content
- `read_at` (timestamptz, nullable) — when the recipient read it
- `created_at` — timestamp

### notifications
- Lightweight notification records for new messages and booking events.
- `id` (uuid, PK)
- `user_id` (uuid, references profiles) — the recipient of the notification
- `type` (text, CHECK 'message' | 'booking') — notification category
- `title` (text) — short title
- `body` (text) — notification detail
- `conversation_id` (uuid, nullable, references conversations) — optional link
- `booking_id` (uuid, nullable, references bookings) — optional link
- `read` (boolean, default false)
- `created_at` — timestamp

## Modified Tables
- `profiles` — adds `is_admin` boolean column (default false) to identify the platform admin.

## Security (RLS)
- **profiles.is_admin**: users can read this flag for all profiles. Users can only update their own profile (existing policy covers this).
- **conversations**: SELECT visible to the participant user OR the admin. INSERT only by the user. UPDATE only by admin or participant.
- **messages**: SELECT visible to conversation participants. INSERT by any participant. UPDATE by admin or sender.
- **notifications**: SELECT only by the owner. UPDATE only by the owner. INSERT by any authenticated user. DELETE by owner.

## Important Notes
1. The admin is identified by `profiles.is_admin = true`. Set this manually on your profile after signup.
2. When a host submits a booking, the frontend creates a conversation of type 'booking' linked to that booking.
3. Notifications are created client-side when messages are sent.
*/

-- ============ ADD is_admin TO profiles ============
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ============ CONVERSATIONS ============
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'booking')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_participant" ON conversations;
CREATE POLICY "conversations_select_participant"
  ON conversations FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "conversations_insert_authed" ON conversations;
CREATE POLICY "conversations_insert_authed"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conversations_update_participant" ON conversations;
CREATE POLICY "conversations_update_participant"
  ON conversations FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- ============ MESSAGES ============
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participants" ON messages;
CREATE POLICY "messages_select_participants"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
    )
  );

DROP POLICY IF EXISTS "messages_insert_participants" ON messages;
CREATE POLICY "messages_insert_participants"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
    )
    AND auth.uid() = messages.sender_id
  );

DROP POLICY IF EXISTS "messages_update_participants" ON messages;
CREATE POLICY "messages_update_participants"
  ON messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
    )
  );

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'message' CHECK (type IN ('message', 'booking')),
  title text NOT NULL DEFAULT '',
  body text DEFAULT '',
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_authed" ON notifications;
CREATE POLICY "notifications_insert_authed"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_booking_id ON conversations(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
