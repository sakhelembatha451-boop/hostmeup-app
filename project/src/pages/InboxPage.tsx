import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getAdminId, createConversation, markMessagesRead } from '@/lib/messaging';
import { 
  Loader2, Send, MessageSquare, Plus, Mail, X, User, Trash2, Smile, Mic, Square, CheckSquare, Square as UncheckedSquare,
  ShieldAlert, PhoneCall, ShieldCheck, MapPin
} from 'lucide-react';
import type { Conversation, Message, Profile } from '@/types';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xoevdgog';
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

  // Safety Action Loading States
  const [isEmergencyTriggering, setIsEmergencyTriggering] = useState(false);
  const [isSharingStatus, setIsSharingStatus] = useState(false);

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
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _replyto: recipientEmail || profile?.email || 'user@hostmeup.co.za',
          name: profile?.full_name || 'HostMeUp System',
          subject: `[HostMeUp] ${subject}`,
          message: `From: ${profile?.full_name ?? 'User'}\n\nSubject: ${subject}\n\nMessage:\n${message}`,
        }),
      });
    } catch (err) {
      console.error('Email notification failed:', err);
    }
  };

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
        const matched = convList.find((c) => c.id === targetConvId);
        if (matched) setSelectedConv(matched);
      } else if (targetUserId) {
        const existing = convList.find(
          (c: any) =>
            c.user_id === targetUserId ||
            c.participant1_id === targetUserId ||
            c.participant2_id === targetUserId
        );
        if (existing) {
          setSelectedConv(existing);
        } else {
          setSelectedRecipientId(targetUserId);
          setShowNewModal(true);
        }
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin, targetConvId, targetUserId]);

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

        const formatted = data.map((msg) => ({
          ...msg,
          body: msg.body || msg.content || '',
          content: msg.content || msg.body || '',
          sender: profileMap[msg.sender_id] || undefined,
        }));

        setMessages(formatted as Message[]);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setMsgLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadConversations();
    getAdminId().then(setAdminId).catch(console.error);
  }, [loadConversations]);

  useEffect(() => {
    if (!profile) return;
    supabase.from('profiles').select('*').neq('id', profile.id).then(({ data }) => {
      if (data) setAllUsers(data as Profile[]);
    });
  }, [profile]);

  useEffect(() => {
    if (!selectedConv || !profile) return;
    loadMessages(selectedConv.id);
    markMessagesRead(selectedConv.id, profile.id);

    const channel = supabase
      .channel(`chat_room:${selectedConv.id}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConv.id}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, body: newMsg.body || newMsg.content || '' }];
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv, profile, loadMessages]);

  const handleSendReply = async (textToSend?: string) => {
    const finalBody = (textToSend || replyText).trim();
    if (!finalBody || !selectedConv || !profile || sending) return;

    setSending(true);

    // Optimistic UI state insertion
    const tempId = `temp-${Date.now()}`;
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

      // Replace optimistic message with actual DB record
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...data, sender: profile } : m)));

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConv.id);

      sendEmailNotification(`New Reply in ${selectedConv.subject}`, finalBody).catch(console.warn);
    } catch (err: any) {
      console.error('Send message error:', err);
      alert(`Message delivery failed: ${err.message || 'Network error'}`);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const triggerEmergencyAlert = async () => {
    if (!profile || !selectedConv) return;
    if (!confirm('Dispatch platform Emergency Alert?')) return;

    setIsEmergencyTriggering(true);
    try {
      const { error } = await supabase.from('safety_alerts').insert([{
        conversation_id: selectedConv.id,
        user_id: profile.id,
        alert_type: 'emergency',
        status: 'open',
        details: {
          subject: selectedConv.subject,
          triggered_at: new Date().toISOString(),
          user_email: profile.email,
        }
      }]);

      if (error) throw error;
      alert('🚨 Emergency Support dispatched to Admin Safety Console!');
    } catch (err: any) {
      alert(`Safety alert error: ${err.message}`);
    } finally {
      setIsEmergencyTriggering(false);
    }
  };

  const handleShareStatus = async () => {
    if (!profile || !selectedConv) return;

    setIsSharingStatus(true);
    try {
      const { error } = await supabase.from('safety_alerts').insert([{
        conversation_id: selectedConv.id,
        user_id: profile.id,
        alert_type: 'location_checkin',
        status: 'open',
        details: {
          subject: selectedConv.subject,
          checked_in_at: new Date().toISOString(),
          user_email: profile.email,
        }
      }]);

      if (error) throw error;
      alert('📍 Live location status shared!');
    } catch (err: any) {
      alert(`Status update error: ${err.message}`);
    } finally {
      setIsSharingStatus(false);
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
        const filePath = `voice_notes/voice_${Date.now()}.webm`;

        const { error } = await supabase.storage.from('chat-audio').upload(filePath, audioBlob);
        if (!error) {
          const { data } = supabase.storage.from('chat-audio').getPublicUrl(filePath);
          handleSendReply(`[VOICE_NOTE]${data.publicUrl}`);
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

  const handleCreateConversation = async () => {
    if (!profile || !newSubject.trim() || !newMessage.trim()) return;
    setCreating(true);
    try {
      const targetId = selectedRecipientId || adminId;
      const id = await createConversation(profile.id, newSubject.trim(), 'direct', undefined, newMessage.trim(), targetId || undefined);
      setShowNewModal(false);
      setNewSubject('');
      setNewMessage('');
      await loadConversations();
      if (id) {
        const { data } = await supabase.from('conversations').select('*').eq('id', id).single();
        if (data) setSelectedConv(data as Conversation);
      }
    } catch (err: any) {
      alert(`Creation failed: ${err.message}`);
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
          <button onClick={() => setShowNewModal(true)} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wide-sm">
            <Plus className="w-3.5 h-3.5" /> New Message
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border border-line min-h-[500px]">
          {/* Conversation List */}
          <div className={`lg:col-span-1 border-r border-line ${selectedConv ? 'hidden lg:block' : ''}`}>
            <div className="divide-y divide-line">
              {conversations.map((conv) => (
                <div 
                  key={conv.id} 
                  onClick={() => setSelectedConv(conv)}
                  className={`p-5 cursor-pointer transition-colors ${selectedConv?.id === conv.id ? 'bg-paper-200' : 'hover:bg-paper-200/50'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold truncate text-ink">{conv.subject}</span>
                  </div>
                  <p className="text-xs text-ink-400 truncate">{conv.type === 'booking' ? 'Booking' : 'Direct'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Messages Panel */}
          <div className={`lg:col-span-2 flex flex-col ${selectedConv ? '' : 'hidden lg:flex'}`}>
            {selectedConv ? (
              <>
                <div className="border-b border-line p-5 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold text-ink">{selectedConv.subject}</h3>
                  <button onClick={() => setSelectedConv(null)} className="lg:hidden text-ink-400"><X className="w-5 h-5" /></button>
                </div>

                {/* Safety Actions Bar */}
                <div className="m-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                    <span className="text-xs font-semibold text-amber-900">Safety Protocol Active</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={triggerEmergencyAlert} disabled={isEmergencyTriggering} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded flex items-center gap-1">
                      {isEmergencyTriggering ? <Loader2 className="w-3 h-3 animate-spin" /> : <PhoneCall className="w-3 h-3" />} Support
                    </button>
                    <button onClick={handleShareStatus} disabled={isSharingStatus} className="px-3 py-1.5 bg-paper border border-amber-500/40 text-amber-900 text-xs font-semibold rounded flex items-center gap-1">
                      {isSharingStatus ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />} Check-In
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 max-h-[450px]">
                  {msgLoading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-ink animate-spin" /></div>
                  ) : (
                    messages.map((msg) => {
                      const isOwn = msg.sender_id === profile?.id;
                      const msgBody = msg.content || msg.body || '';
                      const isVoiceNote = msgBody.startsWith('[VOICE_NOTE]');
                      const audioUrl = msgBody.replace('[VOICE_NOTE]', '');

                      return (
                        <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                          <div className={`px-4 py-3 text-sm rounded-lg max-w-[75%] ${isOwn ? 'bg-ink text-paper' : 'bg-paper-200 text-ink'}`}>
                            {isVoiceNote ? <audio controls src={audioUrl} className="max-w-[200px]" /> : msgBody}
                          </div>
                          <span className="text-[10px] text-ink-300 mt-1">{new Date(msg.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-line p-4 flex items-center gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={1}
                    placeholder="Type your message..."
                    className="input-editorial flex-1 px-4 py-3 text-sm resize-none"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  />
                  <button type="button" onClick={startRecording} className="text-ink-400 hover:text-ink p-2">
                    <Mic className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={() => handleSendReply()} disabled={sending || !replyText.trim()} className="btn-primary px-4 py-3 text-xs uppercase">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-ink-400 text-sm">Select a conversation to start messaging.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
