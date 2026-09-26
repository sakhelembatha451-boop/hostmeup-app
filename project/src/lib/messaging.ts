import { supabase } from './supabase';

export async function getAdminId(): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single();
  return data?.id || null;
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
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      read: false,
    })
    .select('*')
    .single();

  if (error && error.code === '42703') {
    return await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        body: content,
        read: false,
      })
      .select('*')
      .single();
  }

  return { data, error };
}

export async function markMessagesRead(conversationId: string, userId: string) {
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId);
}

// --- Notification Functions (Required for Navbar.tsx) ---

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
  }
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Error marking all notifications as read:', error);
  }
}
