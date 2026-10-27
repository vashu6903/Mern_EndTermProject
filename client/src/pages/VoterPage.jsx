import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, CheckCircle2, Clock, Lock, Radio,
  WifiOff, Users, ArrowLeft, Loader2
} from 'lucide-react';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { toast } from '../components/Toast';

// ─── Voter Token (fingerprint persistence) ─────────────────────────
const getVoterToken = () => {
  const KEY = 'quickpoll_voter_token';
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(KEY, token);
  }
  return token;
};

// ─── Option letter labels & color sets ────────────────────────────
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const OPTION_THEMES = [
  { base: 'border-slate-700 bg-slate-800/60 hover:border-emerald-500/60 hover:bg-emerald-500/10 active:scale-95', selected: 'border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500/30', label: 'bg-emerald-500 text-slate-950', text: 'text-emerald-400' },
  { base: 'border-slate-700 bg-slate-800/60 hover:border-sky-500/60 hover:bg-sky-500/10 active:scale-95',     selected: 'border-sky-500 bg-sky-500/20 ring-2 ring-sky-500/30',         label: 'bg-sky-500 text-slate-950',     text: 'text-sky-400' },
  { base: 'border-slate-700 bg-slate-800/60 hover:border-violet-500/60 hover:bg-violet-500/10 active:scale-95', selected: 'border-violet-500 bg-violet-500/20 ring-2 ring-violet-500/30', label: 'bg-violet-500 text-slate-950', text: 'text-violet-400' },
  { base: 'border-slate-700 bg-slate-800/60 hover:border-amber-500/60 hover:bg-amber-500/10 active:scale-95',   selected: 'border-amber-500 bg-amber-500/20 ring-2 ring-amber-500/30',   label: 'bg-amber-500 text-slate-950',   text: 'text-amber-400' },
  { base: 'border-slate-700 bg-slate-800/60 hover:border-rose-500/60 hover:bg-rose-500/10 active:scale-95',     selected: 'border-rose-500 bg-rose-500/20 ring-2 ring-rose-500/30',       label: 'bg-rose-500 text-slate-950',     text: 'text-rose-400' },
  { base: 'border-slate-700 bg-slate-800/60 hover:border-teal-500/60 hover:bg-teal-500/10 active:scale-95',     selected: 'border-teal-500 bg-teal-500/20 ring-2 ring-teal-500/30',       label: 'bg-teal-500 text-slate-950',     text: 'text-teal-400' },
];

// ─── Vote State Enum ───────────────────────────────────────────────
// 'idle'       → No vote cast yet, buttons active
// 'submitting' → Awaiting server acknowledgement
// 'voted'      → Vote confirmed, waiting for next question
// 'locked'     → Presenter locked voting
// 'connecting' → Initial socket connection

