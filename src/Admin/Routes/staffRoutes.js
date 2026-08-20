const express = require('express');
const router = express.Router();
const staffController = require('../Controllers/staffController');

// POST   /api/staff          — Create a new Doctor or Therapist
router.post('/', staffController.createStaff);

// GET    /api/staff          — List all staff (filter: ?role=doctor|therapist  &  ?status=Active|Engaged|Suspended  &  ?clinic_id=1)
router.get('/', staffController.getAllStaff);

// PATCH  /api/staff/:id/status — Update staff member status (Active | Suspended)
router.patch('/:id/status', staffController.updateStaffStatus);

module.exports = router;
