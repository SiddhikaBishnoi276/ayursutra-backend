const express = require('express');
const router = express.Router();
const roomController = require('../Controllers/roomController');
const { protect } = require('../../Common/Middleware/authMiddleware');

// IMPORTANT: /occupancy must be registered BEFORE /:id routes
// to prevent Express from treating "occupancy" as a dynamic :id segment

// GET    /api/rooms/occupancy — Real-time occupancy status of all rooms
router.get('/occupancy', protect, roomController.getRoomOccupancy);

// POST   /api/rooms           — Add a new room
router.post('/', protect, roomController.createRoom);

// GET    /api/rooms            — Retrieve all rooms
router.get('/', protect, roomController.getAllRooms);

// PATCH  /api/rooms/:id/status — Update a room's status
router.patch('/:id/status', protect, roomController.updateRoomStatus);

module.exports = router;
