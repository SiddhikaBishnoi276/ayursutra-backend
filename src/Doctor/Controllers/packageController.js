const { listPackages, createPackage } = require('../Services/packageService');

async function listPackagesHandler(req, res) {
  try {
    const patientId = req.query.patientId || req.query.patient_id || null;
    const packages = await listPackages(req.user.clinic_id, patientId);
    res.json(packages);
  } catch (err) {
    console.error('Error in listPackagesHandler:', err);
    res.status(500).json({ error: err.message });
  }
}

async function createPackageHandler(req, res) {
  try {
    const packageData = req.body;
    if (!packageData.name) {
      return res.status(400).json({ error: 'Package name is required' });
    }
    const created = await createPackage(req.user, packageData);
    res.status(201).json(created);
  } catch (err) {
    console.error('Error in createPackageHandler:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { listPackagesHandler, createPackageHandler };
