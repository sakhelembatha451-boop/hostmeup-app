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
      link: linkUrl || null,                  // Maps to table's 'link' column
      booking_id: bookingId || null,          // Maps to table's 'booking_id' column
      conversation_id: conversationId || null,// Maps to table's 'conversation_id' column
      is_read: false,                         // Maps to table's 'is_read' column
      read: false,                            // Maps to table's 'read' column
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
      .eq('user_id', userId)
      .or('is_read.eq.false,read.eq.false');

    if (error) {
      console.error('Error marking all notifications as read:', error.message);
    }
  } catch (err: any) {
    console.error('Unexpected error in markAllNotificationsRead:', err?.message || err);
  }
}
