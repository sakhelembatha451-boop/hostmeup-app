import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getAdminId, createConversation, sendMessage, markMessagesRead } from '@/lib/messaging';
import { Loader2, Send, MessageSquare, ArrowLeft, Plus, Mail, Calendar, X } from 'lucide-react';
import type { Conversation, Message } from '@/types';

export default function InboxPage() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('conversations')
      .select('*, user:profiles!conversations_user_id_fkey(id, full_name, avatar_url), booking:bookings(id, event_name, event_date, status)')
      .eq('user_id', profile.id)
      .order('updated_at', { ascending: false });
    if (error) { setConversations([]); }
    else { setConversations((data as Conversation[]) || []); }
    setLoading(false);
  }, [profile]);

  const loadMessages = useCallback(async (convId: string) => {
    setMsgLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) || []);
    setMsgLoading(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  useEffect(() => {
    loadConversations();
    getAdminId().then(setAdminId);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedConv) return;
    loadMessages(selectedConv.id);
    if (profile) markMessagesRead(selectedConv.id, profile.id);
  }, [selectedConv, loadMessages, profile]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!selectedConv) return;
    const channel = supabase
      .channel(`messages:${selectedConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConv.id}` },
        () => { loadMessages(selectedConv.id); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConv, loadMessages]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConv || !profile) return;
    setSending(true);
    try {
      await sendMessage(selectedConv.id, profile.id, replyText.trim(), adminId ?? undefined);
      setReplyText('');
      await loadMessages(selectedConv.id);
      loadConversations();
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleCreateConversation = async () => {
    if (!profile || !newSubject.trim() || !newMessage.trim()) return;
    setCreating(true);
    try {
      const id = await createConversation(profile.id, newSubject.trim(), 'direct', undefined, newMessage.trim(), adminId);
      if (id) {
        setShowNewModal(false);
        setNewSubject('');
        setNewMessage('');
        await loadConversations();
        const newConv = (await supabase.from('conversations').select('*, user:profiles!conversations_user_id_fkey(id, full_name, avatar_url), booking:bookings(id, event_name, event_date, status)').eq('id', id).maybeSingle()).data as Conversation;
        if (newConv) setSelectedConv(newConv);
      }
    } catch { /* ignore */ }
    setCreating(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Inbox</p>
            <h1 className="font-display text-4xl font-bold text-ink tracking-tight">Messages</h1>
          </div>
          <button onClick={() => setShowNewModal(true)} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wide-sm">
            <Plus className="w-3.5 h-3.5" /> New Message
          </button>
        </div>

        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 border border-line flex items-center justify-center text-ink-300 mb-6"><Mail className="w-7 h-7" /></div>
            <h3 className="font-display text-xl text-ink mb-1">No messages yet</h3>
            <p className="text-sm text-ink-400 mb-6">Start a conversation with the platform admin.</p>
            <button onClick={() => setShowNewModal(true)} className="btn-primary px-6 py-3 text-xs uppercase tracking-wide-sm">Contact Admin</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border border-line min-h-[500px]">
            {/* Conversation list */}
            <div className={`lg:col-span-1 border-r border-line ${selectedConv ? 'hidden lg:block' : ''}`}>
              <div className="divide-y divide-line">
                {conversations.map((conv) => (
                  <button key={conv.id} onClick={() => setSelectedConv(conv)}
                    className={`w-full text-left p-5 transition-colors ${selectedConv?.id === conv.id ? 'bg-paper-200' : 'hover:bg-paper-200/50'}`}>
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <span className="font-medium text-ink text-sm truncate">{conv.subject}</span>
                      <span className="text-xs text-ink-300 flex-shrink-0">{new Date(conv.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    {conv.type === 'booking' && conv.booking && (
                      <div className="inline-flex items-center gap-1 text-xs text-accent mb-1">
                        <Calendar className="w-3 h-3" /> {conv.booking.event_name}
                      </div>
                    )}
                    <p className="text-xs text-ink-400 truncate">{conv.type === 'booking' ? 'Booking discussion' : 'Direct message'}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Message thread */}
            <div className={`lg:col-span-2 flex flex-col ${selectedConv ? '' : 'hidden lg:flex'}`}>
              {selectedConv ? (
                <>
                  {/* Thread header */}
                  <div className="border-b border-line p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">{selectedConv.subject}</h3>
                      {selectedConv.type === 'booking' && selectedConv.booking && selectedConv.booking?.id && (
                        <Link to={`/artists/${selectedConv.booking.id}`} aria-label={`View booking for ${selectedConv.booking.event_name}`} className="text-xs text-accent hover:text-accent-600 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" /> {selectedConv.booking.event_name}
                        </Link>
                      )}
                    </div>
                    <button onClick={() => setSelectedConv(null)} className="lg:hidden text-ink-400 hover:text-ink"><X className="w-5 h-5" /></button>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[300px] max-h-[500px]">
                    {msgLoading ? (
                      <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-ink animate-spin" /></div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-12 text-sm text-ink-400">No messages in this thread yet.</div>
                    ) : (
                      messages.map((msg) => {
                        const isOwn = msg.sender_id === profile?.id;
                        return (
                          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                              <div className={`px-4 py-3 text-sm ${isOwn ? 'bg-ink text-paper' : 'bg-paper-200 text-ink border border-line'} rounded-none`}>
                                {msg.body}
                              </div>
                              <span className="text-xs text-ink-300 mt-1 px-1">
                                {new Date(msg.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply box */}
                  <div className="border-t border-line p-4 flex items-end gap-3">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={1}
                      placeholder="Type your reply..."
                      className="input-editorial flex-1 px-4 py-3 text-sm resize-none"
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                    />
                    <button onClick={handleSendReply} disabled={sending || !replyText.trim()}
                      className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wide-sm disabled:opacity-50 flex-shrink-0">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <MessageSquare className="w-10 h-10 text-ink-200 mb-4" />
                  <p className="text-sm text-ink-400">Select a conversation to view messages.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New message modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowNewModal(false)}>
          <div className="bg-paper border border-line max-w-md w-full p-8 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-bold text-ink">New Message to Admin</h3>
              <button onClick={() => setShowNewModal(false)} className="text-ink-400 hover:text-ink"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Subject</label>
                <input type="text" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className="input-editorial w-full px-4 py-3 text-sm" placeholder="What's this about?" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Message</label>
                <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} rows={5} className="input-editorial w-full px-4 py-3 text-sm" placeholder="Write your message..." />
              </div>
              <button onClick={handleCreateConversation} disabled={creating || !newSubject.trim() || !newMessage.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-xs uppercase tracking-wide-sm disabled:opacity-50">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
