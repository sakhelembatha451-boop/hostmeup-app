import { supabase } from '@/lib/supabase';

export async function getAdminId(): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_admin', true)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createConversation(
  userId: string,
  subject: string,
  type: 'direct' | 'booking' = 'direct',
  bookingId?: string,
  initialMessage?: string,
  adminId?: string | null,
): Promise<string | null> {
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      subject,
      type,
      booking_id: bookingId ?? null,
    })
    .select('id')
    .single();

  if (convErr || !conv) return null;

  if (initialMessage) {
    await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: userId,
      body: initialMessage,
    });
  }

  if (adminId) {
    await supabase.from('notifications').insert({
      user_id: adminId,
      type: type === 'booking' ? 'booking' : 'message',
      title: subject,
      body: initialMessage || 'New conversation started',
      conversation_id: conv.id,
      booking_id: bookingId ?? null,
    });
  }

  return conv.id;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  recipientId?: string,
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body,
  });
  if (error) throw error;

  await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

  if (recipientId) {
    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'message',
      title: 'New message',
      body: body.slice(0, 100),
      conversation_id: conversationId,
    });
  }
}

export async function markMessagesRead(conversationId: string, readerId: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .is('read_at', null)
    .neq('sender_id', readerId);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
}
