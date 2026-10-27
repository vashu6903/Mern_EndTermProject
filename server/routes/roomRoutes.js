const express = require('express');
const router = express.Router();
const {
  getMyRooms,
  createRoom,
  verifyRoom,
  exportRoomResults,
  getRoomDetails,
  updateRoomStatus,
  deleteRoom,
  generateQuestionsAI,
} = require('../controllers/roomController');
const { protect } = require('../middleware/auth');

// Protected presenter routes
router.get('/my-rooms', protect, getMyRooms);
router.post('/', protect, createRoom);
router.post('/generate-ai', protect, generateQuestionsAI);

// Public verification route
router.get('/verify/:pin', verifyRoom);

// Single room details & export
router.get('/:pin/export', protect, exportRoomResults);
router.get('/:pin', protect, getRoomDetails);
router.patch('/:pin/status', protect, updateRoomStatus);
router.delete('/:pin', protect, deleteRoom);

module.exports = router;

