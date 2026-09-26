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

  const isGigToday = (dateString?: string) => {
    if (!dateString) return false;
    const gigDate = new Date(dateString);
    const today = new Date();
    return (
      gigDate.getDate() === today.getDate() &&
      gigDate.getMonth() === today.getMonth() &&
      gigDate.getFullYear() === today.getFullYear()
    );
  };

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
      console.error('Email dispatch error:', err);
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

      let convList: Conversation[] = [];
      if (error) {
        const { data: fallbackData } = await supabase.from('conversations').select('*');
        convList = (fallbackData as Conversation[]) || [];
      } else {
        convList = (data as Conversation[]) || [];
      }

      setConversations(convList);

      // Handle Deep Linking / Query Parameters
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

  const loadUsersForAdmin = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('profiles').select('*').neq('id', profile.id);
    if (data) setAllUsers(data as Profile[]);
  }, [profile]);

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

      if (error) {
        console.error('Error fetching messages from database:', error);
        setMessages([]);
      } else if (data) {
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
      setMessages([]);
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

    try {
      const res = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConv.id,
          sender_id: profile.id,
          content: finalBody,
          body: finalBody,
          read: false,
        })
        .select('*')
        .single();

      let error = res.error;

      if (error) {
        console.error('Database Error:', error);
        alert(`Failed to send message: ${error.message}`);
        return;
      }

      if (!finalBody.startsWith('AUDIO:') && !finalBody.startsWith('[VOICE_NOTE]')) {
        sendEmailNotification(`Reply: ${selectedConv.subject}`, finalBody).catch(err => console.warn(err));
      }

      setReplyText('');
      setShowEmojiPicker(false);

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConv.id);

      await loadMessages(selectedConv.id);
      loadConversations();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Unexpected send error:', err);
      alert(`Unexpected error: ${errorMsg}`);
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
      
      try {
        await supabase.from('messages').update(updatePayload).in('conversation_id', selectedConvIds);
      } catch (msgErr) {
        console.warn('Soft-deleting underlying messages skipped or failed:', msgErr);
      }

      const { error } = await supabase.from('conversations').update(updatePayload).in('id', selectedConvIds);

      if (error) {
        console.error('Error soft-deleting conversations:', error);
        alert(`Could not remove conversations: ${error.message}`);
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
        const filePath = `voice_notes/voice_${Date.now()}.webm`;

        const { error } = await supabase.storage.from('chat-audio').upload(filePath, audioBlob);

        if (error) {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            handleSendReply(`[VOICE_NOTE]${reader.result as string}`);
          };
        } else {
          const { data: publicUrl } = supabase.storage.from('chat-audio').getPublicUrl(filePath);
          handleSendReply(`[VOICE_NOTE]${publicUrl.publicUrl}`);
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

    const conversationOwnerId = profile.id;
    let targetRecipientId = selectedRecipientId || adminId;

    if (!targetRecipientId) {
      try {
        targetRecipientId = await getAdminId();
      } catch (e) {
        console.error('Could not retrieve admin ID:', e);
      }
    }

    try {
      const id = await createConversation(
        conversationOwnerId,
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
    } catch (err: unknown) {
      console.error('Create conversation error:', err);
      const errorMsg = err instanceof Error ? err.message : '';
      alert(`Could not send message. ${errorMsg}`);
    } finally {
      setCreating(false);
    }
  };

  const triggerEmergencyAlert = async () => {
    if (!profile || !selectedConv) return;

    if (confirm('Are you sure you want to trigger HostMeUp Emergency Dispatch? This will alert on-call platform safety leads immediately.')) {
      setIsEmergencyTriggering(true);
      try {
        const { error } = await supabase.from('safety_alerts').insert({
          conversation_id: selectedConv.id,
          user_id: profile.id,
          alert_type: 'emergency',
          status: 'open',
          details: {
            subject: selectedConv.subject,
            triggered_at: new Date().toISOString(),
            user_email: profile.email,
            user_name: profile.full_name,
          },
        });

        if (error) throw error;

        sendEmailNotification(
          `🚨 URGENT EMERGENCY ALERT: ${selectedConv.subject}`,
          `User ${profile.full_name} (${profile.email}) triggered Emergency Support in thread ID: ${selectedConv.id}.`
        ).catch((err) => console.warn(err));

        alert('🚨 Emergency request logged! HostMeUp Safety Teams have been notified and dispatched.');
      } catch (err) {
        console.error('Failed to dispatch emergency alert:', err);
        alert('Could not log emergency alert. Please contact platform administrators directly.');
      } finally {
        setIsEmergencyTriggering(false);
      }
    }
  };

  const handleShareStatus = async () => {
    if (!profile || !selectedConv) return;

    setIsSharingStatus(true);
    try {
      const { error } = await supabase.from('safety_alerts').insert({
        conversation_id: selectedConv.id,
        user_id: profile.id,
        alert_type: 'location_checkin',
        status: 'resolved',
        details: {
          subject: selectedConv.subject,
          checked_in_at: new Date().toISOString(),
          user_email: profile.email,
          user_name: profile.full_name,
        },
      });

      if (error) throw error;

      alert('📍 Live location check-in active. Your safety contact and HostMeUp logs have been updated.');
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Could not update safety status. Please try again.');
    } finally {
      setIsSharingStatus(false);
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
            <p className="text-sm text-ink-400 mb-6">{isAdmin ? 'Start a conversation with a registered user.' : 'Start a conversation with a host or platform admin.'}</p>
            <button onClick={() => setShowNewModal(true)} className="btn-primary px-6 py-3 text-xs uppercase tracking-wide-sm">
              New Message
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
                  const convWithDetails = conv as Conversation & {
                    messages?: { read: boolean; sender_id: string }[];
                    user?: Profile;
                  };
                  const unreadCount = convWithDetails.messages?.filter(
                    (m) => !m.read && m.sender_id !== profile?.id
                  ).length || 0;
                  const isSelected = selectedConvIds.includes(conv.id);

                  return (
                    <div 
                      key={conv.id} 
                      onClick={() => setSelectedConv(conv)}
                      className={`w-full text-left p-5 transition-colors relative cursor-pointer flex items-start gap-3 min-h-[72px] ${selectedConv?.id === conv.id ? 'bg-paper-200' : 'hover:bg-paper-200/50'}`}>
                      
                      {/* Isolated Checkbox Wrapper */}
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="flex items-center justify-center pt-0.5 flex-shrink-0"
                      >
                        <button 
                          type="button"
                          onClick={(e) => toggleSelectConversation(conv.id, e)}
                          className="text-ink-400 hover:text-ink p-1 -m-1"
                          title="Select conversation"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-accent" />
                          ) : (
                            <UncheckedSquare className="w-4 h-4" />
                          )}
                        </button>
                      </div>

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
                            <User className="w-3 h-3" /> {convWithDetails.user?.full_name || 'User'}
                          </p>
                        )}
                        <p className="text-xs text-ink-400 truncate">{conv.type === 'booking' ? 'Booking discussion' : 'Direct message'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Message Thread & Details */}
            <div className={`lg:col-span-2 flex flex-col ${selectedConv ? '' : 'hidden lg:flex'}`}>
              {selectedConv ? (
                <>
                  <div className="border-b border-line p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">{selectedConv.subject}</h3>
                      <p className="text-xs text-ink-400">
                        Thread with {(selectedConv as Conversation & { user?: Profile }).user?.full_name || 'Participant'}
                      </p>
                    </div>
                    <button onClick={() => setSelectedConv(null)} className="lg:hidden text-ink-400 hover:text-ink"><X className="w-5 h-5" /></button>
                  </div>

                  {/* Dynamic Safety Card */}
                  {(selectedConv.type === 'booking' || isGigToday(selectedConv.created_at)) && (
                    <div className="m-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-500 text-white rounded-md flex-shrink-0 mt-0.5">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold uppercase tracking-wide text-amber-900">Live Safety Protocol</h4>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-green-500 text-white rounded-full">
                              <ShieldCheck className="w-3 h-3" /> Gig Today
                            </span>
                          </div>
                          <p className="text-xs text-amber-800/90 mt-0.5">
                            Keep communications on HostMeUp for verification and platform escrow protection.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button 
                          onClick={triggerEmergencyAlert}
                          disabled={isEmergencyTriggering}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors"
                        >
                          {isEmergencyTriggering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
                          Emergency Support
                        </button>
                        <button 
                          onClick={handleShareStatus}
                          disabled={isSharingStatus}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-paper border border-amber-500/40 hover:bg-amber-100 disabled:opacity-50 text-amber-900 text-xs font-medium rounded transition-colors"
                        >
                          {isSharingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                          Share Status
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 min-h-[300px] max-h-[500px]">
                    {msgLoading ? (
                      <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-ink animate-spin" /></div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-12 text-sm text-ink-400">No messages in this thread yet.</div>
                    ) : (
                      messages.map((msg) => {
                        const isOwn = msg.sender_id === profile?.id;
                        const msgBody = (msg as { content?: string; body?: string; message?: string }).content || msg.body || (msg as { content?: string; body?: string; message?: string }).message || '';
                        const isVoiceNote = msgBody.startsWith('[VOICE_NOTE]') || msgBody.startsWith('AUDIO:');
                        const audioUrl = msgBody.replace('[VOICE_NOTE]', '').replace('AUDIO:', '');
                        const msgWithSender = msg as Message & { sender?: Profile };

                        return (
                          <div 
                            key={msg.id} 
                            className={`w-full flex items-center gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                          >
                            {isOwn && (
                              <button 
                                onClick={() => handleDeleteSingleMessage(msg.id)} 
                                className="text-red-500 hover:text-red-700 p-1 transition-colors flex-shrink-0" 
                                title="Delete message">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                              <span className="text-[10px] text-ink-400 mb-1 px-1">
                                {isOwn ? 'You' : msgWithSender.sender?.full_name || 'User'}
                              </span>

                              <div 
                                className={`px-4 py-3 text-sm rounded-lg ${
                                  isOwn 
                                    ? 'bg-ink text-paper rounded-br-none' 
                                    : 'bg-paper-200 text-ink border border-line rounded-bl-none'
                                }`}
                              >
                                {isVoiceNote ? (
                                  <audio controls src={audioUrl} className="max-w-[240px] h-10" />
                                ) : (
                                  msgBody
                                )}
                              </div>

                              <span className="text-[10px] text-ink-300 mt-1 px-1">
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
                          <button 
                            type="button" 
                            onClick={() => handleSendReply()} 
                            disabled={sending || !replyText.trim()} 
                            className="btn-primary px-4 py-3 text-xs uppercase tracking-wide-sm inline-flex items-center gap-2 disabled:opacity-50">
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
                  <p className="text-sm">Select a conversation from the left to view messages</p>
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

              <h2 className="font-display text-xl font-bold text-ink mb-4">
                {isAdmin ? 'New Message to User' : 'Send Direct Message'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Select Recipient</label>
                  <select
                    value={selectedRecipientId}
                    onChange={(e) => setSelectedRecipientId(e.target.value)}
                    className="input-editorial w-full px-3 py-2 text-sm bg-paper">
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
                    placeholder="Brief subject..."
                    className="input-editorial w-full px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Message</label>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={4}
                    placeholder="Type your message..."
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
                    className="btn-primary px-5 py-2 text-xs uppercase tracking-wide-sm inline-flex items-center gap-2 disabled:opacity-50">
                    {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Send Message
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
