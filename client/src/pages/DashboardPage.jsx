import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Plus, LogOut, Radio, Clock, Users,
  ChevronRight, Loader2, AlertCircle, Hash, Activity,
  FileText, Trash2, Power, RotateCcw, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { toast } from '../components/Toast';
import { exportPollToPDF } from '../lib/pdfExport';

const STATUS_COLORS = {
  active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  draft: 'text-slate-400 bg-slate-500/10 border-slate-600/20',
  locked: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  ended: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const STATUS_DOT = {
  active: 'bg-emerald-400',
  draft: 'bg-slate-400',
  locked: 'bg-amber-400',
  ended: 'bg-red-400',
};

const CreateRoomModal = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState([
    { text: '', options: ['', '', '', ''] },
  ]);
  const [loading, setLoading] = useState(false);

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { text: '', options: ['', '', '', ''] }]);
  };

  const updateQuestion = (qIdx, field, value) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, [field]: value } : q))
    );
  };

  const updateOption = (qIdx, oIdx, value) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.map((o, j) => (j === oIdx ? value : o)) }
          : q
      )
    );
  };

  const removeQuestion = (qIdx) => {
    setQuestions((prev) => prev.filter((_, i) => i !== qIdx));
  };

  const handleCreate = async () => {
    if (!title.trim()) return toast.error('Please provide a room title.');
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim()) return toast.error(`Question #${i + 1} needs text.`);
      const filledOpts = questions[i].options.filter((o) => o.trim());
      if (filledOpts.length < 2) return toast.error(`Question #${i + 1} needs at least 2 options.`);
    }

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        questions: questions.map((q, qIdx) => ({
          text: q.text.trim(),
          options: q.options
            .filter((o) => o.trim())
            .map((o, oIdx) => ({
              id: `q${qIdx + 1}_opt${oIdx + 1}`,
              text: o.trim(),
            })),
        })),
      };
      const res = await api.post('/rooms', payload);
      toast.success(`Room created! PIN: ${res.data.data.room.pin}`);
      onCreated(res.data.data.room);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Create New Poll Room</h2>
            <p className="text-xs text-slate-400 mt-0.5">A unique 4-digit PIN will be auto-generated</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-2xl leading-none transition">×</button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Room Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Intro to Algorithms Midterm Check"
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
            />
          </div>

          {/* Questions */}
          {questions.map((q, qIdx) => (
            <div key={qIdx} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Question {qIdx + 1}</span>
                {questions.length > 1 && (
                  <button onClick={() => removeQuestion(qIdx)} className="text-xs text-red-400 hover:text-red-300 transition">
                    Remove
                  </button>
                )}
              </div>
              <input
                type="text"
                value={q.text}
                onChange={(e) => updateQuestion(qIdx, 'text', e.target.value)}
                placeholder="Enter your question here..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
              />
              <div className="grid grid-cols-2 gap-2">
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-slate-500 w-5 flex-shrink-0">
                      {optionLetters[oIdx]}
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                      placeholder={`Option ${optionLetters[oIdx]}`}
                      className="flex-1 bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={addQuestion}
            className="w-full border border-dashed border-slate-700 hover:border-emerald-500/50 text-slate-400 hover:text-emerald-400 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Question</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-800 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900 text-slate-950 font-semibold px-5 py-2 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Create Room</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const RoomCard = ({ room, onOpen, onDownloadPDF, onToggleStatus, onDelete }) => {
  const [downloading, setDownloading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const totalVotes =
    room.questions?.reduce(
      (sum, q) => sum + (q.options?.reduce((s, o) => s + (o.voteCount || 0), 0) || 0),
      0
    ) || 0;

  const handlePDF = async (e) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await onDownloadPDF(room.pin);
    } finally {
      setDownloading(false);
    }
  };

  const handleStatus = async (e) => {
    e.stopPropagation();
    setStatusLoading(true);
    try {
      await onToggleStatus(room.pin, room.status);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to permanently delete room "${room.title}" (PIN: ${room.pin})? This cannot be undone.`)) {
      onDelete(room.pin);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1.5">
            <span
              className={`inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[room.status]}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[room.status]} ${room.status === 'active' ? 'animate-pulse' : ''}`} />
              <span className="capitalize">{room.status}</span>
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Created {new Date(room.createdAt).toLocaleDateString()}
            </span>
          </div>

          <h3 className="text-base font-semibold text-slate-100 truncate">
            {room.title}
          </h3>

          <div className="flex items-center space-x-4 mt-2 text-xs text-slate-400">
            <span className="flex items-center space-x-1">
              <Hash className="w-3.5 h-3.5 text-slate-500" />
              <span>PIN:</span>
              <span className="font-mono font-bold text-emerald-400">{room.pin}</span>
            </span>
            <span className="flex items-center space-x-1">
              <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
              <span>{room.questionCount || 0} questions</span>
            </span>
            <span className="flex items-center space-x-1">
              <Activity className="w-3.5 h-3.5 text-slate-500" />
              <span>{totalVotes} votes</span>
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2 flex-wrap sm:flex-nowrap">
          {/* PDF Report Download */}
          <button
            onClick={handlePDF}
            disabled={downloading}
            title="Download PDF Analytics Report"
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-medium transition"
          >
            {downloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden sm:inline">PDF Report</span>
          </button>

          {/* Close or Reopen Room */}
          {room.status === 'active' ? (
            <button
              onClick={handleStatus}
              disabled={statusLoading}
              title="Close Poll Session"
              className="flex items-center space-x-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-medium transition"
            >
              {statusLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Power className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Close</span>
            </button>
          ) : (
            <button
              onClick={handleStatus}
              disabled={statusLoading}
              title="Reopen Poll Session"
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-medium transition"
            >
              {statusLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="hidden sm:inline">Reopen</span>
            </button>
          )}

          {/* Delete Room */}
          <button
            onClick={handleDelete}
            title="Permanently Delete Room"
            className="flex items-center space-x-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-medium transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Open Presenter Display */}
          <button
            onClick={() => onOpen(room.pin)}
            className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-xl text-xs transition shadow-lg shadow-emerald-500/20"
          >
            <span>Open</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchRooms = async () => {
    try {
      const res = await api.get('/rooms/my-rooms');
      setRooms(res.data.data);
    } catch (err) {
      toast.error('Failed to load your rooms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleRoomCreated = (room) => {
    setShowCreate(false);
    navigate(`/presenter/${room.pin}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleDownloadPDF = async (pin) => {
    try {
      const res = await api.get(`/rooms/${pin}/export`);
      exportPollToPDF(res.data.data);
      toast.success(`PDF report downloaded for room ${pin}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate PDF report.');
    }
  };

  const handleToggleStatus = async (pin, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'ended' : 'active';
    try {
      await api.patch(`/rooms/${pin}/status`, { status: nextStatus });
      toast.success(nextStatus === 'ended' ? `Room ${pin} session closed.` : `Room ${pin} reopened.`);
      setRooms((prev) =>
        prev.map((r) => (r.pin === pin ? { ...r, status: nextStatus } : r))
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update room status.');
    }
  };

  const handleDeleteRoom = async (pin) => {
    try {
      await api.delete(`/rooms/${pin}`);
      toast.success(`Room ${pin} permanently deleted.`);
      setRooms((prev) => prev.filter((r) => r.pin !== pin));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete room.');
    }
  };

  const activeRooms = rooms.filter((r) => r.status === 'active');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </div>
            <span className="font-bold text-sm tracking-tight">
              QuickPoll<span className="text-emerald-400">Live</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-400">Dashboard</span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-sm text-slate-400 hidden sm:block">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 px-3 py-1.5 rounded-lg transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">
              Welcome back, <span className="text-emerald-400">{user?.name?.split(' ')[0]}</span>!
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              You have <strong className="text-slate-200">{rooms.length}</strong> room{rooms.length !== 1 ? 's' : ''} &bull;{' '}
              <strong className="text-emerald-400">{activeRooms.length} active</strong>
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Room</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Rooms', value: rooms.length, icon: BarChart3, color: 'text-slate-300' },
            { label: 'Active Now', value: activeRooms.length, icon: Radio, color: 'text-emerald-400' },
            { label: 'Total Questions', value: rooms.reduce((s, r) => s + (r.questionCount || 0), 0), icon: Hash, color: 'text-sky-400' },
            { label: 'Total Votes', value: rooms.reduce((s, r) => s + (r.totalVotes || 0), 0), icon: Users, color: 'text-purple-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-medium">{label}</span>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Rooms List */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Your Poll Rooms
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-16 space-x-3">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span className="text-slate-400 text-sm">Loading rooms...</span>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl">
              <BarChart3 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No rooms yet</p>
              <p className="text-slate-600 text-sm mt-1 mb-4">Create your first poll room to get started</p>
              <button
                onClick={() => setShowCreate(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition"
              >
                Create Room
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map((room) => (
                <RoomCard
                  key={room._id}
                  room={room}
                  onOpen={(pin) => navigate(`/presenter/${pin}`)}
                  onDownloadPDF={handleDownloadPDF}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDeleteRoom}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateRoomModal onClose={() => setShowCreate(false)} onCreated={handleRoomCreated} />
      )}
    </div>
  );
};

export default DashboardPage;
