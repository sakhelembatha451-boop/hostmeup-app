import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getAdminId, createConversation, sendMessage, markMessagesRead } from '@/lib/messaging';
import { Loader2, Send, MessageSquare, Plus, Mail, X, User, Trash2, Smile, Mic, Square, CheckSquare, Square as UncheckedSquare } from 'lucide-react';
import type { Conversation, Message, Profile } from '@/types';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xoevdgog';
const EMOJI_LIST = ['😊', '😂', '👍', '❤️', '🔥', '🎉', '🙏', '🙌', '✨', '💯', '😎', '🤝', '🎵', '🎙️', '👋', '💬'];

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

  const sendEmailNotification = async (subject: string, message: string, recipientEmail?: string) => {
    try {
      await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _replyto: recipientEmail || profile?.email || 'user@hostmeup.co.za',
          name: profile?.full_name || 'HostMeUp System',
          subject: `[HostMeUp] ${subject}`,
          message: `From: ${profile?.full_name ?? 'User'}\n\nSubject: ${subject}\n\nMessage:\n${message}`,
        }),
      });
    } catch (err) {
      console.error('Email dispatch error:', err);
    }
  };

  const loadConversations = useCallback(async () => {
    if (!profile) return;
    try {
      let query = supabase
        .from('conversations')
        .select('*, user:profiles!conversations_user_id_fkey(id, full_name, avatar_url, email), messages(id, read, sender_id)');

      if (isAdmin) {
        query = query.or('deleted_by_admin.is.null,deleted_by_admin.eq.false');
      } else {
        query = query.eq('user_id', profile.id).or('deleted_by_user.is.null,deleted_by_user.eq.false');
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
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin]);

  const loadUsersForAdmin = useCallback(async () => {
    if (!isAdmin) return;
    const { data } = await supabase.from('profiles').select('*').neq('id', profile?.id || '');
    if (data) setAllUsers(data as Profile[]);
  }, [isAdmin, profile]);

  const loadMessages = useCallback(async (convId: string) => {
    setMsgLoading(true);
    try {
      let query = supabase
        .from('messages')
        .select('*, sender:profiles(id, full_name, avatar_url, role)')
        .eq('conversation_id', convId);

      if (isAdmin) {
        query = query.or('deleted_by_admin.is.null,deleted_by_admin.eq.false');
      } else {
        query = query.or('deleted_by_user.is.null,deleted_by_user.eq.false');
      }

      const { data, error } = await query.order('created_at', { ascending: true });

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
      console.error('Error loading messages:', err);
    } finally {
      setMsgLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadConversations();
    loadUsersForAdmin();
    getAdminId().then(setAdminId).catch((err) => console.error('Error fetching admin ID:', err));
  }, [loadConversations, loadUsersForAdmin]);

  useEffect(() => {
    if (!selectedConv || !profile) return;
    loadMessages(selectedConv.id);
    markMessagesRead(selectedConv.id, profile.id).then(() => loadConversations());
  }, [selectedConv, loadMessages, profile, loadConversations]);

  useEffect(() => {
    if (!selectedConv || !profile) return;
    const channel = supabase
      .channel(`messages:${selectedConv.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConv.id}` },
        () => { 
          loadMessages(selectedConv.id);
          markMessagesRead(selectedConv.id, profile.id).then(() => loadConversations());
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConv, loadMessages, profile, loadConversations]);

  const handleSendReply = async (textToSend?: string) => {
    const finalBody = (textToSend || replyText).trim();
    if (!finalBody || !selectedConv || !profile) return;
    setSending(true);

    const recipientId = isAdmin ? selectedConv.user_id : (adminId || selectedConv.user_id);

    try {
      await sendMessage(selectedConv.id, profile.id, finalBody, recipientId);
      if (!finalBody.startsWith('AUDIO:')) {
        sendEmailNotification(`Reply: ${selectedConv.subject}`, finalBody).catch(err => console.warn(err));
      }

      setReplyText('');
      setShowEmojiPicker(false);
      await loadMessages(selectedConv.id);
      loadConversations();
    } catch (err) {
      console.error('Reply error:', err);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteSingleMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return;
    try {
      const updatePayload = isAdmin ? { deleted_by_admin: true } : { deleted_by_user: true };
      const { error } = await supabase.from('messages').update(updatePayload).eq('id', messageId);

      if (error) {
        alert('Could not hide message.');
        return;
      }
      if (selectedConv) loadMessages(selectedConv.id);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const toggleSelectConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedConvIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteConversations = async () => {
    if (selectedConvIds.length === 0) return;
    if (!confirm(`Remove ${selectedConvIds.length} conversation(s) from your view?`)) return;

    setIsBulkDeleting(true);
    try {
      const updatePayload = isAdmin ? { deleted_by_admin: true } : { deleted_by_user: true };
      
      await supabase.from('messages').update(updatePayload).in('conversation_id', selectedConvIds);
      const { error } = await supabase.from('conversations').update(updatePayload).in('id', selectedConvIds);

      if (error) {
        alert('Could not remove conversations.');
      } else {
        if (selectedConv && selectedConvIds.includes(selectedConv.id)) {
          setSelectedConv(null);
        }
        setSelectedConvIds([]);
        await loadConversations();
      }
    } catch (err) {
      console.error('Bulk delete error:', err);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const fileName = `${Date.now()}.webm`;

        const { error } = await supabase.storage.from('messages').upload(fileName, audioBlob);

        if (error) {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            handleSendReply(`AUDIO:${reader.result as string}`);
          };
        } else {
          const { data: publicUrl } = supabase.storage.from('messages').getPublicUrl(fileName);
          handleSendReply(`AUDIO:${publicUrl.publicUrl}`);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleCreateConversation = async () => {
    if (!profile || !newSubject.trim() || !newMessage.trim()) return;
    setCreating(true);

    const subject = newSubject.trim();
    const body = newMessage.trim();

    let targetRecipientId = isAdmin ? selectedRecipientId : adminId;
    if (!isAdmin && !targetRecipientId) {
      try {
        targetRecipientId = await getAdminId();
      } catch (e) {
        console.error('Could not retrieve admin ID:', e);
      }
    }

    try {
      // Always pass profile.id as the first parameter so current logged-in user owns creation
      const id = await createConversation(
        profile.id,
        subject,
        'direct',
        undefined,
        body,
        targetRecipientId || undefined
      );

      sendEmailNotification(subject, body).catch(err => console.warn('Email dispatch error:', err));

      setNewSubject('');
      setNewMessage('');
      setSelectedRecipientId('');
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
    } catch (err: any) {
      console.error('Create conversation detailed error:', err);
      alert(`Could not send message. ${err?.message || ''}`);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
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
                className="btn-primary bg-red-600 border-red-600 hover:bg-red-700 text-white inline-flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-wide-sm">
                {isBulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete ({selectedConvIds.length})
              </button>
            )}
            <button onClick={() => setShowNewModal(true)} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wide-sm">
              <Plus className="w-3.5 h-3.5" /> New Message
            </button>
          </div>
        </div>

        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 border border-line flex items-center justify-center text-ink-300 mb-6"><Mail className="w-7 h-7" /></div>
            <h3 className="font-display text-xl text-ink mb-1">No messages yet</h3>
            <p className="text-sm text-ink-400 mb-6">{isAdmin ? 'Start a conversation with a registered user.' : 'Start a conversation with the platform admin.'}</p>
            <button onClick={() => setShowNewModal(true)} className="btn-primary px-6 py-3 text-xs uppercase tracking-wide-sm">
              {isAdmin ? 'New Message' : 'Contact Admin'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border border-line min-h-[500px]">
            {/* Conversation List */}
            <div className={`lg:col-span-1 border-r border-line ${selectedConv ? 'hidden lg:block' : ''}`}>
              <div className="p-3 border-b border-line bg-paper-200/40 flex items-center justify-between text-xs text-ink-400 font-medium">
                <span>Select for bulk delete</span>
                {conversations.length > 0 && (
                  <button 
                    onClick={() => {
                      if (selectedConvIds.length === conversations.length) {
                        setSelectedConvIds([]);
                      } else {
                        setSelectedConvIds(conversations.map(c => c.id));
                      }
                    }} 
                    className="hover:text-ink underline">
                    {selectedConvIds.length === conversations.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              <div className="divide-y divide-line">
                {conversations.map((conv) => {
                  const unreadCount = (conv as any).messages?.filter(
                    (m: any) => !m.read && m.sender_id !== profile?.id
                  ).length || 0;
                  const isSelected = selectedConvIds.includes(conv.id);

                  return (
                    <div 
                      key={conv.id} 
                      onClick={() => setSelectedConv(conv)}
                      className={`w-full text-left p-5 transition-colors relative cursor-pointer flex items-start gap-3 ${selectedConv?.id === conv.id ? 'bg-paper-200' : 'hover:bg-paper-200/50'}`}>
                      <button 
                        onClick={(e) => toggleSelectConversation(conv.id, e)}
                        className="mt-0.5 text-ink-400 hover:text-ink flex-shrink-0"
                        title="Select conversation">
                        {isSelected ? <CheckSquare className="w-4 h-4 text-accent" /> : <UncheckedSquare className="w-4 h-4" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className={`text-sm truncate ${unreadCount > 0 ? 'font-bold text-ink' : 'font-medium text-ink-400'}`}>
                            {conv.subject}
                          </span>
                          <span className="text-xs text-ink-300 flex-shrink-0">
                            {conv.created_at ? new Date(conv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                          </span>
                        </div>
                        {isAdmin && (
                          <p className="text-xs text-accent font-medium mb-1 flex items-center gap-1">
                            <User className="w-3 h-3" /> {(conv as any).user?.full_name || 'User'}
                          </p>
                        )}
                        <p className="text-xs text-ink-400 truncate">{conv.type === 'booking' ? 'Booking discussion' : 'Direct message'}</p>
                      </div>
                    </div>
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
                        const isAudio = msg.body?.startsWith('AUDIO:');
                        const audioUrl = isAudio ? msg.body.replace('AUDIO:', '') : '';

                        return (
                          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group items-center gap-2`}>
                            {isOwn && (
                              <button 
                                onClick={() => handleDeleteSingleMessage(msg.id)} 
                                className="text-red-500 hover:text-red-700 p-1 transition-colors flex-shrink-0" 
                                title="Delete message">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                              <span className="text-[10px] text-ink-400 mb-0.5 px-1">
                                {isOwn ? 'You' : (msg as any).sender?.full_name || 'User'}
                              </span>

                              <div className={`px-4 py-3 text-sm ${isOwn ? 'bg-ink text-paper' : 'bg-paper-200 text-ink border border-line'}`}>
                                {isAudio ? (
                                  <audio controls src={audioUrl} className="max-w-[240px] h-10" />
                                ) : (
                                  msg.body
                                )}
                              </div>

                              <span className="text-xs text-ink-300 mt-1 px-1">
                                {msg.created_at ? new Date(msg.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Just now'}
                              </span>
                            </div>

                            {!isOwn && isAdmin && (
                              <button 
                                onClick={() => handleDeleteSingleMessage(msg.id)} 
                                className="text-red-500 hover:text-red-700 p-1 transition-colors flex-shrink-0" 
                                title="Delete message">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply Bar */}
                  <div className="border-t border-line p-4 relative">
                    {showEmojiPicker && (
                      <div className="absolute bottom-16 left-4 bg-paper border border-line p-3 shadow-lg rounded-lg grid grid-cols-8 gap-2 z-10 animate-fade-in">
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
                            placeholder="Type your reply..."
                            className="input-editorial flex-1 px-4 py-3 text-sm resize-none"
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                          />
                          <button type="button" onClick={startRecording} className="text-ink-400 hover:text-ink p-2" title="Record Voice Note">
                            <Mic className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleSendReply()} disabled={sending || !replyText.trim()}
                            className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wide-sm disabled:opacity-50 flex-shrink-0">
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send
                          </button>
                        </>
                      )}
                    </div>
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

      {/* New Message Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowNewModal(false)}>
          <div className="bg-paper border border-line max-w-md w-full p-8 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-bold text-ink">{isAdmin ? 'Start Conversation with User' : 'New Message to Admin'}</h3>
              <button onClick={() => setShowNewModal(false)} className="text-ink-400 hover:text-ink"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              {isAdmin && (
                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Select Recipient User</label>
                  <select 
                    value={selectedRecipientId} 
                    onChange={(e) => setSelectedRecipientId(e.target.value)} 
                    className="input-editorial w-full px-4 py-3 text-sm bg-paper">
                    <option value="">-- Choose User --</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Subject</label>
                <input type="text" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className="input-editorial w-full px-4 py-3 text-sm" placeholder="What's this about?" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Message</label>
                <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} rows={5} className="input-editorial w-full px-4 py-3 text-sm" placeholder="Write your message..." />
              </div>
              <button 
                onClick={handleCreateConversation} 
                disabled={creating || !newSubject.trim() || !newMessage.trim() || (isAdmin && !selectedRecipientId)}
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
