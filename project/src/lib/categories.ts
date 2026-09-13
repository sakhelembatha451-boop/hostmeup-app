import {
  Mic2, Sliders, Disc, Palette, Camera, Aperture,
  type LucideIcon,
} from 'lucide-react';
import type { TalentCategory, MediaType } from '@/types';

export const CATEGORY_ICONS: Record<TalentCategory, LucideIcon> = {
  singer_vocalist: Mic2,
  producer_engineer: Sliders,
  performer_dj: Disc,
  beauty_professional: Palette,
  model: Camera,
  photographer_videographer: Aperture,
};

export const CATEGORY_LABELS: Record<TalentCategory, string> = {
  singer_vocalist: 'Singer / Vocalist',
  producer_engineer: 'Producer / Sound Engineer',
  performer_dj: 'Live Performer / DJ',
  beauty_professional: 'Beauty Professional',
  model: 'Model',
  photographer_videographer: 'Photographer / Videographer',
};

export const CATEGORY_SHORT_LABELS: Record<TalentCategory, string> = {
  singer_vocalist: 'Vocalist',
  producer_engineer: 'Producer',
  performer_dj: 'Performer / DJ',
  beauty_professional: 'Beauty',
  model: 'Model',
  photographer_videographer: 'Photographer',
};

export const CATEGORY_LIST: { value: TalentCategory; label: string; shortLabel: string }[] = [
  { value: 'singer_vocalist', label: 'Singer / Vocalist', shortLabel: 'Vocalist' },
  { value: 'producer_engineer', label: 'Producer / Sound Engineer', shortLabel: 'Producer' },
  { value: 'performer_dj', label: 'Live Performer / DJ', shortLabel: 'Performer / DJ' },
  { value: 'beauty_professional', label: 'Beauty Professional (MUA, Hair, Wardrobe)', shortLabel: 'Beauty' },
  { value: 'model', label: 'Model', shortLabel: 'Model' },
  { value: 'photographer_videographer', label: 'Photographer / Videographer', shortLabel: 'Photographer' },
];

export const CATEGORY_MEDIA_HINTS: Record<TalentCategory, { photos: boolean; audio: boolean; video: boolean; hint: string }> = {
  singer_vocalist: { photos: true, audio: true, video: true, hint: 'Showcase your vocal range with audio tracks, performance photos, and video reels.' },
  producer_engineer: { photos: false, audio: true, video: true, hint: 'Upload your best produced tracks, beats, and studio session videos.' },
  performer_dj: { photos: true, audio: false, video: true, hint: 'Share video reels of your live sets and performance photos.' },
  beauty_professional: { photos: true, audio: false, video: false, hint: 'Build a portfolio gallery showcasing your makeup, hair, and wardrobe work.' },
  model: { photos: true, audio: false, video: true, hint: 'Create a photo portfolio with your best shots and a showreel video.' },
  photographer_videographer: { photos: true, audio: false, video: true, hint: 'Display your photography portfolio and video reel of your best work.' },
};

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  photo: 'Photo',
  audio: 'Audio Track',
  video: 'Video Reel',
};

// Role options per category
export const CATEGORY_ROLES: Record<TalentCategory, string[]> = {
  singer_vocalist: ['Lead Vocalist', 'Backing Vocalist', 'Session Singer', 'Choir Singer', 'Acapella'],
  producer_engineer: ['Music Producer', 'Sound Engineer', 'Beat Maker', 'Mixing Engineer', 'Mastering Engineer', 'Live Sound Tech'],
  performer_dj: ['DJ', 'Live Performer', 'MC / Host', 'Band', 'One-Man Band'],
  beauty_professional: ['Makeup Artist', 'Hair Stylist', 'Wardrobe Stylist', 'Special FX Makeup', 'Bridal MUA'],
  model: ['Fashion Model', 'Runway Model', 'Commercial Model', 'Fitness Model', 'Promotional Model'],
  photographer_videographer: ['Photographer', 'Videographer', 'Drone Operator', 'Photo Editor', 'Color Grader'],
};

// Genre/style options per category
export const CATEGORY_STYLES: Record<TalentCategory, string[]> = {
  singer_vocalist: ['Pop', 'R&B', 'Jazz', 'Classical', 'Rock', 'Soul', 'Gospel', 'Folk', 'Opera', 'Hip Hop'],
  producer_engineer: ['Hip Hop', 'Electronic', 'Pop', 'R&B', 'Afrobeats', 'Lo-Fi', 'Trap', 'House', 'Techno', 'Film Score'],
  performer_dj: ['House', 'Techno', 'Hip Hop', 'Afrobeats', 'EDM', 'Open Format', 'Disco', 'Reggae', 'Drum & Bass', 'Latin'],
  beauty_professional: ['Bridal', 'Editorial', 'Film & TV', 'Fashion Show', 'Natural', 'Glam', 'Special FX', 'Avant-Garde'],
  model: ['Editorial', 'Commercial', 'Runway', 'Fitness', 'Lifestyle', 'Swimwear', 'Lingerie', 'Plus Size'],
  photographer_videographer: ['Wedding', 'Events', 'Fashion', 'Portrait', 'Product', 'Music Video', 'Documentary', 'Real Estate', 'Sports'],
};