const VoterPage = () => {
  const { pin } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const voterToken = getVoterToken();
  const socketRef = useRef(null);

  // ─── State ──────────────────────────────────────────────────────
  const [voteState, setVoteState] = useState('connecting'); // see enum above
  const [roomTitle, setRoomTitle] = useState(location.state?.title || `Room ${pin}`);
  const [question, setQuestion] = useState(null);       // { id, order, text, options, isLocked }
  const [totalQuestions, setTotalQuestions] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [previouslyVotedOptionId, setPreviouslyVotedOptionId] = useState(null);

  // ─── Socket Setup ────────────────────────────────────────────────
  const handleRoomState = useCallback((data) => {
    setRoomTitle(data.title || roomTitle);
    setTotalQuestions(data.totalQuestions);
    setParticipantCount(data.participantCount);

    if (data.currentQuestion) {
      setQuestion(data.currentQuestion);

      // Restore previously voted state if voter already voted on this question
      if (data.hasVoted) {
        setSelectedOptionId(data.votedOptionId);
        setPreviouslyVotedOptionId(data.votedOptionId);
        setVoteState('voted');
      } else if (data.currentQuestion.isLocked) {
        setVoteState('locked');
      } else {
        setVoteState('idle');
      }
    } else {
      setVoteState('idle');
    }
  }, [roomTitle]);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      toast.socket(true);

      socket.emit(
        'join_room',
        { pin, role: 'voter', voterToken },
        (response) => {
          if (!response.success) {
            toast.error(response.error || 'Failed to join room.');
            setVoteState('idle');
            return;
          }
          handleRoomState(response.data);
        }
      );
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      toast.socket(false);
    });

    socket.on('connect_error', () => {
      setSocketConnected(false);
      setVoteState('idle');
    });

    // Presenter advanced to next question → reset voter state
    socket.on('question_changed', ({ question: newQuestion, totalQuestions: total }) => {
      setQuestion(newQuestion);
      setSelectedOptionId(null);
      setPreviouslyVotedOptionId(null);
      setTotalQuestions(total || totalQuestions);

      if (newQuestion.isLocked) {
        setVoteState('locked');
      } else {
        setVoteState('idle');
      }
    });

    // Presenter toggled voting lock
    socket.on('voting_status_changed', ({ isLocked }) => {
      setQuestion((prev) => prev ? { ...prev, isLocked } : prev);
      setVoteState((prev) => {
        if (prev === 'voted') return 'voted'; // already voted — lock has no effect
        return isLocked ? 'locked' : 'idle';
      });
    });

    // Live results: optionally track own vote visually
    socket.on('results_updated', () => {
      // Voter UI intentionally doesn't show bar results (that's presenter view)
      // We could optionally show a vote distribution here in future
    });

    socket.on('participant_count_updated', ({ count }) => {
      setParticipantCount(count);
    });

    socket.on('room_error', ({ message }) => {
      toast.error(message);
    });

    socket.connect();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('question_changed');
      socket.off('voting_status_changed');
      socket.off('results_updated');
      socket.off('participant_count_updated');
      socket.off('room_error');
      disconnectSocket();
    };
  }, [pin, voterToken, handleRoomState]);

  // ─── Cast Vote ───────────────────────────────────────────────────
  const castVote = (optionId) => {
    if (voteState !== 'idle' || !question) return;
    if (!socketRef.current?.connected) {
      toast.error('Not connected. Please wait...');
      return;
    }

    // Optimistic UI — highlight immediately
    setSelectedOptionId(optionId);
    setVoteState('submitting');

    socketRef.current.emit(
      'cast_vote',
      { pin, questionId: question.id, optionId, voterToken },
      (response) => {
        if (!response) return; // no callback from server (shouldn't happen)
        if (!response.success) {
          if (response.votedOptionId) {
            // Already voted — restore state
            setSelectedOptionId(response.votedOptionId);
            setPreviouslyVotedOptionId(response.votedOptionId);
            setVoteState('voted');
          } else {
            toast.error(response.error || 'Failed to record vote.');
            setSelectedOptionId(null);
            setVoteState('idle');
          }
        }
      }
    );

    // Listen for server-emitted vote_confirmed or already_voted events
    socketRef.current.once('vote_confirmed', () => {
      setPreviouslyVotedOptionId(optionId);
      setVoteState('voted');
    });

    socketRef.current.once('already_voted', ({ votedOptionId }) => {
      setSelectedOptionId(votedOptionId || optionId);
      setPreviouslyVotedOptionId(votedOptionId || optionId);
      setVoteState('voted');
    });
  };

  // ─── Render Helpers ──────────────────────────────────────────────
  const isInteractive = voteState === 'idle';
  const isSubmitting = voteState === 'submitting';
  const hasVoted = voteState === 'voted';
  const isLocked = voteState === 'locked';

  // ─── Screen: Connecting ──────────────────────────────────────────
  if (voteState === 'connecting') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 space-y-5">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-slate-300 font-semibold">Joining Room</p>
          <p className="text-emerald-400 font-mono font-black text-2xl mt-1">{pin}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ─── TOP BAR ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur border-b border-slate-800/80">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate('/join')}
            className="text-slate-500 hover:text-slate-300 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-xs text-slate-500 leading-none">PIN</span>
            <span className="text-emerald-400 font-black font-mono text-lg leading-tight tracking-widest">{pin}</span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <span className="flex items-center space-x-1 text-slate-500">
              <Users className="w-3.5 h-3.5" />
              <span className="font-mono font-semibold">{participantCount}</span>
            </span>
            {socketConnected ? (
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
          </div>
        </div>
      </header>

      {/* ─── MAIN BODY ──────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 py-6 space-y-5">

        {/* Room Title & Question Progress */}
        <div>
          <p className="text-xs text-slate-500 font-medium mb-1 truncate">{roomTitle}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Question{' '}
              <strong className="text-slate-200">{question?.order || '—'}</strong>
              {totalQuestions ? ` of ${totalQuestions}` : ''}
            </span>
            {/* Progress dots */}
            {totalQuestions && (
              <div className="flex space-x-1">
                {Array.from({ length: totalQuestions }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      i + 1 < (question?.order || 1)
                        ? 'bg-emerald-500'
                        : i + 1 === (question?.order || 1)
                        ? 'bg-emerald-400 scale-125'
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Status Banner ─────────────────────────────────────── */}
        {isLocked && (
          <div className="flex items-center space-x-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-300 font-medium">
              Voting is currently locked by the presenter.
            </p>
          </div>
        )}

        {/* ─── Question Card ──────────────────────────────────────── */}
        {question ? (
          <>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <p className="text-lg sm:text-xl font-bold text-slate-100 leading-snug">
                {question.text}
              </p>
            </div>

            {/* ─── Option Buttons (Screen B) ─────────────────────── */}
            {!hasVoted ? (
              <div className="space-y-3 flex-1">
                {question.options?.map((option, index) => {
                  const theme = OPTION_THEMES[index % OPTION_THEMES.length];
                  const label = OPTION_LABELS[index];
                  const isSelected = selectedOptionId === option.id;
                  const disabled = !isInteractive || isSubmitting || isLocked;

                  return (
                    <button
                      key={option.id}
                      onClick={() => castVote(option.id)}
                      disabled={disabled}
                      className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl border-2 text-left font-semibold text-sm
                        transition-all duration-200
                        ${isSelected ? theme.selected : ''}
                        ${!isSelected && !disabled ? theme.base : ''}
                        ${disabled && !isSelected ? 'border-slate-800 bg-slate-900/40 opacity-50 cursor-not-allowed' : ''}
                        ${isSubmitting && isSelected ? 'animate-pulse' : ''}
                      `}
                    >
                      {/* Letter Badge */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl text-sm font-black flex items-center justify-center shadow-md transition-all duration-200
                        ${isSelected ? theme.label : 'bg-slate-700 text-slate-300'}`}
                      >
                        {isSubmitting && isSelected ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          label
                        )}
                      </div>

                      {/* Option Text */}
                      <span className={`flex-1 leading-snug transition-colors duration-200
                        ${isSelected ? theme.text : 'text-slate-200'}`}
                      >
                        {option.text}
                      </span>

                      {isSelected && !isSubmitting && (
                        <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${theme.text}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              // ─── Screen C: Voted Confirmation / Waiting ──────────
              <div className="flex-1 flex flex-col space-y-4">
                {/* Voted Confirmation Card */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-400">Vote Recorded!</p>
                    <p className="text-slate-400 text-sm mt-1">
                      Waiting for presenter to advance to the next question...
                    </p>
                  </div>
                </div>

                {/* Show which option was selected, grayed out */}
                <div className="space-y-2 opacity-60">
                  {question.options?.map((option, index) => {
                    const theme = OPTION_THEMES[index % OPTION_THEMES.length];
                    const label = OPTION_LABELS[index];
                    const isMyVote = previouslyVotedOptionId === option.id;

                    return (
                      <div
                        key={option.id}
                        className={`w-full flex items-center space-x-4 px-5 py-3.5 rounded-2xl border-2 text-sm
                          ${isMyVote ? theme.selected : 'border-slate-800 bg-slate-900/30'}`}
                      >
                        <div className={`flex-shrink-0 w-9 h-9 rounded-xl text-sm font-black flex items-center justify-center
                          ${isMyVote ? theme.label : 'bg-slate-800 text-slate-500'}`}
                        >
                          {label}
                        </div>
                        <span className={`flex-1 font-medium ${isMyVote ? theme.text : 'text-slate-600'}`}>
                          {option.text}
                        </span>
                        {isMyVote && <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${theme.text}`} />}
                      </div>
                    );
                  })}
                </div>

                {/* Waiting indicator */}
                <div className="flex items-center justify-center space-x-2 py-4">
                  <Clock className="w-4 h-4 text-slate-600 animate-pulse" />
                  <span className="text-xs text-slate-600">Waiting for presenter...</span>
                </div>
              </div>
            )}
          </>
        ) : (
          // No active question yet
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-4">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
              <BarChart3 className="w-7 h-7 text-slate-600" />
            </div>
            <div>
              <p className="text-slate-400 font-semibold">Waiting for the presenter</p>
              <p className="text-slate-600 text-sm mt-1">The poll will begin shortly...</p>
            </div>
            <div className="flex space-x-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-slate-700 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="pb-6 text-center">
        <p className="text-xs text-slate-700">
          QuickPoll Live &bull; Your vote is anonymous
        </p>
      </footer>
    </div>
  );
};

export default VoterPage;

