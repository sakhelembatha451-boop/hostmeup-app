import { supabase } from './supabase';
import type { Message, Conversation, Notification } from '@/types';

/**
 * Gets the Admin User ID safely without blocking non-admin accounts
 */
export async function getAdminId(): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'sakhelembatha451@gmail.com')
      .maybeSingle();

    if (data?.id) return data.id;

    const { data: roleData } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .maybeSingle();

    return roleData?.id || null;
  } catch (err) {
    console.warn('Could not query admin ID:', err);
    return null;
  }
}

/**
 * Creates a new conversation thread
 */
export async function createConversation(
  userId: string,
  subject: string,
  type: 'direct' | 'booking' = 'direct',
  bookingId?: string,
  initialMessageText?: string,
  explicitAdminId?: string | null
): Promise<string | null> {
  const targetAdminId = explicitAdminId || (await getAdminId());

  // Clean payload to prevent 400 errors from null/invalid optional columns
  const convPayload: Record<string, any> = {
    user_id: userId,
    subject: subject.trim(),
    type,
  };

  if (bookingId) {
    convPayload.booking_id = bookingId;
  }

  // Primary attempt
  let conv: any = null;
  const { data, error: convError } = await supabase
    .from('conversations')
    .insert([{ ...convPayload, status: 'open' }])
    .select()
    .single();

  if (convError) {
    console.warn('First attempt inserting conversation failed, retrying without status column:', convError);
    // Fallback attempt without 'status' column if table doesn't have it
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('conversations')
      .insert([convPayload])
      .select()
      .single();

    if (fallbackError || !fallbackData) {
      console.error('Error creating conversation:', fallbackError);
      throw fallbackError || new Error('Failed to create conversation');
    }
    conv = fallbackData;
  } else {
    conv = data;
  }

  // Send initial message if text was provided
  if (initialMessageText && initialMessageText.trim().length > 0 && conv) {
    try {
      await sendMessage(conv.id, userId, initialMessageText, targetAdminId || undefined);
    } catch (msgErr) {
      console.warn('Conversation created, but initial message failed:', msgErr);
    }
  }

  return conv.id;
}

/**
 * Sends a message within a conversation thread & dispatches bell notifications
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  recipientId?: string
): Promise<Message | null> {
  const payload: any = {
    conversation_id: conversationId,
    sender_id: senderId,
    body: body.trim(),
    read: false,
  };

  let insertedData: Message | null = null;

  const { data, error } = await supabase
    .from('messages')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.warn('First attempt sending message failed, retrying without read key:', error);
    delete payload.read;
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('messages')
      .insert([payload])
      .select()
      .single();

    if (fallbackError) {
      console.error('Error inserting message:', fallbackError);
      throw fallbackError;
    }
    insertedData = fallbackData as Message;
  } else {
    insertedData = data as Message;
  }

  // Update conversation timestamp
  try {
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  } catch (tsErr) {
    console.warn('Could not update conversation timestamp:', tsErr);
  }

  // Resolve target recipient ID if not explicitly provided
  let targetRecipientId = recipientId;
  if (!targetRecipientId) {
    try {
      const { data: convData } = await supabase
        .from('conversations')
        .select('user_id')
        .eq('id', conversationId)
        .maybeSingle();

      if (convData) {
        // If sender is the creator, target admin; otherwise target creator
        if (convData.user_id === senderId) {
          targetRecipientId = (await getAdminId()) || undefined;
        } else {
          targetRecipientId = convData.user_id;
        }
      }
    } catch (lookupErr) {
      console.warn('Could not resolve conversation recipient for notification:', lookupErr);
    }
  }

  // Dispatch bell notification to recipient
  if (targetRecipientId && targetRecipientId !== senderId) {
    try {
      await createNotification(
        targetRecipientId,
        'message',
        'New Message Received',
        body.length > 80 ? `${body.slice(0, 80)}...` : body,
        `/inbox`,
        conversationId
      );
    } catch (notifErr) {
      console.warn('Notification dispatch ignored:', notifErr);
    }
  }

  return insertedData;
}

/**
 * Marks all unread messages in a thread as read for the active user
 */
export async function markMessagesRead(conversationId: string, userId: string): Promise<void> {
  try {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId);
  } catch (err) {
    console.warn('Could not mark messages read:', err);
  }
}

/**
 * Creates an in-app bell notification
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
  conversationId?: string,
  bookingId?: string
): Promise<void> {
  try {
    const notifPayload: Record<string, any> = {
      user_id: userId,
      type,
      title,
      message,
      body: message, // Standardizes body/message fields
      link,
      read: false,
    };

    if (conversationId) notifPayload.conversation_id = conversationId;
    if (bookingId) notifPayload.booking_id = bookingId;

    const { error } = await supabase.from('notifications').insert([notifPayload]);

    if (error) {
      // Fallback: retry without optional relation columns if schema varies
      console.warn('Initial notification insert failed, retrying simplified:', error);
      await supabase.from('notifications').insert([
        {
          user_id: userId,
          title,
          body: message,
          read: false,
        },
      ]);
    }
  } catch (err) {
    console.warn('Could not create notification:', err);
  }
}

/**
 * Marks a single notification as read (Required by Navbar.tsx)
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
  } catch (err) {
    console.warn('Error marking notification read:', err);
  }
}

/**
 * Marks all notifications for a user as read (Required by Navbar.tsx)
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  try {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
  } catch (err) {
    console.warn('Error marking all notifications read:', err);
  }
}
