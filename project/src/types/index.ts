export type UserRole = 'artist' | 'host';

export type BookingStatus = 'pending' | 'confirmed' | 'accepted' | 'declined' | 'cancelled';

export type TalentCategory =
  | 'singer_vocalist'
  | 'producer_engineer'
  | 'performer_dj'
  | 'beauty_professional'
  | 'model'
  | 'photographer_videographer';

export type MediaType = 'photo' | 'audio' | 'video';

export interface MediaItem {
  id: string;
  artist_profile_id: string;
  media_type: MediaType;
  url: string;
  title: string;
  display_order: number;
  created_at: string;
}

export const TALENT_CATEGORIES: { value: TalentCategory; label: string; shortLabel: string; icon: string }[] = [
  { value: 'singer_vocalist', label: 'Singer / Vocalist', shortLabel: 'Vocalist', icon: 'Mic2' },
  { value: 'producer_engineer', label: 'Producer / Sound Engineer', shortLabel: 'Producer', icon: 'Sliders' },
  { value: 'performer_dj', label: 'Live Performer / DJ', shortLabel: 'Performer / DJ', icon: 'Disc' },
  { value: 'beauty_professional', label: 'Beauty Professional (MUA, Hair, Wardrobe)', shortLabel: 'Beauty', icon: 'Palette' },
  { value: 'model', label: 'Model', shortLabel: 'Model', icon: 'Camera' },
  { value: 'photographer_videographer', label: 'Photographer / Videographer', shortLabel: 'Photographer', icon: 'Aperture' },
];

export const CATEGORY_MEDIA_HINTS: Record<TalentCategory, { photos: boolean; audio: boolean; video: boolean; hint: string }> = {
  singer_vocalist: { photos: true, audio: true, video: true, hint: 'Showcase your vocal range with audio tracks, performance photos, and video reels.' },
  producer_engineer: { photos: false, audio: true, video: true, hint: 'Upload your best produced tracks, beats, and studio session videos.' },
  performer_dj: { photos: true, audio: false, video: true, hint: 'Share video reels of your live sets and performance photos.' },
  beauty_professional: { photos: true, audio: false, video: false, hint: 'Build a portfolio gallery showcasing your makeup, hair, and wardrobe work.' },
  model: { photos: true, audio: false, video: true, hint: 'Create a photo portfolio with your best shots and a showreel video.' },
  photographer_videographer: { photos: true, audio: false, video: true, hint: 'Display your photography portfolio and video reel of your best work.' },
};

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  avatar_url: string | null;
  bio: string;
  location: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArtistProfile {
  id: string;
  user_id: string;
  talent_category: TalentCategory;
  stage_name: string;
  performance_roles: string[];
  genres: string[];
  base_rate: number | null;
  rate_unit: string;
  spotify_url: string | null;
  instagram_url: string | null;
  soundcloud_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  media_urls: string[];
  created_at: string;
  updated_at: string;
  media_items?: MediaItem[];
}

export interface ArtistWithProfile extends Profile {
  artist_profile: ArtistProfile & { media_items?: MediaItem[] } | null;
}

export interface Booking {
  id: string;
  artist_id: string;
  host_id: string;
  event_name: string;
  event_date: string;
  start_time: string | null;
  gig_duration: string;
  equipment_needed: string[];
  location: string;
  notes: string;
  total_amount: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  artist?: Profile;
  host?: Profile;
}

export type ConversationType = 'direct' | 'booking';

export interface Conversation {
  id: string;
  user_id: string;
  booking_id: string | null;
  subject: string;
  type: ConversationType;
  created_at: string;
  updated_at: string;
  // Joined fields
  user?: Profile;
  booking?: Booking;
  messages?: Message[];
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  // Joined fields
  sender?: Profile;
}

export type NotificationType = 'message' | 'booking';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  conversation_id: string | null;
  booking_id: string | null;
  read: boolean;
  created_at: string;
}
