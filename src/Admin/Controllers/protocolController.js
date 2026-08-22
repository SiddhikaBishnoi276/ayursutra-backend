// src/Admin/Controllers/protocolController.js
const protocolService = require('../Services/protocolService');

// Allowed enums from schema.sql constraints
const VALID_THERAPY_TYPES = ['Vamana', 'Virechana', 'Basti', 'Nasya', 'Raktamokshana'];
const VALID_STAGE_TYPES = ['Poorvakarma', 'Pradhanakarma', 'Paschatkarma'];

// ── Helper: Validate stages array ────────────────────────────────────────────
const validateStages = (stages) => {
  if (!Array.isArray(stages)) {
    return '"stages" must be an array.';
  }

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const stageType = stage.stage_type || stage.stageCategory || stage.category;

    if (stageType && !VALID_STAGE_TYPES.some((t) => t.toLowerCase() === String(stageType).toLowerCase())) {
      return `Stage at index ${i}: invalid "stage_type". Allowed: ${VALID_STAGE_TYPES.join(', ')}`;
    }
    const days = stage.duration_days ?? stage.durationDays;
    if (days !== undefined && (isNaN(days) || Number(days) < 0)) {
      return `Stage at index ${i}: "duration_days" must be a non-negative number.`;
    }
    const mins = stage.session_duration_minutes ?? stage.durationMinutes;
    if (mins !== undefined && (isNaN(mins) || Number(mins) <= 0)) {
      return `Stage at index ${i}: "session_duration_minutes" must be a positive integer.`;
    }
  }

  return null; // no error
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/protocols (or /api/admin/packages) — Create a new Therapy Protocol
// ─────────────────────────────────────────────────────────────────────────────
const createProtocol = async (req, res) => {
  try {
    const {
      name,
      therapy_type,
      targetDosha,
      description,
      base_price,
      clinic_id,
      created_by,
      stages = [],
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: name',
      });
    }

    const resolvedClinicId = req.user?.clinic_id || clinic_id || 1;
    const resolvedTherapyType = protocolService.sanitizeTherapyType(therapy_type || targetDosha);

    // Validate nested stages if provided
    if (stages.length > 0) {
      const stageError = validateStages(stages);
      if (stageError) {
        return res.status(400).json({ success: false, message: stageError });
      }
    }

    const newProtocol = await protocolService.createProtocol({
      name: name.trim(),
      therapy_type: resolvedTherapyType,
      description: description?.trim() || undefined,
      base_price: base_price !== undefined ? parseFloat(base_price) : undefined,
      clinic_id: parseInt(resolvedClinicId, 10),
      created_by: created_by || req.user?.id || null,
      stages,
    });

    return res.status(201).json({
      success: true,
      message: 'Therapy Protocol created successfully.',
      data: newProtocol,
      ...newProtocol,
    });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reference: clinic_id or created_by does not exist.',
      });
    }
    console.error('[createProtocol]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/protocols — List all protocols with optional filters
// ─────────────────────────────────────────────────────────────────────────────
const getAllProtocols = async (req, res) => {
  try {
    const { clinic_id, therapy_type, is_active } = req.query;

    const resolvedClinicId = clinic_id || req.user?.clinic_id;

    const protocols = await protocolService.getAllProtocols({
      clinic_id: resolvedClinicId ? parseInt(resolvedClinicId, 10) : undefined,
      therapy_type,
      is_active,
    });

    return res.status(200).json({
      success: true,
      count: protocols.length,
      data: protocols,
    });
  } catch (err) {
    console.error('[getAllProtocols]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/protocols/:id — Retrieve single protocol with ordered child stages
// ─────────────────────────────────────────────────────────────────────────────
const getProtocolById = async (req, res) => {
  try {
    const rawId = req.params.id.replace(/^PKG-/, '');
    const protocolId = parseInt(rawId, 10);

    if (isNaN(protocolId)) {
      return res.status(400).json({ success: false, message: 'Invalid protocol ID.' });
    }

    const protocol = await protocolService.getProtocolById(protocolId);

    if (!protocol) {
      return res.status(404).json({ success: false, message: 'Therapy Protocol not found.' });
    }

    return res.status(200).json({ success: true, data: protocol, ...protocol });
  } catch (err) {
    console.error('[getProtocolById]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT/PATCH /api/protocols/:id — Update protocol & optionally replace stages
// ─────────────────────────────────────────────────────────────────────────────
const updateProtocol = async (req, res) => {
  try {
    const rawId = req.params.id.replace(/^PKG-/, '');
    const protocolId = parseInt(rawId, 10);

    if (isNaN(protocolId)) {
      return res.status(400).json({ success: false, message: 'Invalid protocol ID.' });
    }

    const { name, therapy_type, targetDosha, description, base_price, is_active, stages } = req.body;

    const resolvedTherapyType = therapy_type || targetDosha
      ? protocolService.sanitizeTherapyType(therapy_type || targetDosha)
      : undefined;

    if (stages && Array.isArray(stages)) {
      const stageError = validateStages(stages);
      if (stageError) {
        return res.status(400).json({ success: false, message: stageError });
      }
    }

    const updated = await protocolService.updateProtocol(protocolId, {
      name,
      therapy_type: resolvedTherapyType,
      description,
      base_price,
      is_active,
      stages,
    });

    return res.status(200).json({
      success: true,
      message: 'Therapy Protocol updated successfully.',
      data: updated,
      ...updated,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('[updateProtocol]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/protocols/:id — Soft-delete protocol (sets is_active = false)
// ─────────────────────────────────────────────────────────────────────────────
const deleteProtocol = async (req, res) => {
  try {
    const rawId = req.params.id.replace(/^PKG-/, '');
    const protocolId = parseInt(rawId, 10);

    if (isNaN(protocolId)) {
      return res.status(400).json({ success: false, message: 'Invalid protocol ID.' });
    }

    const deleted = await protocolService.deleteProtocol(protocolId);

    return res.status(200).json({
      success: true,
      message: 'Therapy Protocol deactivated successfully.',
      data: deleted,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('[deleteProtocol]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  createProtocol,
  getAllProtocols,
  getProtocolById,
  updateProtocol,
  deleteProtocol,
};
