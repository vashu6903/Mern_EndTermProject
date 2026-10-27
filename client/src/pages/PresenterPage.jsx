import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Lock, Unlock, Eye, EyeOff, ChevronRight, Square,
  Radio, Users, BarChart2, ArrowLeft, Loader2, CheckCircle,
  Wifi, WifiOff, Clock, FileText, Download, AlertCircle, Play
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { connectSocket, disconnectSocket } from '../lib/socket';
import api from '../lib/api';
import { toast } from '../components/Toast';
import ResultBars from '../components/ResultBars';
import { exportPollToPDF } from '../lib/pdfExport';

const PresenterPage = () => {
  const { pin } = useParams();
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  // ─── State ────────────────────────────────────────────────────
  const [roomMeta, setRoomMeta] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Countdown timer state: { duration, endsAt, remainingSeconds } | null
  const [timerState, setTimerState] = useState(null);
  const timerIntervalRef = useRef(null);

  const socketRef = useRef(null);
  const joinUrl = `${window.location.origin}/join?pin=${pin}`;

  // Total votes across current question
  const totalVotes =
    currentQuestion?.options?.reduce((sum, o) => sum + (o.voteCount || 0), 0) ?? 0;

  // ─── Local Timer Tick ──────────────────────────────────────────
  const startLocalTimerTicker = useCallback((endsAt) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const updateRemaining = () => {
      const remainingMs = endsAt - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setTimerState((prev) => (prev ? { ...prev, remainingSeconds: remainingSec } : null));

      if (remainingSec <= 0) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        setTimerState(null);
      }
    };

    updateRemaining();
    timerIntervalRef.current = setInterval(updateRemaining, 1000);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerState(null);
  }, []);

  // ─── Socket Setup ──────────────────────────────────────────────
  const setupSocket = useCallback(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus('connected');
      toast.socket(true);

      socket.emit(
        'join_room',
        { pin, role: 'presenter', token },
        (response) => {
          if (!response.success) {
            toast.error(response.error || 'Failed to join room.');
            setLoading(false);
            return;
          }
          const data = response.data;
          setRoomMeta({
            title: data.title,
            status: data.status,
            totalQuestions: data.totalQuestions,
          });
          setCurrentQuestion(data.currentQuestion);
          setParticipantCount(data.participantCount);

          if (data.activeTimer && data.activeTimer.endsAt > Date.now()) {
            setTimerState(data.activeTimer);
            startLocalTimerTicker(data.activeTimer.endsAt);
          }

          setLoading(false);
        }
      );
    });

    socket.on('disconnect', () => {
      setSocketStatus('disconnected');
      toast.socket(false);
    });

    socket.on('connect_error', () => {
      setSocketStatus('disconnected');
    });

    socket.on('results_updated', ({ questionId, options }) => {
      setCurrentQuestion((prev) => {
        if (!prev || prev.id !== questionId) return prev;
        return { ...prev, options };
      });
    });

    socket.on('question_changed', ({ question, totalQuestions }) => {
      setCurrentQuestion(question);
      setShowAnswer(false);
      clearTimer();
      if (totalQuestions !== undefined) {
        setRoomMeta((prev) => (prev ? { ...prev, totalQuestions } : prev));
      }
    });

    socket.on('voting_status_changed', ({ questionId, isLocked }) => {
      setCurrentQuestion((prev) => {
        if (!prev || prev.id !== questionId) return prev;
        return { ...prev, isLocked };
      });
    });

    socket.on('participant_count_updated', ({ count }) => {
      setParticipantCount(count);
    });

    // Timer broadcast listeners
    socket.on('timer_started', ({ endsAt, duration }) => {
      setTimerState({ endsAt, duration, remainingSeconds: duration });
      startLocalTimerTicker(endsAt);
      toast.info(`⏱️ Timer started (${duration}s)`);
    });

    socket.on('timer_ended', () => {
      clearTimer();
      toast.info("⏱️ Time's up! Voting locked.");
    });

    socket.on('timer_stopped', () => {
      clearTimer();
      toast.info('⏱️ Timer stopped.');
    });

    socket.on('room_error', ({ message }) => {
      toast.error(message);
    });

    socket.on('auth_error', ({ message }) => {
      toast.error(message);
      logout();
      navigate('/login', { replace: true });
    });

    socket.connect();
    return socket;
  }, [pin, token, startLocalTimerTicker, clearTimer, logout, navigate]);

  useEffect(() => {
    const socket = setupSocket();
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('results_updated');
      socket.off('question_changed');
      socket.off('voting_status_changed');
      socket.off('participant_count_updated');
      socket.off('timer_started');
      socket.off('timer_ended');
      socket.off('timer_stopped');
      socket.off('room_error');
      socket.off('auth_error');
      clearTimer();
      disconnectSocket();
    };
  }, [setupSocket, clearTimer]);

  // ─── Presenter Actions ─────────────────────────────────────────
  const handleNextQuestion = () => {
    socketRef.current?.emit('next_question', { pin }, (res) => {
      if (!res.success) toast.error(res.error || 'Failed to advance question.');
    });
  };

  const handleToggleLock = () => {
    socketRef.current?.emit(
      'toggle_voting_lock',
      { pin, questionId: currentQuestion?.id, isLocked: !currentQuestion?.isLocked },
      (res) => {
        if (!res.success) toast.error(res.error || 'Failed to toggle voting lock.');
      }
    );
  };

  const handleStartTimer = (seconds) => {
    socketRef.current?.emit('start_timer', { pin, duration: seconds }, (res) => {
      if (!res.success) toast.error(res.error || 'Failed to start timer.');
    });
  };

  const handleStopTimer = () => {
    socketRef.current?.emit('stop_timer', { pin }, (res) => {
      if (!res.success) toast.error(res.error || 'Failed to stop timer.');
    });
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const res = await api.get(`/rooms/${pin}/export`);
      exportPollToPDF(res.data.data);
      toast.success('PDF report generated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate PDF report.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleEndPoll = async () => {
    const shouldClose = confirm(
      'Do you want to permanently CLOSE this session so voters can no longer submit votes?\n\nClick [OK] to Close Session and Return\nClick [Cancel] to keep session active'
    );

    if (shouldClose) {
      try {
        await api.patch(`/rooms/${pin}/status`, { status: 'ended' });
        toast.info('Poll session closed. Returning to dashboard.');
      } catch (err) {
        toast.error('Failed to close session.');
      }
    }
    navigate('/dashboard');
  };

  // ─── Render Guards ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-mono">Connecting to Room {pin}...</p>
      </div>
    );
  }

  const isLastQuestion =
    roomMeta?.totalQuestions && currentQuestion
      ? currentQuestion.order >= roomMeta.totalQuestions
      : false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ─── TOP BAR ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Left: Back + Title */}
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-slate-200 truncate">
              {roomMeta?.title || `Room ${pin}`}
            </p>
          </div>

          {/* Center: PIN Display + Active Timer Badge */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-1.5 shadow-inner">
              <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">PIN</span>
              <span className="text-emerald-400 font-black text-xl font-mono tracking-widest">{pin}</span>
            </div>

            {timerState && (
              <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5 animate-pulse">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-amber-300 font-mono font-bold text-sm">
                  {timerState.remainingSeconds}s
                </span>
              </div>
            )}
          </div>

          {/* Right: Stats + Connection */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-400">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-mono font-semibold text-sky-400">{participantCount}</span>
              <span>live</span>
            </div>
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-400">
              <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-mono font-semibold text-purple-400">{totalVotes}</span>
              <span>votes</span>
            </div>
            <div className="flex items-center space-x-1.5">
              {socketStatus === 'connected' ? (
                <span className="flex items-center space-x-1 text-xs text-emerald-400">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span className="hidden sm:inline">Live</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-xs text-red-400">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Disconnected</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ──────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT / CENTER: Question + Results */}
        <div className="lg:col-span-2 flex flex-col space-y-5">

          {/* Question Progress & Timer Alert */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Question <strong className="text-slate-300">{currentQuestion?.order}</strong>{' '}
              of <strong className="text-slate-300">{roomMeta?.totalQuestions}</strong>
            </span>

            <div className="flex items-center space-x-3">
              {timerState && (
                <span className="text-amber-400 font-medium flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Countdown: {timerState.remainingSeconds}s</span>
                </span>
              )}
              <span className={`flex items-center space-x-1.5 font-medium ${currentQuestion?.isLocked ? 'text-red-400' : 'text-emerald-400'}`}>
                {currentQuestion?.isLocked ? (
                  <><Lock className="w-3 h-3" /><span>Voting Locked</span></>
                ) : (
                  <><CheckCircle className="w-3 h-3" /><span>Voting Open</span></>
                )}
              </span>
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <p className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug">
              {currentQuestion?.text || 'No active question'}
            </p>
          </div>

          {/* Animated Result Bars */}
          <div className="flex-1">
            <ResultBars
              options={currentQuestion?.options || []}
              showAnswer={showAnswer}
            />
          </div>

          {/* Mobile Stats */}
          <div className="flex sm:hidden items-center justify-around bg-slate-900/60 border border-slate-800 rounded-xl py-3 px-4 text-sm">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-sky-400">{participantCount}</span>
              <span className="text-slate-500 text-xs">Live</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex items-center space-x-2">
              <BarChart2 className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-purple-400">{totalVotes}</span>
              <span className="text-slate-500 text-xs">Votes</span>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: QR + Controls */}
        <div className="flex flex-col space-y-5">

          {/* QR Code */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-center">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Join via QR Code
            </p>
            <div className="inline-block bg-white p-3 rounded-xl shadow-lg mb-3">
              <QRCodeSVG
                value={joinUrl}
                size={160}
                level="M"
                fgColor="#0f172a"
                bgColor="#ffffff"
              />
            </div>
            <p className="text-xs text-slate-500 break-all">{joinUrl}</p>
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-center space-x-2">
              <span className="text-xs text-slate-500">or join at</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {window.location.host}/join
              </span>
            </div>
          </div>

          {/* Control Dock */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Presenter Controls
            </p>

            {/* Countdown Timer Module */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Countdown Timer</span>
                </span>
                {timerState && (
                  <span className="font-mono text-amber-400 font-bold">
                    {timerState.remainingSeconds}s left
                  </span>
                )}
              </div>

              {timerState ? (
                <button
                  onClick={handleStopTimer}
                  className="w-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-semibold py-1.5 rounded-lg text-xs transition"
                >
                  Stop Countdown
                </button>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {[15, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => handleStartTimer(sec)}
                      className="bg-slate-800 hover:bg-emerald-500/20 border border-slate-700 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 py-1.5 rounded-lg text-xs font-mono font-medium transition"
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lock / Unlock Voting */}
            <button
              onClick={handleToggleLock}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border font-semibold text-sm transition-all duration-200
                ${currentQuestion?.isLocked
                  ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                }`}
            >
              <span className="flex items-center space-x-2">
                {currentQuestion?.isLocked ? (
                  <><Lock className="w-4 h-4" /><span>Unlock Voting</span></>
                ) : (
                  <><Unlock className="w-4 h-4" /><span>Lock Voting</span></>
                )}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                currentQuestion?.isLocked
                  ? 'bg-red-500/20 text-red-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {currentQuestion?.isLocked ? 'Locked' : 'Open'}
              </span>
            </button>

            {/* Show / Hide Correct Answer */}
            <button
              onClick={() => setShowAnswer((p) => !p)}
              className={`w-full flex items-center space-x-2 px-4 py-3 rounded-xl border font-semibold text-sm transition-all duration-200
                ${showAnswer
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
            >
              {showAnswer ? (
                <><EyeOff className="w-4 h-4" /><span>Hide Answer</span></>
              ) : (
                <><Eye className="w-4 h-4" /><span>Show Answer</span></>
              )}
            </button>

            {/* Next Question */}
            <button
              onClick={handleNextQuestion}
              disabled={isLastQuestion}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border font-semibold text-sm transition-all duration-200
                bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20
                disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-sky-500/10"
            >
              <span className="flex items-center space-x-2">
                <ChevronRight className="w-4 h-4" />
                <span>{isLastQuestion ? 'Last Question' : 'Next Question'}</span>
              </span>
              {!isLastQuestion && currentQuestion && (
                <span className="text-xs text-sky-500/70 font-mono">
                  {currentQuestion.order}/{roomMeta?.totalQuestions}
                </span>
              )}
            </button>

            {/* One-Click PDF Report Download */}
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition"
            >
              {pdfLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              ) : (
                <FileText className="w-4 h-4 text-emerald-400" />
              )}
              <span>Download PDF Report</span>
            </button>

            {/* Divider */}
            <div className="h-px bg-slate-800 my-1" />

            {/* End Poll */}
            <button
              onClick={handleEndPoll}
              className="w-full flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/5 font-medium text-xs transition-all duration-200"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Exit / Close Session</span>
            </button>
          </div>

          {/* Room Info */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 text-xs text-slate-500 space-y-1.5">
            <div className="flex justify-between">
              <span>Session PIN</span>
              <span className="font-mono font-bold text-emerald-400">{pin}</span>
            </div>
            <div className="flex justify-between">
              <span>Questions</span>
              <span className="text-slate-300">{roomMeta?.totalQuestions}</span>
            </div>
            <div className="flex justify-between">
              <span>Current Q</span>
              <span className="text-slate-300">#{currentQuestion?.order}</span>
            </div>
            <div className="flex justify-between">
              <span>Participants</span>
              <span className="text-sky-400">{participantCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Votes</span>
              <span className="text-purple-400">{totalVotes}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PresenterPage;
