const express = require('express');
const router = express.Router();
const protocolController = require('../Controllers/protocolController');
const { protect } = require('../../Common/Middleware/authMiddleware');

// POST   /api/protocols       — Create a new Therapy Protocol (with nested stages)
router.post('/', protect, protocolController.createProtocol);

// GET    /api/protocols       — List all protocols (filters: ?clinic_id&therapy_type&is_active)
router.get('/', protect, protocolController.getAllProtocols);

// GET    /api/protocols/:id   — Retrieve single protocol with deeply fetched ordered stages
router.get('/:id', protect, protocolController.getProtocolById);

// PUT    /api/protocols/:id   — Full update of protocol & replace nested stages
router.put('/:id', protect, protocolController.updateProtocol);

// PATCH  /api/protocols/:id   — Partial update of protocol fields and/or stages
router.patch('/:id', protect, protocolController.updateProtocol);

// DELETE /api/protocols/:id   — Soft-delete protocol (sets is_active = false)
router.delete('/:id', protect, protocolController.deleteProtocol);

module.exports = router;

