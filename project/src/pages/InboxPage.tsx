const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xoevdgog';

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

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConv || !profile) return;
    setSending(true);
    try {
      const messageBody = replyText.trim();
      await sendMessage(selectedConv.id, profile.id, messageBody, adminId ?? undefined);
      
      // Dispatch email notification to Formspree
      sendEmailNotification(`Reply: ${selectedConv.subject}`, messageBody);

      setReplyText('');
      await loadMessages(selectedConv.id);
      loadConversations();
    } catch (err) {
      console.error('Error sending reply:', err);
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!profile || !newSubject.trim() || !newMessage.trim()) return;
    setCreating(true);

    try {
      const id = await createConversation(profile.id, newSubject.trim(), 'direct', undefined, newMessage.trim(), adminId);
      
      if (!id) {
        alert('Failed to save message to database. Check console for details.');
        return;
      }

      // Dispatch email notification to Formspree
      sendEmailNotification(newSubject.trim(), newMessage.trim());

      setNewSubject('');
      setNewMessage('');
      await loadConversations();

      const { data: newConv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (newConv) setSelectedConv(newConv as Conversation);
      setShowNewModal(false);
    } catch (err) {
      console.error('Error in handleCreateConversation:', err);
      alert('An unexpected error occurred while sending.');
    } finally {
      setCreating(false);
    }
  };
