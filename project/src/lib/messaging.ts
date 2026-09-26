import { supabase } from './supabase';
import type { Conversation, Message } from '@/types';

export async function getAdminId(): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .or('role.eq.admin,email.eq.sakhelembatha451@gmail.com')
      .limit(1)
      .maybeSingle();

    return data?.id || null;
  } catch (err) {
    console.error('Error fetching admin ID:', err);
    return null;
  }
}

export async function createConversation(
  userId: string,
  subject: string,
  type: 'booking' | 'direct' = 'direct',
  bookingId?: string,
  initialMessage?: string,
  recipientId?: string
): Promise<string | null> {
  try {
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        subject,
        type,
        booking_id: bookingId || null,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (convError || !conv) {
      console.error('Error creating conversation:', convError);
      throw convError;
    }

    if (initialMessage) {
      await sendMessage(conv.id, userId, initialMessage, recipientId);
    }

    return conv.id;
  } catch (err) {
    console.error('Failed to create conversation:', err);
    throw err;
  }
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  recipientId?: string
): Promise<Message | null> {
  try {
    // Attempt insert with 'content' column (Supabase standard)
    let payload: Record<string, unknown> = {
      conversation_id: conversationId,
      sender_id: senderId,
      content: body,
      read: false,
      created_at: new Date().toISOString(),
    };

    let { data, error } = await supabase
      .from('messages')
      .insert(payload)
      .select('*')
      .single();

    // Fallback if schema uses 'body' column instead of 'content'
    if (error && error.code === '42703') {
      payload = {
        conversation_id: conversationId,
        sender_id: senderId,
        body: body,
        read: false,
        created_at: new Date().toISOString(),
      };

      const fallback = await supabase
        .from('messages')
        .insert(payload)
        .select('*')
        .single();

      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('Error inserting message into Supabase:', error);
      alert(`Message error: ${error.message}`);
      return null;
    }

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data as Message;
  } catch (err) {
    console.error('Send message exception:', err);
    return null;
  }
}

export async function markMessagesRead(conversationId: string, userId: string): Promise<void> {
  try {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId);
  } catch (err) {
    console.error('Error marking read:', err);
  }
}
