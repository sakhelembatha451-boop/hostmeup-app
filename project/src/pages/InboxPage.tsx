import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getAdminId, createConversation, sendMessage, markMessagesRead } from '@/lib/messaging';
import { Loader2, Send, MessageSquare, Plus, Mail, X, User } from 'lucide-react';
import type { Conversation, Message } from '@/types';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xoevdgog';

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

  const isAdmin = profile?.role === 'admin' || profile?.email === 'sakhelembatha451@gmail.com';

  const sendEmailNotification = async (subject: string, message: string) => {
    try {
      await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json' 
        },
        body: JSON.stringify({
          _replyto: profile?.email || 'user@hostmeup.co.za',
          name: profile?.full_name || 'HostMeUp User',
          subject: `[HostMeUp] ${subject}`,
          message: `From: ${profile?.full_name ?? 'User'} (${profile?.email ?? 'No email'})\n\nSubject: ${subject}\n\nMessage:\n${message}`,
        }),
      });
    } catch (err) {
      console.error('Formspree dispatch error:', err);
    }
  };

  const loadConversations = useCallback(async () => {
    if (!profile) return;
    try {
      let query = supabase
        .from('conversations')
        .select('*, user:profiles!conversations_user_id_fkey(id, full_name, avatar_url, email), messages(id, read, sender_id)');

      if (!isAdmin) {
        query = query.eq('user_id', profile.id);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        let fallbackQuery = supabase.from('conversations').select('*');
        if (!isAdmin) fallbackQuery = fallbackQuery.eq('user_id', profile.id);
        const { data: fallbackData } = await fallbackQuery;
        setConversations((fallbackData as Conversation[]) || []);
      } else {
        setConversations((data as Conversation[]) || []);
      }
    } catch (err) {
      console.error('Unexpected error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin]);

  const loadMessages = useCallback(async (convId: string) => {
    setMsgLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles(id, full_name, avatar_url, role)')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) {
        const { data: fallbackMsgs } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });
        setMessages((fallbackMsgs as Message[]) || []);
      } else {
        setMessages((data as Message[]) || []);
      }
    } catch (err) {
      console.error('Unexpected error loading messages:', err);
    } finally {
      setMsgLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    getAdminId().then(setAdminId).catch((err) => console.error('Error fetching admin ID:', err));
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedConv || !profile) return;
    loadMessages(selectedConv.id);
    markMessagesRead(selectedConv.id, profile.id).then(() => loadConversations());
  }, [selectedConv, loadMessages, profile, loadConversations]);

  useEffect(() => {
    if (!selectedConv || !profile) return;
    const channel = supabase
      .channel(`messages:${selectedConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConv.id}` },
        () => { 
          loadMessages(selectedConv.id);
          markMessagesRead(selectedConv.id, profile.id).then(() => loadConversations());
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConv, loadMessages, profile, loadConversations]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConv || !profile) return;
    setSending(true);
    const messageBody = replyText.trim();

    const recipientId = isAdmin 
      ? selectedConv.user_id 
      : (adminId || selectedConv.user_id);

    try {
      await sendMessage(selectedConv.id, profile.id, messageBody, recipientId);
      sendEmailNotification(`Reply: ${selectedConv.subject}`, messageBody).catch(err => console.warn('Email dispatch failed:', err));

      setReplyText('');
      await loadMessages(selectedConv.id);
      loadConversations();
    } catch (err) {
      console.error('Reply error:', err);
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!profile || !newSubject.trim() || !newMessage.trim()) return;
    setCreating(true);

    const subject = newSubject.trim();
    const body = newMessage.trim();

    try {
      const id = await createConversation(profile.id, subject, 'direct', undefined, body, adminId);
      
      sendEmailNotification(subject, body).catch(err => console.warn('Email dispatch failed:', err));

      setNewSubject('');
      setNewMessage('');
      setShowNewModal(false);

      await loadConversations();

      if (id) {
        const { data: newConv } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (newConv) setSelectedConv(newConv as Conversation);
      }
    } catch (err) {
      console.error('Create conversation error:', err);
      alert('Could not send message. Please check connection or permissions.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— {isAdmin ? 'Admin Console' : 'Inbox'}</p>
            <h1 className="font-display text-4xl font-bold text-ink tracking-tight">Messages</h1>
          </div>
          {!isAdmin && (
            <button onClick={() => setShowNewModal(true)} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wide-sm">
              <Plus className="w-3.5 h-3.5" /> New Message
            </button>
          )}
        </div>

        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 border border-line flex items-center justify-center text-ink-300 mb-6"><Mail className="w-7 h-7" /></div>
            <h3 className="font-display text-xl text-ink mb-1">No messages yet</h3>
            <p className="text-sm text-ink-400 mb-6">{isAdmin ? 'No user queries submitted yet.' : 'Start a conversation with the platform admin.'}</p>
            {!isAdmin && (
              <button onClick={() => setShowNewModal(true)} className="btn-primary px-6 py-3 text-xs uppercase tracking-wide-sm">Contact Admin</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border border-line min-h-[500px]">
            {/* Conversation List */}
            <div className={`lg:col-span-1 border-r border-line ${selectedConv ? 'hidden lg:block' : ''}`}>
              <div className="divide-y divide-line">
                {conversations.map((conv) => {
                  const unreadCount = (conv as any).messages?.filter(
                    (m: any) => !m.read && m.sender_id !== profile?.id
                  ).length || 0;

                  return (
                    <button key={conv.id} onClick={() => setSelectedConv(conv)}
                      className={`w-full text-left p-5 transition-colors relative ${selectedConv?.id === conv.id ? 'bg-paper-200' : 'hover:bg-paper-200/50'}`}>
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <span className={`text-sm truncate ${unreadCount > 0 ? 'font-bold text-ink' : 'font-medium text-ink-400'}`}>
                          {conv.subject}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {unreadCount > 0 && (
                            <span className="bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Unread
                            </span>
                          )}
                          <span className="text-xs text-ink-300">
                            {conv.created_at ? new Date(conv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}
                          </span>
                        </div>
                      </div>
                      {isAdmin && (
                        <p className="text-xs text-accent font-medium mb-1 flex items-center gap-1">
                          <User className="w-3 h-3" /> {(conv as any).user?.full_name || 'User'}
                        </p>
                      )}
                      <p className="text-xs text-ink-400 truncate">{conv.type === 'booking' ? 'Booking discussion' : 'Direct message'}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Thread */}
            <div className={`lg:col-span-2 flex flex-col ${selectedConv ? '' : 'hidden lg:flex'}`}>
              {selectedConv ? (
                <>
                  <div className="border-b border-line p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">{selectedConv.subject}</h3>
                      <p className="text-xs text-ink-400">
                        Thread with {(selectedConv as any).user?.full_name || 'User'}
                      </p>
                    </div>
                    <button onClick={() => setSelectedConv(null)} className="lg:hidden text-ink-400 hover:text-ink"><X className="w-5 h-5" /></button>
                  </div>

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
                              <span className="text-[10px] text-ink-400 mb-0.5 px-1">
                                {isOwn ? 'You' : (msg as any).sender?.full_name || 'User'}
                              </span>
                              <div className={`px-4 py-3 text-sm ${isOwn ? 'bg-ink text-paper' : 'bg-paper-200 text-ink border border-line'}`}>
                                {msg.body}
                              </div>
                              <span className="text-xs text-ink-300 mt-1 px-1">
                                {msg.created_at ? new Date(msg.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Just now'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply Input */}
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
                  <p className="text-sm text-ink-400">Select a conversation thread to view live messages.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
