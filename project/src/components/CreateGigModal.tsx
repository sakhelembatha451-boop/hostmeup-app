// Fetch target users from profiles table instead of artist_profiles
const { data: targetUsers, error: userErr } = await supabase
  .from('profiles')
  .select('id');

if (!userErr && targetUsers && targetUsers.length > 0) {
  const uniqueUserIds = targetUsers
    .map((u) => u.id)
    .filter((id) => id && id !== profile.id);

  if (uniqueUserIds.length > 0) {
    const notificationsToInsert = uniqueUserIds.map((targetId) => ({
      user_id: targetId,
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
}
