import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ArtistProfile, ServiceItem } from '@/types';

export function useArtistProfile(artistId?: string) {
  const [artist, setArtist] = useState<ArtistProfile | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArtist = useCallback(async () => {
    if (!artistId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch artist profile matching either profile ID or user_id
      const { data, error: fetchError } = await supabase
        .from('artist_profiles')
        .select('*')
        .or(`id.eq.${artistId},user_id.eq.${artistId}`)
        .single();

      if (fetchError) throw fetchError;

      let mergedArtist = { ...data };
      const targetUserId = data.user_id || data.id;

      // Merge host pricing if available
      if (targetUserId) {
        const { data: hostData } = await supabase
          .from('host_profiles')
          .select('hourly_rate, rate_unit, custom_rate_display, pricing_type')
          .or(`user_id.eq.${targetUserId},id.eq.${targetUserId}`)
          .maybeSingle();

        if (hostData) {
          mergedArtist = {
            ...mergedArtist,
            hourly_rate: hostData.hourly_rate ?? mergedArtist.hourly_rate,
            rate_unit: hostData.rate_unit || mergedArtist.rate_unit,
            custom_rate_display: hostData.custom_rate_display || mergedArtist.custom_rate_display,
          };
        }
      }

      setArtist(mergedArtist);

      // Fetch talent services menu
      const { data: serviceData } = await supabase
        .from('talent_services')
        .select('*')
        .eq('profile_id', targetUserId);

      setServices(serviceData || []);
    } catch (err: any) {
      console.error('Error fetching artist profile:', err);
      setError(err.message || 'Could not load artist profile.');
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => {
    fetchArtist();
  }, [fetchArtist]);

  return { artist, services, loading, error, refreshArtist: fetchArtist };
}
