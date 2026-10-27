import React from 'react';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const OPTION_COLORS = [
  { bar: 'bg-emerald-500', glow: 'shadow-emerald-500/30', text: 'text-emerald-400', label: 'bg-emerald-500 text-slate-950' },
  { bar: 'bg-sky-500',     glow: 'shadow-sky-500/30',     text: 'text-sky-400',     label: 'bg-sky-500 text-slate-950' },
  { bar: 'bg-violet-500',  glow: 'shadow-violet-500/30',  text: 'text-violet-400',  label: 'bg-violet-500 text-slate-950' },
  { bar: 'bg-amber-500',   glow: 'shadow-amber-500/30',   text: 'text-amber-400',   label: 'bg-amber-500 text-slate-950' },
  { bar: 'bg-rose-500',    glow: 'shadow-rose-500/30',    text: 'text-rose-400',    label: 'bg-rose-500 text-slate-950' },
  { bar: 'bg-teal-500',    glow: 'shadow-teal-500/30',    text: 'text-teal-400',    label: 'bg-teal-500 text-slate-950' },
];

const ResultBar = ({ option, index, percentage, totalVotes, isWinner, showAnswer, correctOptionId }) => {
  const color = OPTION_COLORS[index % OPTION_COLORS.length];
  const label = OPTION_LABELS[index];
  const isCorrect = showAnswer && correctOptionId && option.id === correctOptionId;
  const isIncorrect = showAnswer && correctOptionId && option.id !== correctOptionId;

  return (
    <div
      className={`relative bg-slate-800/60 border rounded-xl overflow-hidden transition-all duration-300
        ${isCorrect ? 'border-emerald-400 ring-1 ring-emerald-400/40' : ''}
        ${isIncorrect ? 'border-slate-700/40 opacity-60' : 'border-slate-700/60'}
        ${isWinner && !isIncorrect ? 'border-opacity-100' : ''}
      `}
    >
      {/* Animated Fill Bar */}
      <div
        className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out opacity-20 ${color.bar}`}
        style={{ width: `${percentage}%` }}
      />
      {/* Foreground Content */}
      <div className="relative flex items-center px-4 py-3 space-x-3">
        {/* Option Letter Badge */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg text-xs font-black flex items-center justify-center shadow ${color.label}`}>
          {label}
        </div>

        {/* Option Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug truncate ${isIncorrect ? 'text-slate-500' : 'text-slate-100'}`}>
            {option.text}
          </p>
          {isCorrect && (
            <span className="text-xs text-emerald-400 font-semibold">✓ Correct Answer</span>
          )}
        </div>

        {/* Percentage + Count */}
        <div className="flex-shrink-0 text-right">
          <p className={`text-lg font-black tabular-nums ${isIncorrect ? 'text-slate-600' : color.text}`}>
            {percentage.toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500 tabular-nums">{option.voteCount} vote{option.voteCount !== 1 ? 's' : ''}</p>
        </div>

        {/* Winner crown for leading option */}
        {isWinner && !isIncorrect && percentage > 0 && (
          <div className="absolute top-2 right-2 text-amber-400 text-xs">👑</div>
        )}
      </div>
    </div>
  );
};

const ResultBars = ({ options = [], showAnswer = false, correctOptionId = null }) => {
  const totalVotes = options.reduce((sum, o) => sum + (o.voteCount || 0), 0);
  const maxVotes = Math.max(...options.map((o) => o.voteCount || 0), 1);

  return (
    <div className="space-y-3">
      {options.map((option, index) => {
        const percentage = totalVotes > 0 ? ((option.voteCount || 0) / totalVotes) * 100 : 0;
        const isWinner = (option.voteCount || 0) === maxVotes && maxVotes > 0;
        return (
          <ResultBar
            key={option.id}
            option={option}
            index={index}
            percentage={percentage}
            totalVotes={totalVotes}
            isWinner={isWinner}
            showAnswer={showAnswer}
            correctOptionId={correctOptionId}
          />
        );
      })}
      {totalVotes === 0 && (
        <p className="text-center text-slate-600 text-sm py-4">
          Waiting for votes...
        </p>
      )}
    </div>
  );
};

export default ResultBars;

