const roomService = require('../Services/roomService');

// Allowed room statuses from schema
const VALID_ROOM_STATUSES = ['available', 'occupied', 'under_maintenance'];

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rooms — Add a new room
// Accepts: { name, room_type, clinic_id, status }
// Maps payload strictly to existing rooms table columns (id, name, clinic_id, status).
// ─────────────────────────────────────────────────────────────────────────────
const createRoom = async (req, res) => {
  try {
    const { name, room_type, clinic_id, status } = req.body;

    const resolvedClinicId = clinic_id || req.user?.clinic_id || 1;

    // — Required field validation —
    const missing = [];
    if (!name?.trim()) missing.push('name');
    if (!resolvedClinicId) missing.push('clinic_id');

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
        message: `Invalid status "${status}". Must be one of: ${VALID_ROOM_STATUSES.join(', ')}`,
      });
    }

    const newRoom = await roomService.createRoom({
      name: name.trim(),
      room_type,
      clinic_id: parseInt(resolvedClinicId, 10),
      status: status || 'available',
    });

    return res.status(201).json({
      success: true,
      message: 'Therapy room created successfully.',
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
    const rawClinicId = req.query.clinic_id || req.user?.clinic_id;
    const clinic_id = rawClinicId ? parseInt(rawClinicId, 10) : undefined;

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
// GET /api/rooms/occupancy — Detailed Real-time Room Occupancy & Status Tracking
// Joins active sessions to return assigned therapist details & session timing.
// Query params: ?clinic_id=1
// ─────────────────────────────────────────────────────────────────────────────
const getRoomOccupancy = async (req, res) => {
  try {
    const rawClinicId = req.query.clinic_id || req.user?.clinic_id;
    const clinic_id = rawClinicId ? parseInt(rawClinicId, 10) : undefined;

    const occupancy = await roomService.getRoomOccupancy(clinic_id);


    // Summary count of room statuses
    const summary = occupancy.reduce(
      (acc, room) => {
        const statusKey = (room.status || room.occupancy_status || 'available').toLowerCase();
        const key = statusKey === 'under maintenance' || statusKey === 'under_maintenance' ? 'maintenance' : statusKey;
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

const updateRoomStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const updatedRoom = await roomService.updateRoomStatus(id, status);
    res.status(200).json({ success: true, data: updatedRoom });
  } catch (err) {
    if (err.message === 'Room not found') {
      return res.status(404).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = {
  createRoom,
  getAllRooms,
  getRoomOccupancy,
  updateRoomStatus
};
