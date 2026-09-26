import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getAdminId, createConversation, markMessagesRead } from '@/lib/messaging';
import { 
  Loader2, Send, MessageSquare, Plus, Mail, X, User, Trash2, Smile, Mic, Square, CheckSquare, Square as UncheckedSquare
} from 'lucide-react';
import type { Conversation, Message, Profile } from '@/types';

const EMOJI_LIST = ['😊', '😂', '👍', '❤️', '🔥', '🎉', '🙏', '🙌', '✨', '💯', '😎', '🤝', '🎵', '🎙️', '👋', '💬'];

export default function InboxPage() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const targetUserId = searchParams.get('user') || (location.state as any)?.recipientId;
  const targetConvId = searchParams.get('conversation') || (location.state as any)?.conversationId;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);

  // New Conversation Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [creating, setCreating] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Bulk Selection State
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = profile?.role === 'admin' || profile?.email === 'sakhelembatha451@gmail.com';

  // 1. Load Conversations
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
          .or(`user_id.eq.${profile.id},participant1_id.eq.${profile.id},participant2_id.eq.${profile.id}`)
          .or('deleted_by_user.is.null,deleted_by_user.eq.false');
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;
      const convList = (data as Conversation[]) || [];
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

  // 2. Load Platform Users for New Chat
  const loadUsers = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('profiles').select('*').neq('id', profile.id);
    if (data) setAllUsers(data as Profile[]);
  }, [profile]);

  // 3. Load Thread Messages with Sender Info
  const loadMessages = useCallback(async (convId: string) => {
    setMsgLoading(true);
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId);

      if (isAdmin) {
        query = query.or('deleted_by_admin.is.null,deleted_by_admin.eq.false');
      } else {
        query = query.or('deleted_by_user.is.null,deleted_by_user.eq.false');
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        const senderIds = Array.from(new Set(data.map((m) => m.sender_id).filter(Boolean)));
        let profileMap: Record<string, Profile> = {};

        if (senderIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role')
            .in('id', senderIds);

          if (profilesData) {
            profileMap = profilesData.reduce((acc, p) => {
              acc[p.id] = p as Profile;
              return acc;
            }, {} as Record<string, Profile>);
          }
        }

        const formattedMessages = data.map((msg) => ({
          ...msg,
          body: msg.body || msg.content || '',
          content: msg.content || msg.body || '',
          sender: profileMap[msg.sender_id] || undefined,
        }));

        setMessages(formattedMessages as Message[]);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setMsgLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadConversations();
    loadUsers();
    getAdminId().then(setAdminId).catch(console.error);
  }, [loadConversations, loadUsers]);

  useEffect(() => {
    if (!selectedConv || !profile) return;
    loadMessages(selectedConv.id);
    markMessagesRead(selectedConv.id, profile.id);

    const channel = supabase
      .channel(`chat:${selectedConv.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConv.id}` },
        () => loadMessages(selectedConv.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv, profile, loadMessages]);

  // Send Message / Reply
  const handleSendReply = async (textToSend?: string) => {
    const finalBody = (textToSend || replyText).trim();
    if (!finalBody || !selectedConv || !profile || sending) return;

    setSending(true);
    const tempId = `temp-${Date.now()}`;
    
    // Optimistic UI Append
    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: selectedConv.id,
      sender_id: profile.id,
      content: finalBody,
      body: finalBody,
      read: false,
      created_at: new Date().toISOString(),
      sender: profile,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setReplyText('');
    setShowEmojiPicker(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConv.id,
          sender_id: profile.id,
          content: finalBody,
          body: finalBody,
          read: false,
        })
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...data, sender: profile } : m)));

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConv.id);
    } catch (err: any) {
      console.error('Send message error:', err);
      alert(`Message delivery failed: ${err.message || 'Network error'}`);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // Delete Single Message
  const handleDeleteSingleMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return;
    try {
      const updatePayload = isAdmin ? { deleted_by_admin: true } : { deleted_by_user: true };
      const { error } = await supabase.from('messages').update(updatePayload).eq('id', messageId);

      if (error) throw error;
      if (selectedConv) loadMessages(selectedConv.id);
    } catch (err: any) {
      alert(`Could not delete message: ${err.message}`);
    }
  };

  // Toggle Selection for Sidebar
  const toggleSelectConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedConvIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk Delete Selected Conversations
  const handleBulkDeleteConversations = async () => {
    if (selectedConvIds.length === 0) return;
    if (!confirm(`Remove ${selectedConvIds.length} conversation(s)?`)) return;

    setIsBulkDeleting(true);
    try {
      const updatePayload = isAdmin ? { deleted_by_admin: true } : { deleted_by_user: true };
      await supabase.from('conversations').update(updatePayload).in('id', selectedConvIds);

      if (selectedConv && selectedConvIds.includes(selectedConv.id)) {
        setSelectedConv(null);
      }
      setSelectedConvIds([]);
      await loadConversations();
    } catch (err: any) {
      alert(`Error deleting conversations: ${err.message}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Voice Note Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const filePath = `voice_notes/voice_${Date.now()}.webm`;

        const { error } = await supabase.storage.from('chat-audio').upload(filePath, audioBlob);
        if (!error) {
          const { data } = supabase.storage.from('chat-audio').getPublicUrl(filePath);
          handleSendReply(`[VOICE_NOTE]${data.publicUrl}`);
        } else {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => handleSendReply(`[VOICE_NOTE]${reader.result as string}`);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } catch {
      alert('Microphone access is required.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Create New Conversation
  const handleCreateConversation = async () => {
    if (!profile || !newSubject.trim() || !newMessage.trim()) return;
    setCreating(true);

    try {
      const targetRecipientId = selectedRecipientId || adminId;
      const id = await createConversation(
        profile.id,
        newSubject.trim(),
        'direct',
        undefined,
        newMessage.trim(),
        targetRecipientId || undefined
      );

      setNewSubject('');
      setNewMessage('');
      setSelectedRecipientId('');
      setShowNewModal(false);

      await loadConversations();
      if (id) {
        const { data } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
        if (data) setSelectedConv(data as Conversation);
      }
    } catch (err: any) {
      alert(`Could not create conversation: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-2">— {isAdmin ? 'Admin Console' : 'Inbox'}</p>
            <h1 className="font-display text-4xl font-bold text-ink tracking-tight">Messages</h1>
          </div>
          <div className="flex items-center gap-3">
            {selectedConvIds.length > 0 && (
              <button
                onClick={handleBulkDeleteConversations}
                disabled={isBulkDeleting}
                className="btn-primary bg-red-600 border-red-600 hover:bg-red-700 text-white inline-flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-wide-sm"
              >
                {isBulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete ({selectedConvIds.length})
              </button>
            )}
            <button onClick={() => setShowNewModal(true)} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wide-sm">
              <Plus className="w-3.5 h-3.5" /> New Message
            </button>
          </div>
        </div>

        {/* Main Interface Layout */}
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-line">
            <div className="w-16 h-16 border border-line flex items-center justify-center text-ink-300 mb-6"><Mail className="w-7 h-7" /></div>
            <h3 className="font-display text-xl text-ink mb-1">No messages yet</h3>
            <p className="text-sm text-ink-400 mb-6">Start a conversation with a registered user or platform admin.</p>
            <button onClick={() => setShowNewModal(true)} className="btn-primary px-6 py-3 text-xs uppercase tracking-wide-sm">
              Start Conversation
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border border-line min-h-[520px]">
            {/* Left Sidebar (Conversations List) */}
            <div className={`lg:col-span-1 border-r border-line ${selectedConv ? 'hidden lg:block' : ''}`}>
              <div className="p-3 border-b border-line bg-paper-200/40 flex items-center justify-between text-xs text-ink-400 font-medium">
                <span>Select to delete</span>
                <button
                  onClick={() => {
                    if (selectedConvIds.length === conversations.length) {
                      setSelectedConvIds([]);
                    } else {
                      setSelectedConvIds(conversations.map((c) => c.id));
                    }
                  }}
                  className="hover:text-ink underline"
                >
                  {selectedConvIds.length === conversations.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="divide-y divide-line">
                {conversations.map((conv) => {
                  const isSelected = selectedConvIds.includes(conv.id);

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConv(conv)}
                      className={`w-full text-left p-4 transition-colors cursor-pointer flex items-center gap-3 ${
                        selectedConv?.id === conv.id ? 'bg-paper-200' : 'hover:bg-paper-200/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleSelectConversation(conv.id, e)}
                        className="text-ink-400 hover:text-ink p-1"
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4 text-accent" /> : <UncheckedSquare className="w-4 h-4" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold truncate text-ink">{conv.subject}</span>
                          <span className="text-[10px] text-ink-300">
                            {conv.updated_at ? new Date(conv.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-ink-400 truncate mt-0.5">{conv.type === 'booking' ? 'Booking thread' : 'Direct message'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Chat Panel */}
            <div className={`lg:col-span-2 flex flex-col ${selectedConv ? '' : 'hidden lg:flex'}`}>
              {selectedConv ? (
                <>
                  <div className="border-b border-line p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-semibold text-ink">{selectedConv.subject}</h3>
                      <p className="text-xs text-ink-400">Thread ID: {selectedConv.id.slice(0, 8)}</p>
                    </div>
                    <button onClick={() => setSelectedConv(null)} className="lg:hidden text-ink-400"><X className="w-5 h-5" /></button>
                  </div>

                  {/* Messages Scroll Area */}
                  <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 max-h-[460px]">
                    {msgLoading ? (
                      <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-ink animate-spin" /></div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-12 text-sm text-ink-400">No messages in this thread yet.</div>
                    ) : (
                      messages.map((msg) => {
                        const isOwn = msg.sender_id === profile?.id;
                        const msgBody = msg.content || msg.body || '';
                        const isVoiceNote = msgBody.startsWith('[VOICE_NOTE]');
                        const audioUrl = msgBody.replace('[VOICE_NOTE]', '');
                        const senderName = isOwn ? 'You' : msg.sender?.full_name || 'User';

                        return (
                          <div key={msg.id} className={`flex items-start gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            {isOwn && (
                              <button onClick={() => handleDeleteSingleMessage(msg.id)} className="text-red-500 hover:text-red-700 p-1" title="Delete message">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                              <span className="text-[11px] font-semibold text-ink-400 mb-1 px-1">{senderName}</span>
                              <div className={`px-4 py-2.5 text-sm rounded-lg ${isOwn ? 'bg-ink text-paper rounded-br-none' : 'bg-paper-200 text-ink rounded-bl-none border border-line'}`}>
                                {isVoiceNote ? <audio controls src={audioUrl} className="max-w-[220px] h-10" /> : msgBody}
                              </div>
                              <span className="text-[9px] text-ink-300 mt-1 px-1">
                                {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>

                            {!isOwn && (
                              <button onClick={() => handleDeleteSingleMessage(msg.id)} className="text-red-500 hover:text-red-700 p-1" title="Delete message">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Bar */}
                  <div className="border-t border-line p-4 relative">
                    {showEmojiPicker && (
                      <div className="absolute bottom-16 left-4 bg-paper border border-line p-3 shadow-lg rounded-lg grid grid-cols-8 gap-2 z-10">
                        {EMOJI_LIST.map((emoji) => (
                          <button key={emoji} onClick={() => setReplyText((prev) => prev + emoji)} className="text-xl hover:scale-125 transition-transform p-1">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-ink-400 hover:text-ink p-2">
                        <Smile className="w-5 h-5" />
                      </button>

                      {isRecording ? (
                        <div className="flex-1 flex items-center justify-between bg-red-500/10 border border-red-500 text-red-600 px-4 py-2 rounded">
                          <span className="text-xs font-medium animate-pulse flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-600" /> Recording Voice Note ({recordingTime}s)
                          </span>
                          <button onClick={stopRecording} className="btn-primary bg-red-600 border-red-600 text-white px-3 py-1 text-xs flex items-center gap-1">
                            <Square className="w-3 h-3 fill-current" /> Stop & Send
                          </button>
                        </div>
                      ) : (
                        <>
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={1}
                            placeholder="Type a message..."
                            className="input-editorial flex-1 px-4 py-3 text-sm resize-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendReply();
                              }
                            }}
                          />
                          <button type="button" onClick={startRecording} className="text-ink-400 hover:text-ink p-2" title="Record Voice Note">
                            <Mic className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendReply()}
                            disabled={sending || !replyText.trim()}
                            className="btn-primary px-4 py-3 text-xs uppercase tracking-wide-sm inline-flex items-center gap-2 disabled:opacity-50"
                          >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-ink-400">
                  <MessageSquare className="w-12 h-12 stroke-[1.5] mb-3 text-ink-300" />
                  <p className="text-sm">Select a thread from the left to view messages</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* New Conversation Modal */}
        {showNewModal && (
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-paper border border-line p-6 max-w-lg w-full shadow-2xl relative">
              <button onClick={() => setShowNewModal(false)} className="absolute top-4 right-4 text-ink-400 hover:text-ink">
                <X className="w-5 h-5" />
              </button>

              <h2 className="font-display text-xl font-bold text-ink mb-4">Start New Chat</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Select User</label>
                  <select
                    value={selectedRecipientId}
                    onChange={(e) => setSelectedRecipientId(e.target.value)}
                    className="input-editorial w-full px-3 py-2 text-sm bg-paper"
                  >
                    <option value="">-- Contact Admin --</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email} ({u.role || 'user'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Subject</label>
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="Subject title..."
                    className="input-editorial w-full px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Message</label>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={4}
                    placeholder="Write your initial message..."
                    className="input-editorial w-full px-3 py-2 text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowNewModal(false)} className="px-4 py-2 text-xs uppercase tracking-wide-sm text-ink-400 hover:text-ink">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateConversation}
                    disabled={creating || !newSubject.trim() || !newMessage.trim()}
                    className="btn-primary px-5 py-2 text-xs uppercase tracking-wide-sm inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Start Chat
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
