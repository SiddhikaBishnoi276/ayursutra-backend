const staffService = require('../Services/staffService');
const { sendStaffCredentialsEmail } = require('../../Common/utils/emailService');

// Allowed values from schema
const VALID_ROLES = ['doctor', 'therapist'];
const VALID_GENDERS = ['Male', 'Female', 'Other'];
const VALID_SPECIALIZATIONS = ['Vamana', 'Virechana', 'Basti', 'Nasya', 'Raktamokshana'];
const VALID_STATUSES = ['Active', 'Suspended'];

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/staff — Create a new Doctor or Therapist
// ─────────────────────────────────────────────────────────────────────────────
const createStaff = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      gender,
      role,
      clinic_id,
      created_by,
      // Doctor fields
      qualification,
      registration_number,
      // Therapist fields
      specializations,
    } = req.body;

    // Default password to 'password@123' if omitted
    const DEFAULT_STAFF_PASSWORD = 'password@123';
    const staffPassword = (typeof password === 'string' && password.trim())
      ? password.trim()
      : DEFAULT_STAFF_PASSWORD;

    const resolvedClinicId = clinic_id || req.user?.clinic_id || 1;
    const resolvedCreatedBy = created_by || req.user?.id || null;

    // — Required field validation —
    const missing = [];
    if (!name?.trim())     missing.push('name');
    if (!phone?.trim())    missing.push('phone');
    if (!role?.trim())     missing.push('role');
    if (!resolvedClinicId) missing.push('clinic_id');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // — Role validation —
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }

    // — Gender validation (optional field) —
    if (gender && !VALID_GENDERS.includes(gender)) {
      return res.status(400).json({
        success: false,
        message: `Invalid gender. Must be one of: ${VALID_GENDERS.join(', ')}`,
      });
    }

    // — Specialization validation for therapists —
    if (role === 'therapist' && specializations?.length > 0) {
      const invalidSpecs = specializations.filter(
        (s) => !VALID_SPECIALIZATIONS.includes(s)
      );
      if (invalidSpecs.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid specialization(s): ${invalidSpecs.join(', ')}. Allowed: ${VALID_SPECIALIZATIONS.join(', ')}`,
        });
      }
    }

    const newStaff = await staffService.createStaff({
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone.trim(),
      password: staffPassword,
      gender: gender || null,
      role,
      clinic_id: parseInt(resolvedClinicId, 10),
      created_by: resolvedCreatedBy,
      qualification: qualification || null,
      registration_number: registration_number || null,
      specializations: specializations || [],
    });

    // Asynchronously dispatch welcome credentials email (non-blocking)
    const recipientEmail = newStaff.email || (email?.trim() || null);
    if (recipientEmail) {
      sendStaffCredentialsEmail({
        toEmail: recipientEmail,
        name: newStaff.name || name.trim(),
        role: newStaff.role || role,
        phone: newStaff.phone || phone.trim(),
        password: staffPassword,
      }).catch((emailErr) => {
        console.error('[createStaff] Non-blocking email dispatch failed:', emailErr.message || emailErr);
      });
    }

    return res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully.`,
      data: newStaff,
    });
  } catch (err) {
    // Handle unique constraint violations (phone/email)
    if (err.code === '23505') {
      const field = err.detail?.includes('phone') ? 'phone' : 'email';
      return res.status(409).json({
        success: false,
        message: `A user with this ${field} already exists.`,
      });
    }
    // Handle foreign key violations (invalid clinic_id etc.)
    if (err.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reference: clinic_id or created_by does not exist.',
      });
    }
    console.error('[createStaff]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/staff — List all staff with optional filters
// Query params: ?role=doctor|therapist  &  ?status=Active|Engaged|Suspended  &  ?clinic_id=1
// ─────────────────────────────────────────────────────────────────────────────
const getAllStaff = async (req, res) => {
  try {
    const { role, status } = req.query;
    const rawClinicId = req.query.clinic_id || req.user?.clinic_id;
    const clinic_id = rawClinicId ? parseInt(rawClinicId, 10) : undefined;

    // Validate optional role filter
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role filter. Must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }

    // Validate optional status filter
    const validStatusFilters = ['Active', 'Engaged', 'Suspended'];
    if (status && !validStatusFilters.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status filter. Must be one of: ${validStatusFilters.join(', ')}`,
      });
    }

    const staff = await staffService.getAllStaff({ role, status, clinic_id });

    return res.status(200).json({
      success: true,
      count: staff.length,
      data: staff,
    });
  } catch (err) {
    console.error('[getAllStaff]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/staff/:id/status — Update status of a staff member
// Body: { status: 'Active' | 'Suspended' }
// ─────────────────────────────────────────────────────────────────────────────
const updateStaffStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: status',
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}. Note: "Engaged" is a system-derived status and cannot be set manually.`,
      });
    }

    const updated = await staffService.updateStaffStatus(id, status);

    return res.status(200).json({
      success: true,
      message: `Staff status updated to "${status}" successfully.`,
      data: updated,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.statusCode === 409) {
      return res.status(409).json({ success: false, message: err.message });
    }
    console.error('[updateStaffStatus]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = { createStaff, getAllStaff, updateStaffStatus };
