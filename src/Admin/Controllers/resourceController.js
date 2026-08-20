const { getClinicResources } = require('../Services/resourceService');

async function getResourcesHandler(req, res) {
  try {
    const { clinicId } = req.params;
    const data = await getClinicResources(clinicId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getResourcesHandler };
