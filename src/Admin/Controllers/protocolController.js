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

    if (!stage.stage_type || !VALID_STAGE_TYPES.includes(stage.stage_type)) {
      return `Stage at index ${i}: invalid "stage_type". Allowed: ${VALID_STAGE_TYPES.join(', ')}`;
    }
    if (stage.duration_days === undefined || isNaN(stage.duration_days) || stage.duration_days < 0) {
      return `Stage at index ${i}: "duration_days" must be a non-negative number.`;
    }
    if (stage.session_duration_minutes !== undefined && (isNaN(stage.session_duration_minutes) || stage.session_duration_minutes <= 0)) {
      return `Stage at index ${i}: "session_duration_minutes" must be a positive integer.`;
    }
  }

  return null; // no error
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/protocols — Create a new Therapy Protocol (Deep Insert)
// ─────────────────────────────────────────────────────────────────────────────
const createProtocol = async (req, res) => {
  try {
    const { name, therapy_type, clinic_id, created_by, stages = [] } = req.body;

    // Required field validation
    const missing = [];
    if (!name?.trim())         missing.push('name');
    if (!therapy_type?.trim()) missing.push('therapy_type');
    if (!clinic_id)            missing.push('clinic_id');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // Enum validation: therapy_type
    if (!VALID_THERAPY_TYPES.includes(therapy_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid therapy_type "${therapy_type}". Allowed: ${VALID_THERAPY_TYPES.join(', ')}`,
      });
    }

    // Validate nested stages if provided
    if (stages.length > 0) {
      const stageError = validateStages(stages);
      if (stageError) {
        return res.status(400).json({ success: false, message: stageError });
      }
    }

    const newProtocol = await protocolService.createProtocol({
      name: name.trim(),
      therapy_type,
      clinic_id: parseInt(clinic_id, 10),
      created_by: created_by || null,
      stages,
    });

    return res.status(201).json({
      success: true,
      message: 'Therapy Protocol created successfully.',
      data: newProtocol,
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
// Query params: ?clinic_id=1  &  ?therapy_type=Vamana  &  ?is_active=true
// ─────────────────────────────────────────────────────────────────────────────
const getAllProtocols = async (req, res) => {
  try {
    const { clinic_id, therapy_type, is_active } = req.query;

    if (therapy_type && !VALID_THERAPY_TYPES.includes(therapy_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid therapy_type filter. Allowed: ${VALID_THERAPY_TYPES.join(', ')}`,
      });
    }

    const protocols = await protocolService.getAllProtocols({
      clinic_id: clinic_id ? parseInt(clinic_id, 10) : undefined,
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
    const protocolId = parseInt(req.params.id, 10);

    if (isNaN(protocolId)) {
      return res.status(400).json({ success: false, message: 'Invalid protocol ID.' });
    }

    const protocol = await protocolService.getProtocolById(protocolId);

    if (!protocol) {
      return res.status(404).json({ success: false, message: 'Therapy Protocol not found.' });
    }

    return res.status(200).json({ success: true, data: protocol });
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
    const protocolId = parseInt(req.params.id, 10);

    if (isNaN(protocolId)) {
      return res.status(400).json({ success: false, message: 'Invalid protocol ID.' });
    }

    const { name, therapy_type, is_active, stages } = req.body;

    // Validate therapy_type if provided
    if (therapy_type && !VALID_THERAPY_TYPES.includes(therapy_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid therapy_type. Allowed: ${VALID_THERAPY_TYPES.join(', ')}`,
      });
    }

    // Validate stages if provided
    if (stages !== undefined) {
      const stageError = validateStages(stages);
      if (stageError) {
        return res.status(400).json({ success: false, message: stageError });
      }
    }

    const updated = await protocolService.updateProtocol(protocolId, {
      name: name?.trim(),
      therapy_type,
      is_active,
      stages,
    });

    return res.status(200).json({
      success: true,
      message: 'Therapy Protocol updated successfully.',
      data: updated,
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
// DELETE /api/protocols/:id — Soft-delete (sets is_active = FALSE)
// ─────────────────────────────────────────────────────────────────────────────
const deleteProtocol = async (req, res) => {
  try {
    const protocolId = parseInt(req.params.id, 10);

    if (isNaN(protocolId)) {
      return res.status(400).json({ success: false, message: 'Invalid protocol ID.' });
    }

    const deleted = await protocolService.deleteProtocol(protocolId);

    return res.status(200).json({
      success: true,
      message: 'Therapy Protocol deactivated (soft-deleted) successfully.',
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
