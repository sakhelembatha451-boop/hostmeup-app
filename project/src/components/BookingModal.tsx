import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient'; // Adjust this import path if your Supabase client file is located elsewhere

interface Service {
  id: string;
  title: string;
  price: number;
}

interface BookingModalProps {
  artistId: string;
  artistName: string;
  services: Service[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  artistId,
  artistName,
  services,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || '');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(1);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const calculatedTotal = selectedService ? selectedService.price * duration : 0;

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to send a booking request.');

      const { error: bookingError } = await supabase.from('bookings').insert([
        {
          client_id: user.id,
          artist_id: artistId,
          service_id: selectedServiceId || null,
          event_date: eventDate,
          start_time: startTime,
          duration_hours: duration,
          total_price: calculatedTotal,
          location,
          notes,
          status: 'pending',
        },
      ]);

      if (bookingError) throw bookingError;

      alert('Booking request sent successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send booking request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-lg font-bold"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-1">Book {artistName}</h2>
        <p className="text-gray-500 text-sm mb-6">Select details to send a direct contract request.</p>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}

        <form onSubmit={handleSubmitBooking} className="space-y-4">
          {services.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Select Service</label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full border rounded-lg p-2.5 text-sm"
                required
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.title} — R{service.price}/hr
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Duration (Hours)</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                required
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value) || 1)}
                className="w-full border rounded-lg p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estimated Total</label>
              <div className="p-2 border rounded-lg bg-gray-50 text-sm font-semibold text-gray-800">
                R{calculatedTotal.toFixed(2)}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Location / Venue</label>
            <input
              type="text"
              placeholder="e.g. Cape Town City Hall"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes / Special Requests</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Share event requirements or setup details..."
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50"
            >
              {loading ? 'Sending Request...' : 'Confirm Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
