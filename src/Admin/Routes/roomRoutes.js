const express = require('express');
const router = express.Router();
const roomController = require('../Controllers/roomController');

// IMPORTANT: /occupancy must be registered BEFORE /:id routes
// to prevent Express from treating "occupancy" as a dynamic :id segment

// GET    /api/rooms/occupancy — Real-time occupancy status of all rooms
router.get('/occupancy', roomController.getRoomOccupancy);

// POST   /api/rooms           — Add a new room
router.post('/', roomController.createRoom);

// GET    /api/rooms            — Retrieve all rooms
router.get('/', roomController.getAllRooms);

module.exports = router;
