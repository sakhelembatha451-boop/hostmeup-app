import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sendMessage, markMessagesRead } from '@/lib/messaging';
import AdminSafetyPanel from '../components/AdminSafetyPanel';
import { Loader2, Send, MessageSquare, X, Calendar, User, ArrowLeft, Shield, Plus, Search, Trash2, CheckSquare, Square } from 'lucide-react';
import type { Conversation, Message, Profile } from '@/types';

export default function AdminInboxPage() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'inbox' | 'safety'>('inbox');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Selection & Deletion State
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  // New Message Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<Profile | null>(null);
  const [newSubject, setNewSubject] = useState('');
  const [initialMsg, setInitialMsg] = useState('');
  const [startingConv, setStartingConv] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false });

      if (convError) throw convError;

      if (!convs || convs.length === 0) {
        setConversations([]);
        return;
      }

      const userIds = Array.from(new Set(convs.map((c) => c.user_id).filter(Boolean)));
      
      let profilesMap: Record<string, Profile> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, role')
          .in('id', userIds);

        if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => ({ ...acc, [p.id]: p as Profile }), {});
        }
      }

      const mappedConversations = convs.map((c) => ({
        ...c,
        user: profilesMap[c.user_id] || null,
      }));

      setConversations(mappedConversations as Conversation[]);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', profile.id)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setAllUsers((data as Profile[]) || []);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }, [profile]);

  const loadMessages = useCallback(async (convId: string) => {
    setMsgLoading(true);
    setSelectedMsgIds([]);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as Message[]) || []);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setMsgLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, []);

  useEffect(() => { 
    loadConversations(); 
    loadUsers();
  }, [loadConversations, loadUsers]);

  useEffect(() => {
    if (!selectedConv || !profile) return;
    loadMessages(selectedConv.id);
    markMessagesRead(selectedConv.id, profile.id);
  }, [selectedConv, loadMessages, profile]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedConv) return;
    const channel = supabase
      .channel(`admin_messages:${selectedConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConv.id}` },
        () => { loadMessages(selectedConv.id); loadConversations(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConv, loadMessages, loadConversations]);

  // Delete an entire Conversation from the left pane
  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation(); // Prevents clicking the card and opening it

    if (!confirm('Are you sure you want to delete this entire conversation thread and all its messages?')) return;

    try {
      // 1. Delete associated messages first
      await supabase.from('messages').delete().eq('conversation_id', convId);

      // 2. Delete conversation record
      const { error } = await supabase.from('conversations').delete().eq('id', convId);
      if (error) throw error;

      // 3. Update state
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (selectedConv?.id === convId) {
        setSelectedConv(null);
        setMessages([]);
      }
    } catch (err: any) {
      console.error('Failed to delete conversation:', err);
      alert(`Delete failed: ${err.message || 'Unknown error'}`);
    }
  };

  // Handle single and bulk message deletion
  const toggleSelectMessage = (id: string) => {
    setSelectedMsgIds((prev) =>
      prev.includes(id) ? prev.filter((msgId) => msgId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMsgIds.length === messages.length) {
      setSelectedMsgIds([]);
    } else {
      setSelectedMsgIds(messages.map((m) => m.id));
    }
  };

  const handleDeleteMessages = async (idsToDelete: string[]) => {
    if (!idsToDelete.length) return;
    if (!confirm(`Are you sure you want to delete ${idsToDelete.length} message(s)?`)) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      setMessages((prev) => prev.filter((m) => !idsToDelete.includes(m.id)));
      setSelectedMsgIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
    } catch (err: any) {
      console.error('Failed to delete message(s):', err);
      alert(`Delete failed: ${err.message || 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConv || !profile) return;
    setSending(true);
    try {
      await sendMessage(selectedConv.id, profile.id, replyText.trim(), selectedConv.user_id);
      setReplyText('');
      await loadMessages(selectedConv.id);
      loadConversations();
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSending(false);
    }
  };

  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipient || !newSubject.trim() || !initialMsg.trim() || !profile) return;
    setStartingConv(true);

    try {
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert([{
          user_id: selectedRecipient.id,
          subject: newSubject.trim(),
          type: 'inquiry'
        }])
        .select('id, user_id, subject, type, created_at, updated_at')
        .single();

      if (convError) {
        console.error('Conversation insert error:', convError);
        alert(`Failed to create conversation: ${convError.message}`);
        setStartingConv(false);
        return;
      }

      if (conv) {
        const { error: msgError } = await supabase
          .from('messages')
          .insert([{
            conversation_id: conv.id,
            sender_id: profile.id,
            body: initialMsg.trim(),
            read: false
          }]);

        if (msgError) {
          console.error('Message insert error:', msgError);
          alert(`Failed to create message: ${msgError.message}`);
          setStartingConv(false);
          return;
        }

        setIsModalOpen(false);
        setSelectedRecipient(null);
        setNewSubject('');
        setInitialMsg('');
        setUserSearch('');

        await loadConversations();
        
        const fullConv: Conversation = {
          ...conv,
          user: selectedRecipient
        };
        setSelectedConv(fullConv);
      }
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
      alert(`Error: ${err?.message || 'Something went wrong'}`);
    } finally {
      setStartingConv(false);
    }
  };

  const filteredUsers = allUsers.filter(u => 
    (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12">
        {/* Header & Section Switcher */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Admin Control Center</p>
            <h1 className="font-display text-4xl font-bold text-ink tracking-tight">
              {activeTab === 'inbox' ? 'Admin Inbox' : 'Safety & Reports'}
            </h1>
            <p className="text-ink-400 mt-1">
              {activeTab === 'inbox' 
                ? 'All user conversations and booking discussions.' 
                : 'Manage user reports, safety flags, and platform moderation.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'inbox' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide-sm bg-ink text-paper hover:bg-ink/90 transition-colors border border-ink"
              >
                <Plus className="w-4 h-4" />
                New Message
              </button>
            )}
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide-sm transition-colors border ${
                activeTab === 'inbox' 
                  ? 'bg-ink text-paper border-ink' 
                  : 'bg-paper text-ink border-line hover:bg-paper-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Inbox
            </button>
            <button
              onClick={() => setActiveTab('safety')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide-sm transition-colors border ${
                activeTab === 'safety' 
                  ? 'bg-ink text-paper border-ink' 
                  : 'bg-paper text-ink border-line hover:bg-paper-200'
              }`}
            >
              <Shield className="w-4 h-4" />
              Safety Panel
            </button>
          </div>
        </div>

        {activeTab === 'safety' && (
          <div className="mt-6">
            <AdminSafetyPanel />
          </div>
        )}

        {activeTab === 'inbox' && (
          conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border border-line bg-paper-100">
              <div className="w-16 h-16 border border-line flex items-center justify-center text-ink-300 mb-6 bg-paper">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="font-display text-xl text-ink mb-1">No conversations yet</h3>
              <p className="text-sm text-ink-400 mb-6">Start a conversation directly with any artist or host.</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-primary flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-wide-sm"
              >
                <Plus className="w-4 h-4" />
                Start First Message
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border border-line min-h-[500px]">
              {/* Conversation list (Left Pane) */}
              <div className={`lg:col-span-1 border-r border-line ${selectedConv ? 'hidden lg:block' : ''}`}>
                <div className="divide-y divide-line max-h-[600px] overflow-y-auto">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConv(conv)}
                      className={`group relative w-full text-left p-5 cursor-pointer transition-colors ${
                        selectedConv?.id === conv.id ? 'bg-paper-200' : 'hover:bg-paper-200/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {conv.user?.avatar_url ? (
                            <img src={conv.user.avatar_url} alt={`Profile photo of ${conv.user?.full_name || 'user'}`} width={32} height={32} className="w-8 h-8 rounded-full object-cover border border-line flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-ink text-paper flex items-center justify-center text-xs font-medium flex-shrink-0">{conv.user?.full_name?.[0]?.toUpperCase() || '?'}</div>
                          )}
                          <span className="font-medium text-ink text-sm truncate">{conv.user?.full_name || 'Unknown'}</span>
                        </div>
                        <span className="text-xs text-ink-300 flex-shrink-0">
                          {conv.updated_at ? new Date(conv.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>
                      <p className="text-sm text-ink-600 truncate mb-1 pr-6">{conv.subject}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {conv.type === 'booking' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-accent"><Calendar className="w-3 h-3" /> Booking</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-ink-400"><MessageSquare className="w-3 h-3" /> Direct</span>
                          )}
                          {conv.user?.role === 'artist' && <span className="text-xs text-ink-300">Artist</span>}
                          {conv.user?.role === 'host' && <span className="text-xs text-ink-300">Host</span>}
                        </div>

                        {/* Delete Conversation Button */}
                        <button
                          onClick={(e) => handleDeleteConversation(e, conv.id)}
                          title="Delete entire conversation"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message thread (Right Pane) */}
              <div className={`lg:col-span-2 flex flex-col ${selectedConv ? '' : 'hidden lg:flex'}`}>
                {selectedConv ? (
                  <>
                    {/* Thread header */}
                    <div className="border-b border-line p-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <button onClick={() => setSelectedConv(null)} className="lg:hidden text-ink-400 hover:text-ink"><ArrowLeft className="w-5 h-5" /></button>
                          <h3 className="font-display text-lg font-semibold text-ink">{selectedConv.subject}</h3>
                        </div>
                        <button onClick={() => setSelectedConv(null)} className="lg:hidden text-ink-400 hover:text-ink"><X className="w-5 h-5" /></button>
                      </div>
                      <div className="flex items-center justify-between text-xs text-ink-400">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {selectedConv.user?.full_name}</span>
                        
                        {/* Select All & Bulk Action Bar */}
                        {messages.length > 0 && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={toggleSelectAll}
                              className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink transition-colors"
                            >
                              {selectedMsgIds.length === messages.length ? (
                                <CheckSquare className="w-3.5 h-3.5 text-ink" />
                              ) : (
                                <Square className="w-3.5 h-3.5" />
                              )}
                              <span>Select All</span>
                            </button>

                            {selectedMsgIds.length > 0 && (
                              <button
                                onClick={() => handleDeleteMessages(selectedMsgIds)}
                                disabled={deleting}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                Delete Selected ({selectedMsgIds.length})
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Messages List */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[300px] max-h-[400px]">
                      {msgLoading ? (
                        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-ink animate-spin" /></div>
                      ) : messages.length === 0 ? (
                        <div className="text-center py-12 text-sm text-ink-400">No messages in this thread yet.</div>
                      ) : (
                        messages.map((msg) => {
                          const isOwn = msg.sender_id === profile?.id;
                          const isSelected = selectedMsgIds.includes(msg.id);

                          return (
                            <div key={msg.id} className={`group flex items-start gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              {/* Selection Checkbox */}
                              <button
                                onClick={() => toggleSelectMessage(msg.id)}
                                className={`mt-2 text-ink-300 hover:text-ink transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-ink" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>

                              <div className={`max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                                {!isOwn && <span className="text-xs text-ink-400 mb-1 px-1">{msg.sender?.full_name}</span>}
                                
                                <div className="relative group/msg">
                                  <div className={`px-4 py-3 text-sm ${isOwn ? 'bg-ink text-paper' : 'bg-paper-200 text-ink border border-line'} ${isSelected ? 'ring-2 ring-ink' : ''}`}>
                                    {msg.body}
                                  </div>

                                  {/* Individual Delete Button */}
                                  <button
                                    onClick={() => handleDeleteMessages([msg.id])}
                                    title="Delete message"
                                    className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/msg:opacity-100 transition-opacity p-1.5 rounded text-red-500 hover:bg-red-50 ${isOwn ? '-left-8' : '-right-8'}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
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
                    <p className="text-sm text-ink-400">Select a conversation or click "+ New Message" to talk to a user.</p>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* Start New Conversation Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
            <div className="bg-paper border border-line w-full max-w-lg p-6 relative shadow-xl">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-ink-400 hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="font-display text-2xl font-bold text-ink mb-1">New Message</h2>
              <p className="text-xs text-ink-400 uppercase tracking-wide-sm mb-6">Send a direct message to any platform user</p>

              <form onSubmit={handleStartConversation} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2 font-medium">Select Recipient</label>
                  {!selectedRecipient ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-ink-400" />
                        <input
                          type="text"
                          placeholder="Search users by name or email..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="input-editorial w-full pl-9 pr-4 py-2 text-sm"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-line divide-y divide-line bg-paper-100">
                        {filteredUsers.length === 0 ? (
                          <div className="p-3 text-xs text-ink-400 text-center">No matching users found</div>
                        ) : (
                          filteredUsers.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => setSelectedRecipient(u)}
                              className="w-full text-left p-2.5 hover:bg-paper-200 transition-colors flex items-center justify-between"
                            >
                              <div>
                                <p className="text-sm font-medium text-ink">{u.full_name || 'Unnamed User'}</p>
                                <p className="text-xs text-ink-400">{u.email}</p>
                              </div>
                              <span className="text-[10px] uppercase tracking-wide-sm border border-line px-2 py-0.5 text-ink-400 bg-paper">
                                {u.role || 'user'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 border border-ink bg-paper-200">
                      <div>
                        <p className="text-sm font-semibold text-ink">{selectedRecipient.full_name}</p>
                        <p className="text-xs text-ink-400">{selectedRecipient.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedRecipient(null)}
                        className="text-xs text-accent hover:underline font-medium"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2 font-medium">Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Account Support / Platform Update"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="input-editorial w-full px-4 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2 font-medium">Message Body</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Type your message..."
                    value={initialMsg}
                    onChange={(e) => setInitialMsg(e.target.value)}
                    className="input-editorial w-full px-4 py-2.5 text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide-sm border border-line text-ink hover:bg-paper-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={startingConv || !selectedRecipient || !newSubject.trim() || !initialMsg.trim()}
                    className="btn-primary px-6 py-2.5 text-xs font-semibold uppercase tracking-wide-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {startingConv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Send Message
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
