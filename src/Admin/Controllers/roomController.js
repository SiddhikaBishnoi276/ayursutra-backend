const roomService = require('../Services/roomService');

// Allowed room statuses from schema
const VALID_ROOM_STATUSES = ['available', 'occupied', 'under_maintenance'];

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rooms — Add a new room
// ─────────────────────────────────────────────────────────────────────────────
const createRoom = async (req, res) => {
  try {
    const { name, clinic_id, status } = req.body;

    // — Required field validation —
    const missing = [];
    if (!name?.trim()) missing.push('name');
    if (!clinic_id)    missing.push('clinic_id');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // — Status validation (optional, defaults to 'available') —
    if (status && !VALID_ROOM_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_ROOM_STATUSES.join(', ')}`,
      });
    }

    const newRoom = await roomService.createRoom({
      name: name.trim(),
      clinic_id,
      status: status || 'available',
    });

    return res.status(201).json({
      success: true,
      message: 'Room created successfully.',
      data: newRoom,
    });
  } catch (err) {
    // Handle foreign key violations (invalid clinic_id)
    if (err.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Invalid clinic_id: clinic does not exist.',
      });
    }
    console.error('[createRoom]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rooms — Retrieve all rooms
// Query params: ?clinic_id=1
// ─────────────────────────────────────────────────────────────────────────────
const getAllRooms = async (req, res) => {
  try {
    const { clinic_id } = req.query;

    const rooms = await roomService.getAllRooms(clinic_id);

    return res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms,
    });
  } catch (err) {
    console.error('[getAllRooms]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rooms/occupancy — Real-time occupancy status of all rooms
// Query params: ?clinic_id=1
// ─────────────────────────────────────────────────────────────────────────────
const getRoomOccupancy = async (req, res) => {
  try {
    const { clinic_id } = req.query;

    const occupancy = await roomService.getRoomOccupancy(clinic_id);

    // Build summary counts
    const summary = occupancy.reduce(
      (acc, room) => {
        const key = room.occupancy_status.toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { available: 0, occupied: 0, maintenance: 0 }
    );

    return res.status(200).json({
      success: true,
      count: occupancy.length,
      summary,
      data: occupancy,
    });
  } catch (err) {
    console.error('[getRoomOccupancy]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { createRoom, getAllRooms, getRoomOccupancy };
