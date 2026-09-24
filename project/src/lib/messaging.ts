import { supabase } from './supabase';
import type { Message, Conversation } from '@/types';

/**
 * Gets the Admin User ID from profiles table
 */
export async function getAdminId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .maybeSingle();

  if (error || !data) {
    const { data: emailData } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'sakhelembatha451@gmail.com')
      .maybeSingle();
    return emailData?.id || null;
  }
  return data.id;
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

  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert([
      {
        user_id: userId,
        subject,
        type,
        booking_id: bookingId || null,
        status: 'open',
      },
    ])
    .select()
    .single();

  if (convError || !conv) {
    console.error('Error creating conversation:', convError);
    throw convError;
  }

  if (initialMessageText && initialMessageText.trim().length > 0) {
    await sendMessage(conv.id, userId, initialMessageText, targetAdminId || undefined);
  }

  return conv.id;
}

/**
 * Sends a message within a conversation thread & dispatches bell notification
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

  const { data, error } = await supabase
    .from('messages')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error inserting message:', error);
    throw error;
  }

  // Update conversation timestamp
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  // Dispatch notification to recipient
  if (recipientId && recipientId !== senderId) {
    await createNotification(
      recipientId,
      'message',
      'New Reply from Admin',
      body.length > 80 ? `${body.slice(0, 80)}...` : body,
      `/inbox`
    );
  }

  return data as Message;
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
  link?: string
): Promise<void> {
  try {
    await supabase.from('notifications').insert([
      {
        user_id: userId,
        type,
        title,
        message,
        link,
        read: false,
      },
    ]);
  } catch (err) {
    console.warn('Could not create notification:', err);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
}
