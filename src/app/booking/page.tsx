'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import DeviceCodeLogin from '@/components/DeviceCodeLogin';

interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface RoomOption {
  name: string;
  email: string;
}

export default function BookingPage() {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Booking form state
  const [rooms, setRooms] = useState<RoomOption[]>([
    { name: 'Meeting Room A', email: 'meetingrooma@it96.my' },
    { name: 'Meeting Room B', email: 'meetingroomb@it96.my' },
    { name: 'Meeting Room C', email: 'meetingroomc@it96.my' },
  ]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [isMultiRoom, setIsMultiRoom] = useState(false);
  const [bookingDate, setBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [endTime, setEndTime] = useState('');
  const [useEndTime, setUseEndTime] = useState(false);
  const [subject, setSubject] = useState('');
  const [bookedBy, setBookedBy] = useState('');

  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New room form
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomEmail, setNewRoomEmail] = useState('');

  // Load saved rooms from localStorage
  useEffect(() => {
    const savedRooms = localStorage.getItem('bookingRooms');
    if (savedRooms) {
      const parsed = JSON.parse(savedRooms);
      if (parsed.length > 0) {
        setRooms(parsed);
      }
    }
  }, []);

  // Check for saved token
  useEffect(() => {
    const saved = localStorage.getItem('deviceTokenInfo');
    if (saved) {
      const info = JSON.parse(saved) as TokenInfo;
      if (info.expiresAt > Date.now()) {
        setTokenInfo(info);
        setIsAuthenticated(true);
      }
    }
    setLoading(false);
  }, []);

  // Login success handler
  const handleLoginSuccess = (info: TokenInfo) => {
    setTokenInfo(info);
    setIsAuthenticated(true);
  };

  // Add new room
  const handleAddRoom = () => {
    if (!newRoomName.trim() || !newRoomEmail.trim()) return;

    const newRooms = [...rooms, { name: newRoomName, email: newRoomEmail }];
    setRooms(newRooms);
    localStorage.setItem('bookingRooms', JSON.stringify(newRooms));
    setNewRoomName('');
    setNewRoomEmail('');
    setShowAddRoom(false);
  };

  // Remove room
  const handleRemoveRoom = (email: string) => {
    const newRooms = rooms.filter(r => r.email !== email);
    setRooms(newRooms);
    localStorage.setItem('bookingRooms', JSON.stringify(newRooms));
    setSelectedRooms(selectedRooms.filter(e => e !== email));
  };

  // Toggle room selection
  const toggleRoomSelection = (email: string) => {
    if (selectedRooms.includes(email)) {
      setSelectedRooms(selectedRooms.filter(e => e !== email));
    } else {
      if (isMultiRoom) {
        setSelectedRooms([...selectedRooms, email]);
      } else {
        setSelectedRooms([email]);
      }
    }
  };

  // Switch between single and multi room mode
  const handleModeChange = (multi: boolean) => {
    setIsMultiRoom(multi);
    if (!multi && selectedRooms.length > 1) {
      setSelectedRooms([selectedRooms[0]]);
    }
  };

  // Book meeting
  const handleBook = async () => {
    if (!tokenInfo || selectedRooms.length === 0 || !subject.trim() || !bookedBy.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsBooking(true);
    setError(null);
    setSuccess(null);

    try {
      const selectedRoomObjects = rooms.filter(r => selectedRooms.includes(r.email));
      const startDateTime = new Date(`${bookingDate}T${startTime}:00`);
      const endDateTime = useEndTime && endTime
        ? new Date(`${bookingDate}T${endTime}:00`)
        : new Date(startDateTime.getTime() + duration * 60000);

      // Build location name from all selected rooms
      const locationName = selectedRoomObjects.map(r => r.name).join(' + ');

      // Build attendees array with all selected rooms
      const attendees = selectedRoomObjects.map(room => ({
        emailAddress: {
          address: room.email,
          name: room.name,
        },
        type: 'resource',
      }));

      const event = {
        subject: `${subject} (${bookedBy})`,
        body: {
          contentType: 'text',
          content: `Booked by: ${bookedBy}`,
        },
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'UTC',
        },
        location: {
          displayName: locationName,
        },
        attendees: attendees,
      };

      const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenInfo.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create booking');
      }

      const roomNames = selectedRoomObjects.map(r => r.name).join(', ');
      setSuccess(`Successfully booked ${roomNames} for ${format(startDateTime, 'MMM d')} at ${startTime}`);
      setSubject('');
      setSelectedRooms([]);
    } catch (err) {
      console.error('Booking error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setIsBooking(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <DeviceCodeLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white text-center">Book Meeting Room</h1>
        </div>

        {/* Booking Form */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8 mb-6">
          {/* Booking Mode Toggle */}
          <div className="mb-6">
            <label className="block text-white/70 text-sm mb-3">Booking Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleModeChange(false)}
                className={`py-3 rounded-xl font-medium transition-all ${
                  !isMultiRoom
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Single Room
              </button>
              <button
                onClick={() => handleModeChange(true)}
                className={`py-3 rounded-xl font-medium transition-all ${
                  isMultiRoom
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Combined Meeting
              </button>
            </div>
          </div>

          {/* Room Selection */}
          <div className="mb-6">
            <label className="block text-white/70 text-sm mb-2">
              {isMultiRoom ? 'Select Rooms (choose 2-3)' : 'Meeting Room'}
            </label>
            <div className="space-y-2">
              {rooms.map((room) => (
                <button
                  key={room.email}
                  onClick={() => toggleRoomSelection(room.email)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                    selectedRooms.includes(room.email)
                      ? 'bg-blue-500/30 border-2 border-blue-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <span className="text-white font-medium">{room.name}</span>
                  {selectedRooms.includes(room.email) && (
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            {isMultiRoom && selectedRooms.length > 0 && (
              <div className="mt-3 text-sm text-blue-400">
                Selected: {rooms.filter(r => selectedRooms.includes(r.email)).map(r => r.name).join(' + ')}
              </div>
            )}
          </div>

          {/* Date */}
          <div className="mb-6">
            <label className="block text-white/70 text-sm mb-2">Date</label>
            <input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {/* Time */}
          <div className="mb-6">
            <label className="block text-white/70 text-sm mb-2">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {/* Duration Mode Toggle */}
          <div className="mb-4">
            <label className="block text-white/70 text-sm mb-3">End Time Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setUseEndTime(false)}
                className={`py-3 rounded-xl font-medium transition-all ${
                  !useEndTime
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Duration
              </button>
              <button
                onClick={() => setUseEndTime(true)}
                className={`py-3 rounded-xl font-medium transition-all ${
                  useEndTime
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                End Time
              </button>
            </div>
          </div>

          {/* Duration Selection */}
          {!useEndTime && (
            <div className="mb-6">
              <label className="block text-white/70 text-sm mb-3">Duration</label>
              <div className="grid grid-cols-3 gap-3">
                {[15, 30, 45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setDuration(mins)}
                    className={`py-3 rounded-xl font-medium transition-all ${
                      duration === mins
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* End Time Selection */}
          {useEndTime && (
            <div className="mb-6">
              <label className="block text-white/70 text-sm mb-2">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
              />
              {/* Quick presets for all day */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <button
                  onClick={() => setEndTime('12:00')}
                  className={`py-2 rounded-lg text-sm transition-all ${
                    endTime === '12:00' ? 'bg-blue-500/50 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  12:00
                </button>
                <button
                  onClick={() => setEndTime('17:00')}
                  className={`py-2 rounded-lg text-sm transition-all ${
                    endTime === '17:00' ? 'bg-blue-500/50 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  17:00
                </button>
                <button
                  onClick={() => setEndTime('18:00')}
                  className={`py-2 rounded-lg text-sm transition-all ${
                    endTime === '18:00' ? 'bg-blue-500/50 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  18:00
                </button>
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="mb-6">
            <label className="block text-white/70 text-sm mb-2">Meeting Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter meeting subject"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {/* Booked By */}
          <div className="mb-6">
            <label className="block text-white/70 text-sm mb-2">Booked By</label>
            <input
              type="text"
              value={bookedBy}
              onChange={(e) => setBookedBy(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {/* Booking Summary */}
          {selectedRooms.length > 0 && subject && bookedBy && (
            <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="text-white/50 text-xs uppercase tracking-wider mb-3">Booking Summary</div>
              <div className="space-y-2 text-white/80">
                <div className="flex justify-between">
                  <span>Room{selectedRooms.length > 1 ? 's' : ''}:</span>
                  <span className="text-white text-right">
                    {rooms.filter(r => selectedRooms.includes(r.email)).map(r => r.name).join(' + ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span className="text-white">{format(new Date(bookingDate), 'EEEE, MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Time:</span>
                  <span className="text-white">
                    {startTime} - {useEndTime && endTime ? endTime : format(new Date(new Date(`${bookingDate}T${startTime}:00`).getTime() + duration * 60000), 'HH:mm')}
                  </span>
                </div>
                {!useEndTime && (
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="text-white">{duration >= 60 ? `${duration / 60} hour${duration > 60 ? 's' : ''}` : `${duration} minutes`}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Booked by:</span>
                  <span className="text-white">{bookedBy}</span>
                </div>
              </div>
            </div>
          )}

          {/* Book Button */}
          <button
            onClick={handleBook}
            disabled={isBooking || selectedRooms.length === 0 || !subject.trim() || !bookedBy.trim()}
            className="w-full py-4 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
          >
            {isBooking ? 'Booking...' : (selectedRooms.length > 1 ? 'Book Rooms' : 'Book Room')}
          </button>

          {/* Success Message */}
          {success && (
            <div className="mt-4 p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Room Management */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Manage Rooms</h2>
            <button
              onClick={() => setShowAddRoom(!showAddRoom)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
            >
              {showAddRoom ? 'Cancel' : '+ Add Room'}
            </button>
          </div>

          {/* Add Room Form */}
          {showAddRoom && (
            <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="mb-4">
                <label className="block text-white/70 text-sm mb-2">Room Name</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g., Meeting Room A"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div className="mb-4">
                <label className="block text-white/70 text-sm mb-2">Room Email</label>
                <input
                  type="email"
                  value={newRoomEmail}
                  onChange={(e) => setNewRoomEmail(e.target.value)}
                  placeholder="e.g., meetingrooma@company.com"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <button
                onClick={handleAddRoom}
                disabled={!newRoomName.trim() || !newRoomEmail.trim()}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
              >
                Add Room
              </button>
            </div>
          )}

          {/* Room List */}
          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room.email}
                className="flex items-center justify-between p-4 bg-white/5 rounded-xl"
              >
                <div>
                  <div className="text-white font-medium">{room.name}</div>
                  <div className="text-white/50 text-sm">{room.email}</div>
                </div>
                <button
                  onClick={() => handleRemoveRoom(room.email)}
                  className="p-2 text-white/40 hover:text-red-400 transition-all"
                  title="Remove room"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
