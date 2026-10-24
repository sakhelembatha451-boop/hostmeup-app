import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Send, Loader2, User, MessageSquare, Calendar, MapPin, ArrowLeft } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  booking_id?: string;
  gig_id?: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface ConversationContact {
  id: string;
  full_name: string;
  avatar_url: string | null;
  location?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

export default function Messages() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const initialRecipientId = searchParams.get('recipient_id');

  const [contacts, setContacts] = useState<ConversationContact[]>([]);
  const [activeContact, setActiveContact] = useState<ConversationContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load conversation contacts
  const loadContacts = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // Fetch all messages involving the current user
      const { data: rawMessages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const contactMap = new Map<string, { lastMsg: string; time: string; unread: number }>();
      const userIds = new Set<string>();

      if (initialRecipientId && initialRecipientId !== profile.id) {
        userIds.add(initialRecipientId);
      }

      (rawMessages || []).forEach((msg) => {
        const otherId = msg.sender_id === profile.id ? msg.recipient_id : msg.sender_id;
        userIds.add(otherId);

        if (!contactMap.has(otherId)) {
          contactMap.set(otherId, {
            lastMsg: msg.content,
            time: msg.created_at,
            unread: !msg.is_read && msg.recipient_id === profile.id ? 1 : 0,
          });
        } else if (!msg.is_read && msg.recipient_id === profile.id) {
          const current = contactMap.get(otherId)!;
          current.unread += 1;
        }
      });

      if (userIds.size > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, location')
          .in('id', Array.from(userIds));

        const formattedContacts: ConversationContact[] = (profilesData || []).map((p) => {
          const meta = contactMap.get(p.id);
          return {
            ...p,
            lastMessage: meta?.lastMsg || 'Started a conversation',
            lastMessageTime: meta?.time || new Date().toISOString(),
            unreadCount: meta?.unread || 0,
          };
        });

        setContacts(formattedContacts);

        if (initialRecipientId) {
          const selected = formattedContacts.find((c) => c.id === initialRecipientId);
          if (selected) setActiveContact(selected);
        } else if (formattedContacts.length > 0 && !activeContact) {
          setActiveContact(formattedContacts[0]);
        }
      }
    } catch (err) {
      console.error('Error loading contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  }, [profile?.id, initialRecipientId, activeContact]);

  // Load active chat thread
  const loadMessages = useCallback(async () => {
    if (!profile?.id || !activeContact?.id) return;

    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${profile.id},recipient_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},recipient_id.eq.${profile.id})`
        )
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark unread messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('recipient_id', profile.id)
        .eq('sender_id', activeContact.id)
        .eq('is_read', false);

    } catch (err) {
      console.error('Error loading chat thread:', err);
    } finally {
      setLoadingMessages(false);
      setTimeout(scrollToBottom, 100);
    }
  }, [profile?.id, activeContact?.id]);

  useEffect(() => { loadContacts(); }, [loadContacts]);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;

          // If message belongs to active thread, append it
          if (
            activeContact &&
            ((newMsg.sender_id === activeContact.id && newMsg.recipient_id === profile.id) ||
             (newMsg.sender_id === profile.id && newMsg.recipient_id === activeContact.id))
          ) {
            setMessages((prev) => [...prev, newMsg]);
            setTimeout(scrollToBottom, 100);
          }

          loadContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, activeContact, loadContacts]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile?.id || !activeContact?.id) return;

    setSending(true);
    const textToSend = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: profile.id,
        recipient_id: activeContact.id,
        content: textToSend,
      });

      if (error) throw error;
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loadingContacts) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-ink animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">— Communication Center</p>
            <h1 className="font-display text-3xl font-bold text-ink tracking-tight">Direct Inbox</h1>
          </div>
          <Link to="/dashboard" className="text-xs font-semibold uppercase tracking-wide-sm text-ink hover:underline flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>

        <div className="border border-line bg-white grid grid-cols-1 md:grid-cols-3 min-h-[650px] shadow-xs">
          
          {/* Contacts / Threads List */}
          <div className="border-r border-line flex flex-col bg-paper-50">
            <div className="p-4 border-b border-line bg-paper">
              <h3 className="font-display text-sm font-bold text-ink uppercase tracking-wider">Conversations</h3>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-line">
              {contacts.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-400 space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto text-ink-300" />
                  <p>No messages yet. Direct chat threads will appear here once you communicate with talent or hosts.</p>
                </div>
              ) : (
                contacts.map((contact) => {
                  const isActive = activeContact?.id === contact.id;
                  return (
                    <button
                      key={contact.id}
                      onClick={() => setActiveContact(contact)}
                      className={`w-full text-left p-4 transition-colors flex items-start gap-3 relative ${
                        isActive ? 'bg-purple-50/60 border-l-4 border-l-purple-900' : 'hover:bg-paper-100'
                      }`}
                    >
                      {contact.avatar_url ? (
                        <img src={contact.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-line flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {contact.full_name?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-display font-bold text-ink text-xs truncate">{contact.full_name}</p>
                          {contact.lastMessageTime && (
                            <span className="text-[10px] text-ink-400">
                              {new Date(contact.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-500 truncate">{contact.lastMessage}</p>
                      </div>

                      {contact.unreadCount ? contact.unreadCount > 0 && (
                        <span className="bg-purple-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {contact.unreadCount}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Chat Thread */}
          <div className="md:col-span-2 flex flex-col bg-white">
            {activeContact ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-line flex items-center justify-between bg-paper">
                  <div className="flex items-center gap-3">
                    {activeContact.avatar_url ? (
                      <img src={activeContact.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-line" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-xs">
                        {activeContact.full_name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div>
                      <h3 className="font-display font-bold text-ink text-sm">{activeContact.full_name}</h3>
                      {activeContact.location && (
                        <p className="text-[11px] text-ink-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {activeContact.location}
                        </p>
                      )}
                    </div>
                  </div>

                  <Link to={`/artists/${activeContact.id}`} className="text-xs font-semibold underline text-purple-900 hover:text-purple-950">
                    View Profile
                  </Link>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[480px]">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-5 h-5 text-ink animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-xs text-ink-400 py-12">
                      This is the beginning of your direct conversation with {activeContact.full_name}.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === profile?.id;
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`max-w-md p-3.5 text-xs rounded-xs shadow-2xs ${
                              isMe
                                ? 'bg-purple-900 text-white border border-purple-950'
                                : 'bg-paper-100 text-ink border border-line'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <span className="text-[10px] text-ink-400 mt-1 px-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Bar */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-line bg-paper flex items-center gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Message ${activeContact.full_name}...`}
                    className="flex-1 px-4 py-2.5 text-xs border border-line bg-white text-ink rounded-none focus:outline-none focus:border-ink"
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="px-5 py-2.5 bg-ink text-paper text-xs uppercase font-semibold tracking-wide-sm hover:bg-ink/80 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Send</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-ink-400">
                Select a conversation from the sidebar to view messages.
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
