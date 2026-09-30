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
  performance_roles?: string[] | null;
  rate?: number | null;
  hourly_rate?: number | null;
  base_rate?: number | null;
  rate_unit?: 'hour' | 'event' | 'day' | string;
  location?: string | null;
  is_verified?: boolean;
  created_at?: string;
}

/** Combined Artist type containing user profile details & artist specifications */
export type ArtistWithProfile = Profile & {
  artist_profile?: ArtistProfile | null;
};

// ==========================================
// Booking Types
// ==========================================

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';

export interface Booking {
  id: string;
  artist_id: string;
  host_id: string;
  event_name: string;
  event_date: string;
  start_time?: string | null;
  gig_duration?: string | null;
  equipment_needed?: string[] | null;
  location: string;
  notes?: string | null;
  status: BookingStatus;
  total_amount: number;
  deposit_amount: number;
  deposit_paid: boolean;
  verification_pin?: string;
  verification_token?: string;
  created_at?: string;
  updated_at?: string;
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
