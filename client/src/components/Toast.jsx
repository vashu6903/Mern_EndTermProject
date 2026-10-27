import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X, Wifi, WifiOff } from 'lucide-react';

let toastId = 0;
let globalAddToast = null;

export const toast = {
  success: (msg, opts) => globalAddToast?.({ type: 'success', message: msg, ...opts }),
  error: (msg, opts) => globalAddToast?.({ type: 'error', message: msg, ...opts }),
  info: (msg, opts) => globalAddToast?.({ type: 'info', message: msg, ...opts }),
  socket: (connected) =>
    globalAddToast?.({
      type: connected ? 'success' : 'error',
      message: connected ? 'Live connection established' : 'Connection lost. Reconnecting...',
      duration: connected ? 2500 : 4000,
      icon: connected ? 'wifi' : 'wifioff',
    }),
};

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  wifi: Wifi,
  wifioff: WifiOff,
};

const STYLES = {
  success: 'bg-emerald-900/80 border-emerald-500/40 text-emerald-100',
  error: 'bg-red-900/80 border-red-500/40 text-red-100',
  info: 'bg-slate-800/90 border-slate-600/40 text-slate-100',
};

const ICON_STYLES = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-sky-400',
};

const ToastItem = ({ id, type, message, icon, onRemove }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleRemove = () => {
    setVisible(false);
    setTimeout(() => onRemove(id), 300);
  };

  const IconComponent = ICONS[icon] || ICONS[type];

  return (
    <div
      className={`flex items-start space-x-3 px-4 py-3 rounded-xl border backdrop-blur shadow-xl max-w-sm
        transition-all duration-300 ease-out cursor-pointer
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
        ${STYLES[type]}`}
      onClick={handleRemove}
    >
      <IconComponent className={`w-4 h-4 mt-0.5 flex-shrink-0 ${ICON_STYLES[type]}`} />
      <p className="text-sm font-medium flex-1">{message}</p>
      <X className="w-3.5 h-3.5 flex-shrink-0 opacity-60 hover:opacity-100 mt-0.5" />
    </div>
  );
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    globalAddToast = (opts) => {
      const id = ++toastId;
      const duration = opts.duration ?? 3000;
      setToasts((prev) => [...prev, { id, ...opts }]);
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    };
    return () => { globalAddToast = null; };
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem {...t} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
};

