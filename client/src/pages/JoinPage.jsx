import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { BarChart3, ArrowRight, Loader2, Hash, Radio } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../components/Toast';

// ─── Voter Token Fingerprinting ───────────────────────────────────
const getOrCreateVoterToken = () => {
  const KEY = 'quickpoll_voter_token';
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(KEY, token);
  }
  return token;
};

const JoinPage = () => {
  const navigate = useNavigate();
  const { pin: paramPin } = useParams();
  const [searchParams] = useSearchParams();

  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const inputRef = useRef(null);

  // Ensure voter fingerprint exists on load
  useEffect(() => {
    getOrCreateVoterToken();
  }, []);

  // Auto-fill and submit if PIN is in route params (/join/:pin) or query param (/join?pin=)
  useEffect(() => {
    const rawPin = paramPin || searchParams.get('pin');
    if (rawPin) {
      const normalized = rawPin.toString().toUpperCase().trim();
      setPin(normalized);
      setAutoSubmitting(true);
    } else {
      // Focus pin input on mount when no query pin
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [paramPin, searchParams]);

  // Auto-submit once pin is set from URL
  useEffect(() => {
    if (autoSubmitting && pin) {
      handleJoin(pin);
    }
  }, [autoSubmitting, pin]);

  const handleJoin = async (pinValue) => {
    const normalized = (pinValue || pin).toString().toUpperCase().trim();

    if (!normalized) {
      toast.error('Please enter a room PIN.');
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/rooms/verify/${normalized}`);
      const room = res.data.data;

      if (room.status === 'ended') {
        toast.error('This poll session has ended.');
        setLoading(false);
        setAutoSubmitting(false);
        return;
      }

      // Navigate to live voting page
      navigate(`/vote/${normalized}`, { state: { title: room.title } });
    } catch (err) {
      const msg = err.response?.data?.error || `Room "${normalized}" not found.`;
      toast.error(msg);
      setLoading(false);
      setAutoSubmitting(false);
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handlePinChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setPin(val);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleJoin(pin);
  };

  if (autoSubmitting) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 space-y-4">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-mono">
          Connecting to Room <span className="text-emerald-400 font-bold">{pin}</span>...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative">
      {/* Top right Presenter Login link */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <button
          onClick={() => navigate('/login')}
          className="text-xs text-slate-400 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/30 bg-slate-900/70 backdrop-blur px-3 py-1.5 rounded-xl transition"
        >
          Presenter Login &rarr;
        </button>
      </div>

      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-2xl shadow-emerald-500/30 mb-4">
            <BarChart3 className="w-8 h-8 text-slate-950 stroke-[2.5]" />
          </div>
          <h1 className="text-3xl font-black text-slate-100">
            QuickPoll<span className="text-emerald-400">Live</span>
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Join a live poll session</p>
        </div>

        {/* PIN Card */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-7 shadow-2xl space-y-5">
          <div>
            <label
              htmlFor="pin-input"
              className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3"
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Enter Room PIN</span>
            </label>
            <input
              id="pin-input"
              ref={inputRef}
              type="text"
              inputMode="text"
              value={pin}
              onChange={handlePinChange}
              onKeyDown={handleKeyDown}
              maxLength={6}
              placeholder="4892"
              autoComplete="off"
              className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-6 py-5 text-center text-4xl font-black font-mono tracking-[0.3em] text-emerald-400 placeholder-slate-700 outline-none transition-all duration-200 caret-emerald-400"
            />
          </div>

          <button
            onClick={() => handleJoin(pin)}
            disabled={loading || !pin}
            className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 font-black text-lg py-4 px-4 rounded-2xl transition-all duration-200 flex items-center justify-center space-x-3 shadow-xl shadow-emerald-500/25"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Joining...</span>
              </>
            ) : (
              <>
                <span>Join Session</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-2">
          <div className="flex items-center justify-center space-x-2 text-slate-600 text-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
            <span>Real-time powered by Socket.io</span>
          </div>
          <p className="text-slate-700 text-xs">
            Your vote is anonymous and deduplicated
          </p>
          <p className="pt-2 text-slate-500 text-xs">
            Want to host a poll?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 transition"
            >
              Sign in as Presenter &rarr;
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default JoinPage;

