import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  X,
  Search,
  CheckSquare,
  Square as UncheckedSquare,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext'; // Updated path (change to '../contexts/AuthContext' if your folder is named 'contexts')

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  user_id: string;
  participant1_id?: string;
  participant2_id?: string;
  subject: string;
  type?: 'general' | 'booking';
  reference_id?: string;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  messages?: Message[];
  displayName?: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface InboxPageProps {
  targetUserId?: string | null;
  targetConvId?: string | null;
  onClearTargets?: () => void;
}

export const InboxPage: React.FC<InboxPageProps> = ({
  targetUserId,
  targetConvId,
  onClearTargets,
}) => {
  const { profile, isAdmin } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // New message modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [recipients, setRecipients] = useState<UserProfile[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');

  // Bulk selection state
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);

  // 1. Load Conversations with Profile Resolution
  const loadConversations = useCallback(async () => {
    if (!profile) return;
    try {
      let query = supabase
        .from('conversations')
        .select('*, messages(id, read, sender_id)');

      if (isAdmin) {
        query = query.or('deleted_by_admin.is.null,deleted_by_admin.eq.false');
      } else {
        query = query
          .or(
            `user_id.eq.${profile.id},participant1_id.eq.${profile.id},participant2_id.eq.${profile.id}`
          )
          .or('deleted_by_user.is.null,deleted_by_user.eq.false');
      }

      const { data, error } = await query.order('updated_at', {
        ascending: false,
      });

      if (error) throw error;
      let convList = (data as Conversation[]) || [];

      // Fetch profiles to resolve display names
      const participantIds = Array.from(
        new Set(
          convList
            .flatMap((c: any) => [
              c.user_id,
              c.participant1_id,
              c.participant2_id,
            ])
            .filter(Boolean)
        )
      );

      if (participantIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', participantIds);

        if (profilesData) {
          const profileMap = profilesData.reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
          }, {} as Record<string, any>);

          convList = convList.map((c: any) => {
            const otherId = [c.user_id, c.participant1_id, c.participant2_id]
              .filter(Boolean)
              .find((id) => id !== profile.id);

            const otherProfile = otherId ? profileMap[otherId] : null;

            return {
              ...c,
              displayName:
                otherProfile?.full_name ||
                otherProfile?.email ||
                c.subject ||
                'Direct Message',
            };
          });
        }
      }

      setConversations(convList);

      if (targetConvId) {
        const matchedConv = convList.find((c) => c.id === targetConvId);
        if (matchedConv) setSelectedConv(matchedConv);
      } else if (targetUserId) {
        const existingConv = convList.find(
          (c: any) =>
            c.user_id === targetUserId ||
            c.participant1_id === targetUserId ||
            c.participant2_id === targetUserId
        );
        if (existingConv) {
          setSelectedConv(existingConv);
        } else {
          setSelectedRecipientId(targetUserId);
          setShowNewModal(true);
        }
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin, targetConvId, targetUserId]);

  const loadRecipients = useCallback(async () => {
    if (!profile) return;
    try {
      let query = supabase.from('profiles').select('id, full_name, email, role');
      if (!isAdmin) {
        query = query.eq('role', 'admin');
      } else {
        query = query.neq('id', profile.id);
      }
      const { data } = await query;
      if (data) setRecipients(data as UserProfile[]);
    } catch (err) {
      console.error('Error loading recipients:', err);
    }
  }, [profile, isAdmin]);

  useEffect(() => {
    loadConversations();
    loadRecipients();
  }, [loadConversations, loadRecipients]);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as Message[]) || []);

      if (profile) {
        const unreadIds = (data || [])
          .filter((m: Message) => !m.read && m.sender_id !== profile.id)
          .map((m: Message) => m.id);

        if (unreadIds.length > 0) {
          await supabase
            .from('messages')
            .update({ read: true })
            .in('id', unreadIds);
        }
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  }, [profile]);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.id);
      const subscription = supabase
        .channel(`messages:${selectedConv.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConv.id}`,
          },
          (payload) => {
            const newMsg = payload.new as Message;
            setMessages((prev) => [...prev, newMsg]);
            if (profile && newMsg.sender_id !== profile.id) {
              supabase
                .from('messages')
                .update({ read: true })
                .eq('id', newMsg.id);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    } else {
      setMessages([]);
    }
  }, [selectedConv, loadMessages, profile]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || !profile) return;

    try {
      const { error } = await supabase.from('messages').insert([
        {
          conversation_id: selectedConv.id,
          sender_id: profile.id,
          content: newMessage.trim(),
        },
      ]);

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConv.id);

      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedRecipientId || !firstMessage.trim()) return;

    try {
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert([
          {
            user_id: profile.id,
            participant1_id: profile.id,
            participant2_id: selectedRecipientId,
            subject: newSubject.trim() || 'Direct Message',
            type: 'general',
            status: 'open',
          },
        ])
        .select()
        .single();

      if (convErr) throw convErr;

      const { error: msgErr } = await supabase.from('messages').insert([
        {
          conversation_id: conv.id,
          sender_id: profile.id,
          content: firstMessage.trim(),
        },
      ]);

      if (msgErr) throw msgErr;

      setShowNewModal(false);
      setNewSubject('');
      setFirstMessage('');
      setSelectedRecipientId('');
      if (onClearTargets) onClearTargets();

      await loadConversations();
      setSelectedConv(conv);
    } catch (err) {
      console.error('Error creating conversation:', err);
    }
  };

  const toggleSelectAll = () => {
    if (selectedConvIds.length === conversations.length) {
      setSelectedConvIds([]);
    } else {
      setSelectedConvIds(conversations.map((c) => c.id));
    }
  };

  const toggleSelectConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedConvIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedConvIds.length === 0) return;
    if (!confirm('Are you sure you want to delete the selected conversations?'))
      return;

    try {
      const fieldToUpdate = isAdmin ? 'deleted_by_admin' : 'deleted_by_user';
      const { error } = await supabase
        .from('conversations')
        .update({ [fieldToUpdate]: true })
        .in('id', selectedConvIds);

      if (error) throw error;

      if (selectedConv && selectedConvIds.includes(selectedConv.id)) {
        setSelectedConv(null);
      }
      setSelectedConvIds([]);
      loadConversations();
    } catch (err) {
      console.error('Error deleting conversations:', err);
    }
  };

  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const fieldToUpdate = isAdmin ? 'deleted_by_admin' : 'deleted_by_user';
      const { error } = await supabase
        .from('conversations')
        .update({ [fieldToUpdate]: true })
        .eq('id', id);

      if (error) throw error;

      if (selectedConv?.id === id) {
        setSelectedConv(null);
      }
      setSelectedConvIds((prev) => prev.filter((i) => i !== id));
      loadConversations();
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const filteredRecipients = recipients.filter(
    (r) =>
      r.full_name?.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      r.email?.toLowerCase().includes(recipientSearch.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col bg-paper-100 rounded-xl border border-line shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 border-b border-line bg-paper-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-bold text-ink">Messages</h1>
        </div>

        <div className="flex items-center gap-2">
          {selectedConvIds.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 text-xs font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedConvIds.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent/90 text-xs font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Message
          </button>
        </div>
      </div>

      {/* Main Inbox Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-1/3 border-r border-line bg-paper-100 flex flex-col overflow-y-auto">
          {conversations.length > 0 && (
            <div className="p-3 border-b border-line flex items-center justify-between text-xs text-ink-400 bg-paper-200/30">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 hover:text-ink transition-colors"
              >
                {selectedConvIds.length === conversations.length ? (
                  <CheckSquare className="w-4 h-4 text-accent" />
                ) : (
                  <UncheckedSquare className="w-4 h-4" />
                )}
                <span>Select All</span>
              </button>
              <span>{conversations.length} Threads</span>
            </div>
          )}

          {loading ? (
            <div className="p-4 text-center text-xs text-ink-400">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-ink-400 text-sm">
              No messages found.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {conversations.map((conv: any) => {
                const isSelected = selectedConvIds.includes(conv.id);
                const nameToDisplay =
                  conv.displayName || conv.subject || 'Direct Message';

                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    className={`w-full text-left p-4 transition-colors cursor-pointer flex items-center gap-3 ${
                      selectedConv?.id === conv.id
                        ? 'bg-paper-200'
                        : 'hover:bg-paper-200/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => toggleSelectConversation(conv.id, e)}
                      className="text-ink-400 hover:text-ink p-1"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <UncheckedSquare className="w-4 h-4" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate text-ink">
                          {nameToDisplay}
                        </span>
                        <span className="text-[10px] text-ink-300">
                          {conv.updated_at
                            ? new Date(conv.updated_at).toLocaleDateString(
                                'en-US',
                                { month: 'short', day: 'numeric' }
                              )
                            : ''}
                        </span>
                      </div>
                      <p className="text-xs text-ink-400 truncate mt-0.5">
                        {conv.subject
                          ? conv.subject
                          : conv.type === 'booking'
                          ? 'Booking thread'
                          : 'Direct message'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSingle(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 text-ink-400 p-1 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Pane */}
        <div className="flex-1 flex flex-col bg-paper-100/50">
          {selectedConv ? (
            <>
              <div className="p-4 border-b border-line bg-paper-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-ink">
                    {selectedConv.displayName || selectedConv.subject}
                  </h2>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {selectedConv.subject}
                  </p>
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg) => {
                  const isMe = msg.sender_id === profile?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isMe ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                          isMe
                            ? 'bg-accent text-white rounded-br-none'
                            : 'bg-paper-200 text-ink rounded-bl-none border border-line'
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                      <span className="text-[10px] text-ink-300 mt-1 px-1">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-line bg-paper-100 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-paper-200 text-ink text-sm rounded-lg px-4 py-2 border border-line focus:outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-ink-400 p-8 text-center">
              <MessageSquare className="w-12 h-12 stroke-1 mb-3 text-ink-300" />
              <p className="text-sm">
                Select a conversation or start a new message
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paper-100 border border-line rounded-xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => {
                setShowNewModal(false);
                if (onClearTargets) onClearTargets();
              }}
              className="absolute top-4 right-4 text-ink-400 hover:text-ink"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-ink mb-4">New Message</h2>

            <form onSubmit={handleCreateConversation} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-400 mb-1">
                  Recipient
                </label>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-ink-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-paper-200 text-ink text-xs rounded-lg border border-line focus:outline-none focus:border-accent"
                  />
                </div>
                <select
                  value={selectedRecipientId}
                  onChange={(e) => setSelectedRecipientId(e.target.value)}
                  required
                  className="w-full bg-paper-200 text-ink text-sm rounded-lg p-2.5 border border-line focus:outline-none focus:border-accent"
                >
                  <option value="">Select a user...</option>
                  {filteredRecipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name || r.email} ({r.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-400 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Enter subject..."
                  className="w-full bg-paper-200 text-ink text-sm rounded-lg p-2.5 border border-line focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-400 mb-1">
                  Message
                </label>
                <textarea
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                  rows={4}
                  required
                  placeholder="Type message here..."
                  className="w-full bg-paper-200 text-ink text-sm rounded-lg p-2.5 border border-line focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewModal(false);
                    if (onClearTargets) onClearTargets();
                  }}
                  className="px-4 py-2 text-xs text-ink-400 hover:text-ink rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedRecipientId || !firstMessage.trim()}
                  className="px-4 py-2 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
                >
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
