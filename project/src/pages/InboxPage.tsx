import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  X,
  Search,
  CheckSquare,
  Square as UncheckedSquare,
  Mic,
  Square as StopIcon,
  Smile,
  Loader2,
  User,
  Calendar,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content?: string;
  body?: string;
  read: boolean;
  created_at: string;
  sender?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface Conversation {
  id: string;
  user_id: string;
  participant1_id?: string;
  participant2_id?: string;
  subject: string;
  type?: 'general' | 'booking' | 'inquiry';
  reference_id?: string;
  status?: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  displayName?: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    role?: string;
  };
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

interface InboxPageProps {
  targetUserId?: string | null;
  targetConvId?: string | null;
  onClearTargets?: () => void;
}

const EMOJI_LIST = ['😊', '😂', '👍', '❤️', '🔥', '🙏', '🙌', '🎉', '💡', '✨', '👋', '👀', '💯', '👏'];

export const InboxPage: React.FC<InboxPageProps> = ({
  targetUserId: propTargetUserId,
  targetConvId: propTargetConvId,
  onClearTargets,
}) => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const { recipientId } = useParams<{ recipientId?: string }>();

  // Read URL route params and search params as fallbacks if props aren't explicitly passed
  const effectiveUserId =
    propTargetUserId ||
    recipientId ||
    searchParams.get('userId') ||
    searchParams.get('targetUserId') ||
    searchParams.get('recipientId');

  const effectiveConvId = propTargetConvId || searchParams.get('convId') || searchParams.get('targetConvId');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New message modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [recipients, setRecipients] = useState<UserProfile[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [startingConv, setStartingConv] = useState(false);

  // Bulk selection state
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [deletingMsgs, setDeletingMsgs] = useState(false);

  // Emoji Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Voice Note Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load Conversations for current user
  const loadConversations = useCallback(async () => {
    if (!profile) return;
    try {
      const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .or(`user_id.eq.${profile.id},participant1_id.eq.${profile.id},participant2_id.eq.${profile.id}`)
        .or('deleted_by_user.is.null,deleted_by_user.eq.false')
        .order('updated_at', { ascending: false });

      if (convError) throw convError;

      if (!convs || convs.length === 0) {
        setConversations([]);
        if (effectiveUserId) {
          setSelectedRecipientId(effectiveUserId);
          setShowNewModal(true);
        }
        return;
      }

      const userIds = Array.from(
        new Set(
          convs
            .flatMap((c) => [c.user_id, c.participant1_id, c.participant2_id])
            .filter((id): id is string => Boolean(id))
        )
      );

      let profilesMap: Record<string, UserProfile> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, role')
          .in('id', userIds);

        if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => ({ ...acc, [p.id]: p as UserProfile }), {});
        }
      }

      const mappedConversations = convs.map((c) => {
        let otherUserId = c.user_id;

        if (c.participant1_id && c.participant1_id !== profile.id) {
          otherUserId = c.participant1_id;
        } else if (c.participant2_id && c.participant2_id !== profile.id) {
          otherUserId = c.participant2_id;
        } else if (c.user_id === profile.id && c.participant2_id) {
          otherUserId = c.participant2_id;
        }

        const resolvedUser = profilesMap[otherUserId] || profilesMap[c.user_id] || null;

        return {
          ...c,
          user: resolvedUser,
          displayName: resolvedUser?.full_name || resolvedUser?.email || c.subject || 'Direct Message',
        };
      });

      setConversations(mappedConversations as Conversation[]);

      // Check targets from route params, search params, or props
      if (effectiveConvId) {
        const matchedConv = mappedConversations.find((c) => c.id === effectiveConvId);
        if (matchedConv) setSelectedConv(matchedConv as Conversation);
      } else if (effectiveUserId) {
        const existingConv = mappedConversations.find(
          (c) =>
            c.user_id === effectiveUserId ||
            c.participant1_id === effectiveUserId ||
            c.participant2_id === effectiveUserId
        );
        if (existingConv) {
          setSelectedConv(existingConv as Conversation);
        } else {
          setSelectedRecipientId(effectiveUserId);
          setShowNewModal(true);
        }
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, effectiveConvId, effectiveUserId]);

  // Load all users on platform for recipient dropdown
  const loadRecipients = useCallback(async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .neq('id', profile.id)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setRecipients((data as UserProfile[]) || []);
    } catch (err) {
      console.error('Error loading recipients:', err);
    }
  }, [profile]);

  useEffect(() => {
    loadConversations();
    loadRecipients();
  }, [loadConversations, loadRecipients]);

  // Load Messages for active thread
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
    } finally {
      setMsgLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [profile]);

  useEffect(() => {
    if (!selectedConv) return;
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
        () => {
          loadMessages(selectedConv.id);
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [selectedConv, loadMessages, loadConversations]);

  // Voice Note Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone permission is required to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelVoiceNote = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const uploadAndSendVoiceNote = async () => {
    if (!audioBlob || !selectedConv || !profile) return;
    setUploadingAudio(true);

    try {
      const fileName = `voice_${Date.now()}.webm`;
      const filePath = `voice_notes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-audio')
        .upload(filePath, audioBlob);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('chat-audio')
        .getPublicUrl(filePath);

      const audioUrl = publicUrlData.publicUrl;

      await supabase.from('messages').insert([
        {
          conversation_id: selectedConv.id,
          sender_id: profile.id,
          recipient_id: selectedConv.user?.id || selectedConv.user_id,
          body: `[VOICE_NOTE]${audioUrl}`,
          content: `[VOICE_NOTE]${audioUrl}`,
        },
      ]);

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConv.id);

      setAudioBlob(null);
      setRecordingTime(0);
      await loadMessages(selectedConv.id);
      loadConversations();
    } catch (err: any) {
      console.error('Failed to send voice note:', err);
      alert(`Failed to send voice note: ${err.message || 'Error uploading file'}`);
    } finally {
      setUploadingAudio(false);
    }
  };

  const addEmoji = (emoji: string) => {
    setReplyText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConv || !profile) return;
    setSending(true);

    try {
      const recipientId = selectedConv.user?.id || selectedConv.user_id;

      const { error } = await supabase.from('messages').insert([
        {
          conversation_id: selectedConv.id,
          sender_id: profile.id,
          recipient_id: recipientId,
          content: replyText.trim(),
          body: replyText.trim(),
        },
      ]);

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConv.id);

      setReplyText('');
      await loadMessages(selectedConv.id);
      loadConversations();
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedRecipientId || !firstMessage.trim()) return;
    setStartingConv(true);

    try {
      const recipientProfile = recipients.find((u) => u.id === selectedRecipientId);

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
          recipient_id: selectedRecipientId,
          content: firstMessage.trim(),
          body: firstMessage.trim(),
        },
      ]);

      if (msgErr) throw msgErr;

      setShowNewModal(false);
      setNewSubject('');
      setFirstMessage('');
      setSelectedRecipientId('');
      if (onClearTargets) onClearTargets();

      await loadConversations();
      setSelectedConv({ ...conv, user: recipientProfile, displayName: recipientProfile?.full_name || recipientProfile?.email } as Conversation);
    } catch (err: any) {
      console.error('Error creating conversation:', err);
      alert(`Failed to create conversation: ${err.message || 'Unknown error'}`);
    } finally {
      setStartingConv(false);
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
    if (!confirm('Are you sure you want to delete the selected conversations?')) return;

    try {
      const { error } = await supabase
        .from('conversations')
        .update({ deleted_by_user: true })
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

  const handleDeleteMessages = async (idsToDelete: string[]) => {
    if (!idsToDelete.length) return;
    if (!confirm(`Are you sure you want to delete ${idsToDelete.length} message(s)?`)) return;

    setDeletingMsgs(true);
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
      setDeletingMsgs(false);
    }
  };

  const filteredRecipients = recipients.filter(
    (r) =>
      r.full_name?.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      r.email?.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      r.role?.toLowerCase().includes(recipientSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12">
        {/* Header Bar */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Direct Messages</p>
            <h1 className="font-display text-4xl font-bold text-ink tracking-tight">Inbox</h1>
            <p className="text-ink-400 mt-1">Chat directly with hosts, artists, and community members.</p>
          </div>

          <div className="flex items-center gap-2">
            {selectedConvIds.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide-sm bg-red-600 text-white hover:bg-red-700 transition-colors border border-red-600"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedConvIds.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide-sm bg-ink text-paper hover:bg-ink/90 transition-colors border border-ink"
            >
              <Plus className="w-4 h-4" />
              New Message
            </button>
          </div>
        </div>

        {/* Main Inbox Window */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-ink animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-line bg-paper-100">
            <div className="w-16 h-16 border border-line flex items-center justify-center text-ink-300 mb-6 bg-paper">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h3 className="font-display text-xl text-ink mb-1">No messages yet</h3>
            <p className="text-sm text-ink-400 mb-6">Start a conversation directly with any artist or event host.</p>
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="btn-primary flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-wide-sm"
            >
              <Plus className="w-4 h-4" />
              Start First Message
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border border-line min-h-[500px]">
            {/* Left Thread List */}
            <div className={`lg:col-span-1 border-r border-line ${selectedConv ? 'hidden lg:block' : ''}`}>
              <div className="p-3 border-b border-line bg-paper-100 flex items-center justify-between text-xs text-ink-400">
                <span className="font-medium text-ink-600">
                  {selectedConvIds.length > 0 ? `${selectedConvIds.length} Selected` : 'Conversations'}
                </span>
                <button type="button" onClick={toggleSelectAll} className="font-semibold text-ink hover:underline">
                  {selectedConvIds.length === conversations.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="divide-y divide-line max-h-[600px] overflow-y-auto">
                {conversations.map((conv) => {
                  const isConvSelected = selectedConvIds.includes(conv.id);

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConv(conv)}
                      className={`group relative w-full text-left p-4 cursor-pointer transition-colors flex items-start gap-3 ${
                        selectedConv?.id === conv.id ? 'bg-paper-200' : 'hover:bg-paper-200/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleSelectConversation(conv.id, e)}
                        className="mt-1 text-ink-400 hover:text-ink flex-shrink-0"
                      >
                        {isConvSelected ? (
                          <CheckSquare className="w-4 h-4 text-ink" />
                        ) : (
                          <UncheckedSquare className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            {conv.user?.avatar_url ? (
                              <img
                                src={conv.user.avatar_url}
                                alt=""
                                className="w-7 h-7 rounded-full object-cover border border-line flex-shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-ink text-paper flex items-center justify-center text-xs font-medium flex-shrink-0">
                                {conv.displayName?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                            <span className="font-medium text-ink text-sm truncate">
                              {conv.displayName}
                            </span>
                          </div>
                          <span className="text-xs text-ink-300 flex-shrink-0">
                            {conv.updated_at
                              ? new Date(conv.updated_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : ''}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-ink truncate mb-1">{conv.subject}</p>

                        <div className="flex items-center gap-2 text-xs text-ink-400">
                          {conv.type === 'booking' ? (
                            <span className="inline-flex items-center gap-1 text-accent">
                              <Calendar className="w-3 h-3" /> Booking
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-ink-400">
                              <MessageSquare className="w-3 h-3" /> Direct Message
                            </span>
                          )}
                          {conv.user?.role && <span className="capitalize">• {conv.user.role}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Chat View */}
            <div className={`lg:col-span-2 flex flex-col ${selectedConv ? '' : 'hidden lg:flex'}`}>
              {selectedConv ? (
                <>
                  <div className="border-b border-line p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display text-lg font-semibold text-ink">
                        {selectedConv.subject}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setSelectedConv(null)}
                        className="lg:hidden text-ink-400 hover:text-ink"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs text-ink-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {selectedConv.displayName}
                      </span>
                      {messages.length > 0 && selectedMsgIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessages(selectedMsgIds)}
                          disabled={deletingMsgs}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {deletingMsgs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Delete Selected ({selectedMsgIds.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[300px] max-h-[400px]">
                    {msgLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 text-ink animate-spin" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-12 text-sm text-ink-400">
                        No messages in this thread yet.
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isOwn = msg.sender_id === profile?.id;
                        const isSelected = selectedMsgIds.includes(msg.id);
                        const textContent = msg.content || msg.body || '';
                        const isVoiceNote = textContent.startsWith('[VOICE_NOTE]');
                        const voiceUrl = isVoiceNote ? textContent.replace('[VOICE_NOTE]', '') : '';

                        return (
                          <div
                            key={msg.id}
                            className={`group flex items-start gap-2 ${
                              isOwn ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedMsgIds((prev) =>
                                  prev.includes(msg.id)
                                    ? prev.filter((id) => id !== msg.id)
                                    : [...prev, msg.id]
                                )
                              }
                              className={`mt-2 text-ink-300 hover:text-ink transition-opacity ${
                                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-ink" />
                              ) : (
                                <UncheckedSquare className="w-4 h-4" />
                              )}
                            </button>

                            <div className={`max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                              {!isOwn && (
                                <span className="text-xs text-ink-400 mb-1 px-1">
                                  {msg.sender?.full_name || 'User'}
                                </span>
                              )}

                              <div className="relative group/msg">
                                <div
                                  className={`px-4 py-3 text-sm ${
                                    isOwn
                                      ? 'bg-ink text-paper'
                                      : 'bg-paper-200 text-ink border border-line'
                                  } ${isSelected ? 'ring-2 ring-ink' : ''}`}
                                >
                                  {isVoiceNote ? (
                                    <div className="flex items-center gap-2 py-1">
                                      <audio controls src={voiceUrl} className="max-w-[200px] h-8" />
                                    </div>
                                  ) : (
                                    textContent
                                  )}
                                </div>
                              </div>

                              <span className="text-xs text-ink-300 mt-1 px-1">
                                {new Date(msg.created_at).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input Controls */}
                  <div className="border-t border-line p-4 relative">
                    {showEmojiPicker && (
                      <div className="absolute bottom-16 left-4 bg-paper border border-line p-3 shadow-lg flex flex-wrap gap-2 max-w-xs z-20">
                        {EMOJI_LIST.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => addEmoji(emoji)}
                            className="text-lg p-1 hover:bg-paper-200 rounded transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {isRecording || audioBlob ? (
                      <div className="flex items-center justify-between bg-paper-200 border border-line p-3">
                        <div className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                          <span className="text-xs font-mono text-ink">
                            {isRecording
                              ? `Recording... 00:${recordingTime < 10 ? `0${recordingTime}` : recordingTime}`
                              : 'Voice Note Ready'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isRecording ? (
                            <button
                              type="button"
                              onClick={stopRecording}
                              className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              <StopIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={cancelVoiceNote}
                                className="px-3 py-1.5 text-xs border border-line text-ink hover:bg-paper-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={uploadAndSendVoiceNote}
                                disabled={uploadingAudio}
                                className="px-3 py-1.5 text-xs bg-ink text-paper hover:bg-ink/90 disabled:opacity-50 flex items-center gap-1"
                              >
                                {uploadingAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                Send Voice Note
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker((prev) => !prev)}
                          className="p-2 text-ink-400 hover:text-ink transition-colors"
                        >
                          <Smile className="w-5 h-5" />
                        </button>

                        <button
                          type="button"
                          onClick={startRecording}
                          className="p-2 text-ink-400 hover:text-ink transition-colors"
                        >
                          <Mic className="w-5 h-5" />
                        </button>

                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your reply..."
                          className="flex-1 bg-paper border border-line px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
                        />

                        <button
                          type="submit"
                          disabled={sending || !replyText.trim()}
                          className="p-2.5 bg-ink text-paper hover:bg-ink/90 disabled:opacity-50 transition-colors"
                        >
                          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                      </form>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 py-24 text-center text-ink-400">
                  <MessageSquare className="w-10 h-10 text-ink-300 mb-3" />
                  <p className="text-sm">Select a conversation from the left to view messages.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* New Message Modal */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-paper border border-line max-w-lg w-full p-6 shadow-xl relative">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="absolute top-4 right-4 text-ink-400 hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="font-display text-2xl font-bold text-ink mb-6">New Message</h2>

              <form onSubmit={handleCreateConversation} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wide-sm font-semibold text-ink-600 mb-2">
                    Select Recipient
                  </label>
                  <div className="relative mb-2">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-ink-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      className="w-full bg-paper border border-line pl-9 pr-4 py-2 text-sm text-ink focus:outline-none focus:border-ink"
                    />
                  </div>

                  <select
                    value={selectedRecipientId}
                    onChange={(e) => setSelectedRecipientId(e.target.value)}
                    required
                    className="w-full bg-paper border border-line px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
                  >
                    <option value="">Select a user...</option>
                    {filteredRecipients.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name || user.email} ({user.role || 'user'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide-sm font-semibold text-ink-600 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="Direct Message"
                    className="w-full bg-paper border border-line px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide-sm font-semibold text-ink-600 mb-2">
                    Message
                  </label>
                  <textarea
                    value={firstMessage}
                    onChange={(e) => setFirstMessage(e.target.value)}
                    placeholder="Write your message..."
                    rows={4}
                    required
                    className="w-full bg-paper border border-line p-4 text-sm text-ink focus:outline-none focus:border-ink resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide-sm border border-line text-ink hover:bg-paper-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={startingConv || !selectedRecipientId || !firstMessage.trim()}
                    className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide-sm bg-ink text-paper hover:bg-ink/90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {startingConv && <Loader2 className="w-4 h-4 animate-spin" />}
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
};
