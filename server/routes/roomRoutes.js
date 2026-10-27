const express = require('express');
const router = express.Router();
const {
  getMyRooms,
  createRoom,
  verifyRoom,
  exportRoomResults,
  getRoomDetails,
} = require('../controllers/roomController');
const { protect } = require('../middleware/auth');

// Protected presenter routes
router.get('/my-rooms', protect, getMyRooms);
router.post('/', protect, createRoom);

// Public verification route
router.get('/verify/:pin', verifyRoom);

// Single room details & export
router.get('/:pin/export', protect, exportRoomResults);
router.get('/:pin', protect, getRoomDetails);

module.exports = router;

