// ==========================================
// User & Profile Types
// ==========================================

export type UserRole = 'artist' | 'host' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  email?: string;
  phone_number?: string | null;
  avatar_url?: string | null;
  role?: UserRole;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface HostProfile {
  id: string;
  user_id?: string;
  company_name?: string | null;
  bio?: string | null;
  location?: string | null;
  is_identity_verified: boolean;
  verification_status: 'pending' | 'approved' | 'rejected' | null;
  created_at?: string;
}

export interface ArtistProfile {
  id: string;
  user_id: string;
  stage_name?: string | null;
  bio?: string | null;
  category?: string | null;
  categories?: string[] | null;
  performance_roles?: string[] | null;
  rate?: number | null;
  hourly_rate?: number | null;
  base_rate?: number | null;
  rate_unit?: 'hour' | 'event' | 'day' | string;
  custom_rate_display?: string | null;
  location?: string | null;
  location_city?: string | null;
  location_province?: string | null;
  cover_url?: string | null;
  avatar_url?: string | null;
  gallery_urls?: string[] | null;
  gallery?: string[] | null;
  portfolio_urls?: string[] | null;
  media_urls?: string[] | null;
  is_verified?: boolean;
  created_at?: string;
}

/** Combined Artist type containing user profile details & artist specifications */
export type ArtistWithProfile = Profile & {
  artist_profile?: ArtistProfile | null;
};

// ==========================================
// Service Item Types
// ==========================================

export interface ServiceItem {
  id: string;
  profile_id: string;
  service_name: string;
  price: number;
  duration_minutes?: number;
  created_at?: string;
}

// ==========================================
// Booking Types
// ==========================================

export type BookingStatus = 
  | 'pending' 
  | 'pending_verification' 
  | 'accepted' 
  | 'confirmed' 
  | 'checked_in' 
  | 'completed' 
  | 'fully_paid' 
  | 'cancelled' 
  | 'rejected' 
  | 'declined';

export interface Booking {
  id: string;
  artist_id: string;
  host_id: string;
  client_id?: string;
  service_id?: string | null;
  event_name: string;
  event_date: string;
  start_time?: string | null;
  gig_duration?: string | null;
  duration_hours?: number | null;
  equipment_needed?: string[] | null;
  location: string;
  notes?: string | null;
  status: BookingStatus;
  total_price: number;
  total_amount?: number; // Fallback support
  deposit_amount: number;
  deposit_paid: boolean;
  balance_paid?: boolean;
  verification_pin?: string;
  verification_token?: string;
  is_arrival_verified?: boolean;
  arrival_verified_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  artist?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    location?: string;
  };
}

// ==========================================
// Payment & Invoice Payload Types (Edge Functions)
// ==========================================

export interface PaymentInvoicePayload {
  paymentType: 'deposit' | 'balance';
  amountPaid: number;
  remainingBalance: number;
  booking: {
    id: string;
    event_name: string;
    event_date: string;
    total_amount: number;
    verification_pin?: string;
    verification_token?: string;
  };
  host: {
    full_name: string;
    email: string;
  };
  artist: {
    full_name: string;
    email: string;
    stage_name?: string;
  };
}

// ==========================================
// Messaging & Notification Types
// ==========================================

export interface Conversation {
  id: string;
  title?: string;
  type?: 'booking' | 'direct' | 'support';
  booking_id?: string | null;
  created_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'booking' | 'payment' | 'system' | 'chat';
  title: string;
  message: string;
  link_url?: string;
  booking_id?: string;
  read: boolean;
  created_at?: string;
}
