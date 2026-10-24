// 2. Broadcast Notification to Talent Providers
// Query talent profiles (excluding the logged-in host)
const { data: talentProfiles, error: talentErr } = await supabase
  .from('profiles')
  .select('id, role')
  .neq('id', profile.id)
  .eq('role', 'artist'); // Or .neq('role', 'host') if you want all non-hosts notified

if (!talentErr && talentProfiles && talentProfiles.length > 0) {
  const notificationsToInsert = talentProfiles.map((talent) => ({
    user_id: talent.id,
    title: `New Gig Posted: ${title} 🎵`,
    message: `A new ${category} opportunity was posted for R${Number(budget).toLocaleString()} in ${location}.`,
    type: 'gig_alert',
    is_read: false,
    read: false,
  }));

  const { error: notifErr } = await supabase
    .from('notifications')
    .insert(notificationsToInsert);

  if (notifErr) {
    console.error('Error inserting broadcast notifications:', notifErr);
  }
}
