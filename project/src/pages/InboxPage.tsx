import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Send, Loader2 } from 'lucide-react';

export default function InboxPage() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Conversations
  useEffect(() => {
    if (!profile) return;
    const fetchConvs = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });
      if (data) setConversations(data);
    };
    fetchConvs();
  }, [profile]);

  // 2. Fetch Messages and Subscribe to Realtime Updates
  useEffect(() => {
    if (!selectedConv) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedConv.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    fetchMessages();

    // Listen for new incoming messages without re-rendering the whole page
    const channel = supabase
      .channel(`room:${selectedConv.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConv.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv]);

  // 3. Direct Send Handler
  const handleSend = async () => {
    if (!text.trim() || !selectedConv || !profile || sending) return;

    const content = text.trim();
    setText('');
    setSending(true);

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConv.id,
        sender_id: profile.id,
        content: content,
        body: content,
        read: false,
      });

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConv.id);
    } catch (err: any) {
      alert(`Failed to send message: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Inbox</h1>
      <div className="grid grid-cols-3 gap-4 border h-[500px]">
        {/* Left: Thread List */}
        <div className="border-r overflow-y-auto">
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedConv(c)}
              className={`p-3 cursor-pointer hover:bg-gray-100 ${selectedConv?.id === c.id ? 'bg-gray-200' : ''}`}
            >
              <p className="font-semibold text-sm">{c.subject || 'Conversation'}</p>
            </div>
          ))}
        </div>

        {/* Right: Message Window */}
        <div className="col-span-2 flex flex-col justify-between">
          {selectedConv ? (
            <>
              <div className="p-4 overflow-y-auto flex-1 space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded text-sm max-w-[70%] ${
                      m.sender_id === profile?.id ? 'ml-auto bg-black text-white' : 'bg-gray-200 text-black'
                    }`}
                  >
                    {m.content || m.body}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="p-3 border-t flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 border p-2 text-sm rounded"
                />
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="bg-black text-white px-4 py-2 rounded text-xs flex items-center gap-1"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          ) : (
            <div className="p-4 text-gray-500 text-sm">Select a thread to view messages.</div>
          )}
        </div>
      </div>
    </div>
  );
}
