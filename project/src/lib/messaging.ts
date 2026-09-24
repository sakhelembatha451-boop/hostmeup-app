import { supabase } from './supabase';

/**
 * Retrieves the profile ID of the primary admin user.
 */
export async function getAdminId(): Promise<string | null> {
  try {
    // 1. Check for profile explicitly marked as admin
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (!error && data?.id) {
      return data.id;
    }

    // 2. Fallback check for the specific admin email if role column query fails
    const { data: fallbackData } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'sakhelembatha451@gmail.com')
      .maybeSingle();

    return fallbackData?.id || null;
  } catch (err) {
    console.warn('Could not retrieve admin ID:', err);
    return null;
  }
}

/**
 * Creates a new conversation thread between a user and admin/host.
 */
export async function createConversation(
  userId: string,
  subject: string,
  type: 'direct' | 'booking' = 'direct',
  bookingId?: string,
  initialMessage?: string,
  adminId?: string | null
): Promise<string | null> {
  try {
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        subject,
        type,
        booking_id: bookingId || null,
      })
      .select()
      .single();

    if (convErr || !conv) {
      console.error('Error inserting conversation record:', convErr);
      throw convErr;
    }

    // If an initial message body was supplied, insert it into the thread
    if (initialMessage) {
      await sendMessage(conv.id, userId, initialMessage, adminId || undefined);
    }

    return conv.id;
  } catch (err) {
    console.error('Failed to create conversation:', err);
    return null;
  }
}

/**
 * Sends and saves a new message inside a specific conversation thread.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  receiverId?: string
) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        receiver_id: receiverId || null,
        body,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting message record:', error);
      throw error;
    }

    // Update conversation timestamp for sorting
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  } catch (err) {
    console.error('Failed to send message:', err);
    throw err;
  }
}

/**
 * Marks unread messages in a thread as read by the current user.
 */
export async function markMessagesRead(conversationId: string, userId: string) {
  try {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId);
  } catch (err) {
    console.error('Error updating read status:', err);
  }
}
