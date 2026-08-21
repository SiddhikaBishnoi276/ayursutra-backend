// src/Doctor/Controllers/packageController.js
const { listPackages, createPackage } = require('../Services/packageService');

async function listPackagesHandler(req, res) {
  try {
    const patientId = req.query.patientId || req.query.patient_id || null;
    const clinicId = req.user?.clinic_id || req.query.clinic_id || 1;
    const packages = await listPackages(clinicId, patientId);
    res.json(packages);
  } catch (err) {
    console.error('Error in listPackagesHandler:', err);
    res.status(500).json({ error: err.message, success: false });
  }
}

async function createPackageHandler(req, res) {
  try {
    const packageData = req.body;
    if (!packageData.name || !packageData.name.trim()) {
      return res.status(400).json({
        error: 'Package name is required',
        message: 'Package name is required',
        success: false,
      });
    }
    const doctorUser = req.user || {
      id: packageData.created_by || null,
      clinic_id: packageData.clinic_id || 1,
      role: 'doctor',
    };
    const created = await createPackage(doctorUser, packageData);
    res.status(201).json({
      success: true,
      message: 'Therapy package created successfully.',
      data: created,
      ...created,
    });
  } catch (err) {
    console.error('Error in createPackageHandler:', err);
    res.status(500).json({ error: err.message, success: false });
  }
}

module.exports = { listPackagesHandler, createPackageHandler };
