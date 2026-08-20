const { listPackages } = require('../Services/packageService');

async function listPackagesHandler(req, res) {
  try {
    const packages = await listPackages(req.user.clinic_id);
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { listPackagesHandler };
