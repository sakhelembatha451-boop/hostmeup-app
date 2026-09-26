import { supabase } from './supabase';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  type?: string;
  link?: string;
  created_at?: string;
}

export async function getAdminId(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (error) console.error('Error fetching admin ID:', error);
    return data?.id || null;
  } catch (err) {
    console.error('Unexpected error fetching admin ID:', err);
    return null;
  }
}

export async function createConversation(
  userId: string,
  subject: string,
  type = 'direct',
  bookingId?: string,
  initialMessage?: string,
  recipientId?: string
): Promise<string | null> {
  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      subject,
      type,
      booking_id: bookingId,
    })
    .select('id')
    .single();

  if (error || !conv) throw error;

  if (initialMessage) {
    await sendMessage(conv.id, userId, initialMessage, recipientId);
  }

  return conv.id;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  _recipientId?: string
) {
  const messageText = content || '';

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: messageText,
      content: messageText,
      read: false,
      is_read: false,
    })
    .select('*')
    .single();

  return { data, error };
}

export async function markMessagesRead(conversationId: string, userId: string) {
  const { error } = await supabase
    .from('messages')
    .update({ read: true, is_read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId);

  if (error) console.error('Error marking messages read:', error);
}

// --- Notification Exports ---

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type = 'info',
  link?: string
) {
  // Try inserting with all fields
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      message,
      type,
      link,
      read: false,
    })
    .select('*')
    .single();

  // Fallback insert if columns like 'type' or 'link' are missing in DB table
  if (error) {
    console.warn('Fallback notification insert:', error);
    return await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        read: false,
      })
      .select('*')
      .single();
  }

  return { data, error };
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) console.error('Error marking notification read:', error);
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId);

  if (error) console.error('Error marking all notifications read:', error);
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error('Error fetching unread notification count:', err);
    return 0;
  }
}
