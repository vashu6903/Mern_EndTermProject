const { Room, Question, VoteLog } = require('../models');

// Helper to generate a collision-free 4-digit PIN
const generateUniquePIN = async () => {
  let pin;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 20) {
    attempts++;
    // Generate 4-digit random number between 1000 and 9999
    pin = Math.floor(1000 + Math.random() * 9000).toString();
    const existing = await Room.findOne({ pin }).select('_id');
    if (!existing) {
      exists = false;
    }
  }

  if (exists) {
    // Fallback: 6-character alphanumeric string if 4-digit space is dense
    pin = Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  return pin;
};

// @desc    Get all rooms created by authenticated presenter
// @route   GET /api/rooms/my-rooms
// @access  Private (Presenter)
const getMyRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find({ presenterId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    // Attach question count and total vote tally to each room
    const enrichedRooms = await Promise.all(
      rooms.map(async (room) => {
        const questions = await Question.find({ roomId: room._id })
          .sort({ order: 1 })
          .select('text order options isLocked')
          .lean();

        let totalVotes = 0;
        questions.forEach((q) => {
          if (Array.isArray(q.options)) {
            q.options.forEach((opt) => {
              totalVotes += opt.voteCount || 0;
            });
          }
        });

        return {
          ...room,
          questionCount: questions.length,
          totalVotes,
          questions,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: enrichedRooms.length,
      data: enrichedRooms,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new room with questions & generate 4-digit PIN
// @route   POST /api/rooms
// @access  Private (Presenter)
const createRoom = async (req, res, next) => {
  try {
    const { title, questions } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Room title is required.',
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one question is required to create a poll room.',
      });
    }

    // Validate questions and options structure
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text || !q.text.trim()) {
        return res.status(400).json({
          success: false,
          error: `Question #${i + 1} is missing question text.`,
        });
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return res.status(400).json({
          success: false,
          error: `Question #${i + 1} must have at least 2 options.`,
        });
      }
      for (let j = 0; j < q.options.length; j++) {
        const opt = q.options[j];
        const optText = typeof opt === 'string' ? opt : opt.text;
        if (!optText || !optText.trim()) {
          return res.status(400).json({
            success: false,
            error: `Question #${i + 1}, Option #${j + 1} cannot be empty.`,
          });
        }
      }
    }

    // Generate unique 4-digit PIN
    const pin = await generateUniquePIN();

    // Create Room document
    const room = await Room.create({
      pin,
      presenterId: req.user._id,
      title: title.trim(),
      status: 'active',
      activeQuestionId: null,
    });

    // Format and persist Questions
    const questionsToInsert = questions.map((q, index) => ({
      roomId: room._id,
      order: index + 1,
      text: q.text.trim(),
      options: q.options.map((opt, optIdx) => {
        const text = typeof opt === 'string' ? opt.trim() : opt.text.trim();
        const id = (typeof opt === 'object' && opt.id) ? opt.id : `opt_${optIdx + 1}`;
        return {
          id,
          text,
          voteCount: 0,
        };
      }),
      isLocked: false,
    }));

    const createdQuestions = await Question.insertMany(questionsToInsert);

    // Set first question as active
    room.activeQuestionId = createdQuestions[0]._id;
    await room.save();

    return res.status(201).json({
      success: true,
      data: {
        room: {
          _id: room._id,
          pin: room.pin,
          title: room.title,
          status: room.status,
          activeQuestionId: room.activeQuestionId,
          createdAt: room.createdAt,
        },
        questions: createdQuestions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Public endpoint to verify room existence & status by PIN
// @route   GET /api/rooms/verify/:pin
// @access  Public (Voters & Participants)
const verifyRoom = async (req, res, next) => {
  try {
    const pin = (req.params.pin || '').toUpperCase().trim();

    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a room PIN.',
      });
    }

    const room = await Room.findOne({ pin }).select(
      'pin title status activeQuestionId createdAt'
    );

    if (!room) {
      return res.status(404).json({
        success: false,
        error: `Room with PIN ${pin} was not found or has expired.`,
      });
    }

    if (room.status === 'ended') {
      return res.status(410).json({
        success: false,
        error: 'This poll session has ended.',
        data: {
          pin: room.pin,
          title: room.title,
          status: room.status,
        },
      });
    }

    const questionCount = await Question.countDocuments({ roomId: room._id });

    return res.status(200).json({
      success: true,
      data: {
        pin: room.pin,
        title: room.title,
        status: room.status,
        hasActiveQuestion: !!room.activeQuestionId,
        questionCount,
        createdAt: room.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export room vote tallies and summary (JSON or CSV)
// @route   GET /api/rooms/:pin/export
// @access  Private (Presenter)
const exportRoomResults = async (req, res, next) => {
  try {
    const pin = (req.params.pin || '').toUpperCase().trim();

    const room = await Room.findOne({ pin });
    if (!room) {
      return res.status(404).json({
        success: false,
        error: `Room with PIN ${pin} not found.`,
      });
    }

    // Verify ownership: presenter must own the room
    if (!room.presenterId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to export analytics for this room.',
      });
    }

    const questions = await Question.find({ roomId: room._id })
      .sort({ order: 1 })
      .lean();

    const totalVotersCount = await VoteLog.distinct('voterToken', {
      roomId: room._id,
    });

    const exportData = {
      room: {
        id: room._id,
        pin: room.pin,
        title: room.title,
        status: room.status,
        createdAt: room.createdAt,
        totalUniqueVoters: totalVotersCount.length,
      },
      questions: questions.map((q) => {
        const questionTotalVotes = q.options.reduce(
          (sum, opt) => sum + (opt.voteCount || 0),
          0
        );
        return {
          order: q.order,
          text: q.text,
          isLocked: q.isLocked,
          totalVotes: questionTotalVotes,
          options: q.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            voteCount: opt.voteCount,
            percentage:
              questionTotalVotes > 0
                ? Number(((opt.voteCount / questionTotalVotes) * 100).toFixed(1))
                : 0,
          })),
        };
      }),
    };

    // CSV format requested
    if (req.query.format === 'csv') {
      const rows = [
        ['Room PIN', room.pin],
        ['Title', `"${room.title.replace(/"/g, '""')}"`],
        ['Status', room.status],
        ['Created At', room.createdAt.toISOString()],
        ['Total Unique Voters', totalVotersCount.length],
        [],
        ['Question #', 'Question Text', 'Option ID', 'Option Text', 'Votes', 'Percentage'],
      ];

      exportData.questions.forEach((q) => {
        q.options.forEach((opt) => {
          rows.push([
            q.order,
            `"${q.text.replace(/"/g, '""')}"`,
            opt.id,
            `"${opt.text.replace(/"/g, '""')}"`,
            opt.voteCount,
            `${opt.percentage}%`,
          ]);
        });
      });

      const csvContent = rows.map((r) => r.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="QuickPoll_${room.pin}_Export.csv"`
      );
      return res.status(200).send(csvContent);
    }

    // Default JSON format
    return res.status(200).json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get full room details (for Presenter live control)
// @route   GET /api/rooms/:pin
// @access  Private (Presenter)
const getRoomDetails = async (req, res, next) => {
  try {
    const pin = (req.params.pin || '').toUpperCase().trim();

    const room = await Room.findOne({ pin });
    if (!room) {
      return res.status(404).json({
        success: false,
        error: `Room with PIN ${pin} not found.`,
      });
    }

    if (!room.presenterId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You are not the presenter of this room.',
      });
    }

    const questions = await Question.find({ roomId: room._id }).sort({ order: 1 });

    return res.status(200).json({
      success: true,
      data: {
        room,
        questions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update room status ('active', 'locked', 'ended')
// @route   PATCH /api/rooms/:pin/status
// @access  Private (Presenter)
const updateRoomStatus = async (req, res, next) => {
  try {
    const pin = (req.params.pin || '').toUpperCase().trim();
    const { status } = req.body;

    if (!['draft', 'active', 'locked', 'ended'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be draft, active, locked, or ended.',
      });
    }

    const room = await Room.findOne({ pin });
    if (!room) {
      return res.status(404).json({
        success: false,
        error: `Room with PIN ${pin} not found.`,
      });
    }

    if (!room.presenterId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You are not the presenter of this room.',
      });
    }

    room.status = status;
    await room.save();

    // Broadcast status change via Socket.io if available
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${pin}`).emit('room_status_changed', {
        pin,
        status,
        message:
          status === 'ended'
            ? 'The poll session has been closed by the presenter.'
            : `Room status updated to ${status}.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: room,
      message: `Room status updated to ${status}.`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete room and all associated questions & vote logs
// @route   DELETE /api/rooms/:pin
// @access  Private (Presenter)
const deleteRoom = async (req, res, next) => {
  try {
    const pin = (req.params.pin || '').toUpperCase().trim();

    const room = await Room.findOne({ pin });
    if (!room) {
      return res.status(404).json({
        success: false,
        error: `Room with PIN ${pin} not found.`,
      });
    }

    if (!room.presenterId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You are not the presenter of this room.',
      });
    }

    // Cascade delete questions and vote logs
    await Promise.all([
      Question.deleteMany({ roomId: room._id }),
      VoteLog.deleteMany({ roomId: room._id }),
      Room.deleteOne({ _id: room._id }),
    ]);

    // Notify connected sockets that room was removed
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${pin}`).emit('room_deleted', {
        pin,
        message: 'This poll room has been deleted by the presenter.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Room ${pin} and all associated data were successfully deleted.`,
    });
  } catch (error) {
    next(error);
  }
};

const { generatePollQuestions } = require('../services/aiService');

// @desc    Generate questions using AI (Gemini / OpenAI / Smart Domain Engine)
// @route   POST /api/rooms/generate-ai
// @access  Private (Presenter)
const generateQuestionsAI = async (req, res, next) => {
  try {
    const { topic, count, difficulty, customApiKey } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a topic or subject for question generation.',
      });
    }

    const result = await generatePollQuestions({
      topic: topic.trim(),
      count: count || 3,
      difficulty: difficulty || 'intermediate',
      customApiKey: customApiKey ? customApiKey.trim() : '',
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyRooms,
  createRoom,
  verifyRoom,
  exportRoomResults,
  getRoomDetails,
  updateRoomStatus,
  deleteRoom,
  generateQuestionsAI,
};

