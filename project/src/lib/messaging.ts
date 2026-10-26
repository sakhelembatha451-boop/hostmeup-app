import { supabase } from './supabase'; // Adjust this import path if your supabase client is located elsewhere

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
      link: linkUrl || null,                  // Maps to your table's 'link' column
      booking_id: bookingId || null,          // Maps to your table's 'booking_id' column
      conversation_id: conversationId || null,// Maps to your table's 'conversation_id' column
      is_read: false,                         // Maps to your table's 'is_read' column
      read: false,                            // Maps to your table's 'read' column
    });

    if (error) {
      console.error('Error inserting notification into Supabase:', error.message);
    }
  } catch (err: any) {
    console.error('Unexpected error in createNotification:', err?.message || err);
  }
}
