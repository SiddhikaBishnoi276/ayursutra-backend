const { listTherapists } = require('../Services/therapistService');

async function listTherapistsHandler(req, res) {
  try {
    const clinicId = req.user.clinic_id;
    const therapists = await listTherapists(clinicId);
    res.json(therapists);
  } catch (err) {
    console.error('Error in listTherapistsHandler:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { listTherapistsHandler };
