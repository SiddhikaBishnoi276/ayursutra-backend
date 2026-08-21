const express = require('express');
const router = express.Router();
const staffController = require('../Controllers/staffController');
const { protect } = require('../../Common/Middleware/authMiddleware');

// POST   /api/staff          — Create a new Doctor or Therapist
router.post('/', protect, staffController.createStaff);

// GET    /api/staff          — List all staff (filter: ?role=doctor|therapist  &  ?status=Active|Engaged|Suspended  &  ?clinic_id=1)
router.get('/', protect, staffController.getAllStaff);

// PATCH  /api/staff/:id/status — Update staff member status (Active | Suspended)
router.patch('/:id/status', protect, staffController.updateStaffStatus);

module.exports = router;

