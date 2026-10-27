const mongoose = require('mongoose');

const voteLogSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room ID is required'],
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: [true, 'Question ID is required'],
      index: true,
    },
    voterToken: {
      type: String,
      required: [true, 'Voter token is required'],
      trim: true,
    },
    votedOptionId: {
      type: String,
      required: [true, 'Voted option ID is required'],
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // 24 hours in seconds (MongoDB TTL index)
    },
  },
  {
    timestamps: false,
  }
);

// Compound unique index to guarantee idempotency and prevent duplicate votes per voter per question
voteLogSchema.index({ questionId: 1, voterToken: 1 }, { unique: true });

module.exports = mongoose.model('VoteLog', voteLogSchema);

