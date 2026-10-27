const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    pin: {
      type: String,
      required: [true, 'Room PIN is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 4,
      maxlength: 6,
      match: [/^[A-Z0-9]{4,6}$/, 'PIN must be 4 or 6 uppercase alphanumeric characters'],
      index: true,
    },
    presenterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Presenter ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Room title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'active', 'locked', 'ended'],
        message: '{VALUE} is not a valid room status',
      },
      default: 'draft',
      index: true,
    },
    activeQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // 24 hours in seconds (MongoDB TTL index)
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Room', roomSchema);

