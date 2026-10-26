import { supabase } from './supabase';

export interface NotificationPayload {
  userId: string;
  type?: string;
  title: string;
  message: string;
  linkUrl?: string;
  bookingId?: string;
  conversationId?: string;
}

/**
 * Retrieves an admin user ID from the profiles database table or fallback.
 */
export async function getAdminId(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching admin ID:', error.message);
      return null;
    }

    return data?.id || null;
  } catch (err: any) {
    console.error('Unexpected error in getAdminId:', err?.message || err);
    return null;
  }
}

/**
 * Creates or retrieves an existing conversation between two users.
 */
export async function createConversation(
  userId1: string,
  userId2: string,
  bookingId?: string
): Promise<string | null> {
  if (!userId1 || !userId2) return null;

  try {
    const { data: existing, error: checkError } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(user1_id.eq.${userId1},user2_id.eq.${userId2}),and(user1_id.eq.${userId2},user2_id.eq.${userId1})`)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return existing.id;
    }

    const { data: newConv, error: insertError } = await supabase
      .from('conversations')
      .insert({
        user1_id: userId1,
        user2_id: userId2,
        booking_id: bookingId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating conversation:', insertError.message);
      return null;
    }

    return newConv?.id || null;
  } catch (err: any) {
    console.error('Unexpected error in createConversation:', err?.message || err);
    return null;
  }
}

/**
 * Sends a chat message within a conversation.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  messageText: string
): Promise<boolean> {
  if (!conversationId || !senderId || !messageText) return false;

  try {
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message: messageText,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error sending message:', error.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('Unexpected error in sendMessage:', err?.message || err);
    return false;
  }
}

/**
 * Marks messages as read within a conversation.
 */
export async function markMessagesRead(conversationId: string, userId: string): Promise<void> {
  if (!conversationId || !userId) return;

  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId);

    if (error) {
      console.error('Error marking messages as read:', error.message);
    }
  } catch (err: any) {
    console.error('Unexpected error in markMessagesRead:', err?.message || err);
  }
}

/**
 * Creates and dispatches an in-app notification to a specific user in real time.
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  linkUrl?: string,
  bookingId?: string,
  conversationId?: string
): Promise<void> {
  if (!userId) {
    console.warn('createNotification skipped: No target userId provided.');
    return;
  }

  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type: type || 'general',
      title: title,
      message: message,
      link: linkUrl || null,
      booking_id: bookingId || null,
      conversation_id: conversationId || null,
      is_read: false,
      read: false,
    });

    if (error) {
      console.error('Error inserting notification into Supabase:', error.message);
    }
  } catch (err: any) {
    console.error('Unexpected error in createNotification:', err?.message || err);
  }
}

/**
 * Marks a single notification as read in Supabase.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!notificationId) return;

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error.message);
    }
  } catch (err: any) {
    console.error('Unexpected error in markNotificationRead:', err?.message || err);
  }
}

/**
 * Marks all notifications as read for a given user in Supabase.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!userId) return;

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read: true })
      .eq('user_id', userId);

    if (error) {
      console.error('Error marking all notifications as read:', error.message);
    }
  } catch (err: any) {
    console.error('Unexpected error in markAllNotificationsRead:', err?.message || err);
  }
}
