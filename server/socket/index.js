const { Room, Question, VoteLog } = require('../models');
const { verifyToken } = require('../utils/token');

const initSocketServer = (io) => {
  // Room participant counter helper
  const getParticipantCount = (pin) => {
    const roomChannel = io.sockets.adapter.rooms.get(`room:${pin}`);
    return roomChannel ? roomChannel.size : 0;
  };

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ==========================================
    // 1. JOIN ROOM (Presenter or Voter)
    // ==========================================
    socket.on('join_room', async (payload, callback) => {
      try {
        const { pin, role = 'voter', voterToken, token } = payload || {};

        if (!pin) {
          const err = { code: 'INVALID_PAYLOAD', message: 'Room PIN is required.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        const normalizedPin = pin.toString().toUpperCase().trim();
        const room = await Room.findOne({ pin: normalizedPin });

        if (!room) {
          const err = { code: 'ROOM_NOT_FOUND', message: `Room with PIN ${normalizedPin} does not exist.` };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('room_error', err);
        }

        if (room.status === 'ended') {
          const err = { code: 'ROOM_ENDED', message: 'This poll session has ended.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('room_error', err);
        }

        // Presenter authorization check
        let isPresenter = false;
        if (role === 'presenter') {
          if (!token) {
            const err = { code: 'AUTH_REQUIRED', message: 'Authentication token required for presenter role.' };
            if (callback) callback({ success: false, error: err.message });
            return socket.emit('auth_error', err);
          }

          const decoded = verifyToken(token);
          if (!decoded || !room.presenterId.equals(decoded.id)) {
            const err = { code: 'AUTH_FAILED', message: 'Unauthorized presenter credentials for this room.' };
            if (callback) callback({ success: false, error: err.message });
            return socket.emit('auth_error', err);
          }
          isPresenter = true;
        }

        const channel = `room:${normalizedPin}`;
        socket.join(channel);

        // Save metadata on socket
        socket.data.pin = normalizedPin;
        socket.data.role = isPresenter ? 'presenter' : 'voter';
        socket.data.voterToken = voterToken || null;

        // Fetch current active question and question set
        const questions = await Question.find({ roomId: room._id }).sort({ order: 1 });
        const totalQuestions = questions.length;

        let activeQuestion = null;
        if (room.activeQuestionId) {
          activeQuestion = questions.find((q) => q._id.equals(room.activeQuestionId));
        }
        if (!activeQuestion && questions.length > 0) {
          activeQuestion = questions[0];
          room.activeQuestionId = activeQuestion._id;
          await room.save();
        }

        // Check if this voter already voted on current question
        let hasVoted = false;
        let votedOptionId = null;

        if (activeQuestion && voterToken) {
          const voteLog = await VoteLog.findOne({
            questionId: activeQuestion._id,
            voterToken,
          });
          if (voteLog) {
            hasVoted = true;
            votedOptionId = voteLog.votedOptionId;
          }
        }

        const participantCount = getParticipantCount(normalizedPin);

        const roomState = {
          pin: room.pin,
          title: room.title,
          status: room.status,
          role: socket.data.role,
          participantCount,
          totalQuestions,
          currentQuestion: activeQuestion
            ? {
                id: activeQuestion._id,
                order: activeQuestion.order,
                text: activeQuestion.text,
                options: activeQuestion.options,
                isLocked: activeQuestion.isLocked || room.status === 'locked',
              }
            : null,
          hasVoted,
          votedOptionId,
        };

        // Emit current state to the joining socket
        socket.emit('room_state', roomState);

        // Notify entire room of updated headcount
        io.to(channel).emit('participant_count_updated', {
          pin: normalizedPin,
          count: participantCount,
        });

        console.log(`[Socket] ${socket.id} (${socket.data.role}) joined ${channel}. Participants: ${participantCount}`);

        if (callback) {
          callback({ success: true, data: roomState });
        }
      } catch (error) {
        console.error('[Socket join_room Error]', error);
        socket.emit('error', { message: 'Failed to join room: ' + error.message });
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ==========================================
    // 2. STATE CONTROL: NEXT / SWITCH QUESTION
    // ==========================================
    socket.on('next_question', async (payload, callback) => {
      try {
        const { pin, questionId } = payload || {};
        const normalizedPin = (pin || socket.data.pin || '').toString().toUpperCase().trim();

        if (socket.data.role !== 'presenter') {
          const err = { message: 'Only the presenter can advance or change questions.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        const room = await Room.findOne({ pin: normalizedPin });
        if (!room) {
          const err = { message: 'Room not found.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        const questions = await Question.find({ roomId: room._id }).sort({ order: 1 });
        if (!questions.length) {
          const err = { message: 'No questions found for this room.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        let nextQuestion = null;

        if (questionId) {
          nextQuestion = questions.find((q) => q._id.toString() === questionId.toString());
        } else {
          // Advance to the question following current activeQuestionId
          const currentIndex = questions.findIndex(
            (q) => room.activeQuestionId && q._id.equals(room.activeQuestionId)
          );
          if (currentIndex !== -1 && currentIndex + 1 < questions.length) {
            nextQuestion = questions[currentIndex + 1];
          } else {
            nextQuestion = questions[0]; // Loop or stay at first
          }
        }

        if (!nextQuestion) {
          const err = { message: 'Target question not found.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        // Update active question in database
        room.activeQuestionId = nextQuestion._id;
        await room.save();

        const channel = `room:${normalizedPin}`;

        const questionPayload = {
          question: {
            id: nextQuestion._id,
            order: nextQuestion.order,
            text: nextQuestion.text,
            options: nextQuestion.options,
            isLocked: nextQuestion.isLocked || room.status === 'locked',
          },
          totalQuestions: questions.length,
        };

        // Broadcast new question to all clients in the room
        io.to(channel).emit('question_changed', questionPayload);

        console.log(`[Socket] Room ${normalizedPin} question changed to #${nextQuestion.order} (${nextQuestion._id})`);

        if (callback) {
          callback({ success: true, data: questionPayload });
        }
      } catch (error) {
        console.error('[Socket next_question Error]', error);
        socket.emit('error', { message: 'Failed to switch question: ' + error.message });
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ==========================================
    // 3. STATE CONTROL: TOGGLE VOTING LOCK
    // ==========================================
    socket.on('toggle_voting_lock', async (payload, callback) => {
      try {
        const { pin, questionId, isLocked } = payload || {};
        const normalizedPin = (pin || socket.data.pin || '').toString().toUpperCase().trim();

        if (socket.data.role !== 'presenter') {
          const err = { message: 'Only the presenter can lock or unlock voting.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        const room = await Room.findOne({ pin: normalizedPin });
        if (!room) {
          const err = { message: 'Room not found.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        const targetQuestionId = questionId || room.activeQuestionId;
        if (!targetQuestionId) {
          const err = { message: 'No active question to lock/unlock.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        const question = await Question.findById(targetQuestionId);
        if (!question) {
          const err = { message: 'Question not found.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        // Toggle or set state
        const newLockState = typeof isLocked === 'boolean' ? isLocked : !question.isLocked;
        question.isLocked = newLockState;
        await question.save();

        const channel = `room:${normalizedPin}`;
        const broadcastPayload = {
          questionId: question._id,
          isLocked: newLockState,
        };

        io.to(channel).emit('voting_status_changed', broadcastPayload);

        console.log(`[Socket] Room ${normalizedPin} Question ${question._id} isLocked set to ${newLockState}`);

        if (callback) {
          callback({ success: true, data: broadcastPayload });
        }
      } catch (error) {
        console.error('[Socket toggle_voting_lock Error]', error);
        socket.emit('error', { message: 'Failed to toggle voting lock: ' + error.message });
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ==========================================
    // 4. VOTING ENGINE (Atomic & Idempotent)
    // ==========================================
    socket.on('cast_vote', async (payload, callback) => {
      try {
        const { pin, questionId, optionId, voterToken } = payload || {};
        const normalizedPin = (pin || socket.data.pin || '').toString().toUpperCase().trim();

        if (!normalizedPin || !questionId || !optionId || !voterToken) {
          const err = {
            code: 'INVALID_PAYLOAD',
            message: 'PIN, questionId, optionId, and voterToken are all required to cast a vote.',
          };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        // Step 1: Validate room state
        const room = await Room.findOne({ pin: normalizedPin });
        if (!room) {
          const err = { code: 'ROOM_NOT_FOUND', message: 'Room not found.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        if (room.status !== 'active') {
          const err = {
            code: 'ROOM_INACTIVE',
            message: `Voting is closed. Room is currently ${room.status}.`,
          };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('voting_status_changed', { isLocked: true, message: err.message });
        }

        // Step 2: Validate question state
        const question = await Question.findById(questionId);
        if (!question || !question.roomId.equals(room._id)) {
          const err = { code: 'QUESTION_NOT_FOUND', message: 'Question does not belong to this room.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        if (question.isLocked) {
          const err = {
            code: 'VOTING_LOCKED',
            message: 'Voting on this question is locked by the presenter.',
          };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        // Validate option existence
        const optionExists = question.options.some((opt) => opt.id === optionId);
        if (!optionExists) {
          const err = { code: 'INVALID_OPTION', message: 'Selected option does not exist.' };
          if (callback) callback({ success: false, error: err.message });
          return socket.emit('error', err);
        }

        // Step 3: Fast-path duplicate check
        const existingVote = await VoteLog.findOne({
          questionId,
          voterToken,
        });

        if (existingVote) {
          const err = {
            code: 'ALREADY_VOTED',
            message: 'You have already voted on this question.',
            votedOptionId: existingVote.votedOptionId,
          };
          if (callback) callback({ success: false, error: err.message, votedOptionId: existingVote.votedOptionId });
          return socket.emit('already_voted', err);
        }

        // Step 4: Atomic insertion into VoteLog with duplicate key (11000) race condition trap
        try {
          await VoteLog.create({
            roomId: room._id,
            questionId,
            voterToken,
            votedOptionId: optionId,
          });
        } catch (dbErr) {
          // MongoDB E11000 duplicate key error on compound unique index { questionId: 1, voterToken: 1 }
          if (dbErr.code === 11000) {
            const err = {
              code: 'ALREADY_VOTED',
              message: 'You have already voted on this question.',
            };
            if (callback) callback({ success: false, error: err.message });
            return socket.emit('already_voted', err);
          }
          throw dbErr;
        }

        // Step 5: Atomically increment option voteCount
        await Question.updateOne(
          { _id: questionId, 'options.id': optionId },
          { $inc: { 'options.$.voteCount': 1 } }
        );

        // Step 6: Fetch updated options tally
        const updatedQuestion = await Question.findById(questionId).select('options');

        const channel = `room:${normalizedPin}`;
        const resultsPayload = {
          questionId,
          options: updatedQuestion.options,
        };

        // Broadcast real-time results update to all participants and presenter
        io.to(channel).emit('results_updated', resultsPayload);

        // Confirm vote to the voter socket
        const confirmationPayload = {
          questionId,
          optionId,
          message: 'Vote registered successfully.',
        };
        socket.emit('vote_confirmed', confirmationPayload);

        console.log(`[Socket] Vote logged: Room ${normalizedPin}, Question ${questionId}, Option ${optionId}`);

        if (callback) {
          callback({ success: true, data: confirmationPayload });
        }
      } catch (error) {
        console.error('[Socket cast_vote Error]', error);
        socket.emit('error', { message: 'Failed to record vote: ' + error.message });
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ==========================================
    // 5. DISCONNECT & HEADCOUNT CLEANUP
    // ==========================================
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} (Reason: ${reason})`);
      if (socket.data.pin) {
        const channel = `room:${socket.data.pin}`;
        const remaining = getParticipantCount(socket.data.pin);
        io.to(channel).emit('participant_count_updated', {
          pin: socket.data.pin,
          count: remaining,
        });
      }
    });
  });
};

module.exports = initSocketServer;

