import expressAsync from "express-async-handler";
import leaseServices from "../services/leaseServices.js";

const createLease = expressAsync(async (req, res) => {
  try {
    const contractFile =
      req.files && req.files["contract"] && req.files["contract"][0]
        ? req.files["contract"][0]
        : null;

    const leaseData = req.body;
    const io = req.app && req.app.get ? req.app.get("io") : null;
    const result = await leaseServices.createLease(leaseData, contractFile, io);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating lease:", error);
    res
      .status(400)
      .json({ message: error.message || "Failed to create lease" });
  }
});

const getAllLeases = expressAsync(async (req, res) => {
  try {
    const result = await leaseServices.getAllLeases(req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting leases:", error);
    res.status(400).json({ message: error.message || "Failed to get leases" });
  }
});

const getSingleLeaseById = expressAsync(async (req, res) => {
  try {
    const leaseId = req.params.id;
    const result = await leaseServices.getSingleLeaseById(leaseId);
    res.status(200).json({ lease: result });
  } catch (error) {
    console.error("Error getting lease:", error);
    res.status(400).json({ message: error.message || "Failed to get lease" });
  }
});

const getLeaseByUserId = expressAsync(async (req, res) => {
  try {
    const userId = req.params.userId;
    const result = await leaseServices.getLeaseByUserId(userId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting leases by user:", error);
    res
      .status(400)
      .json({ message: error.message || "Failed to get leases by user" });
  }
});

const updateLeaseById = expressAsync(async (req, res) => {
  try {
    const leaseId = req.params.id;
    const leaseData = req.body;
    const contractFile =
      req.files && req.files["contract"] && req.files["contract"][0]
        ? req.files["contract"][0]
        : null;

    const io = req.app && req.app.get ? req.app.get("io") : null;
    const result = await leaseServices.updateLeaseById(
      leaseId,
      leaseData,
      contractFile,
      io
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating lease:", error);
    res
      .status(400)
      .json({ message: error.message || "Failed to update lease" });
  }
});

const deleteLeaseById = expressAsync(async (req, res) => {
  try {
    const leaseId = req.params.id;
    const result = await leaseServices.deleteLeaseById(leaseId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error deleting lease:", error);
    res
      .status(400)
      .json({ message: error.message || "Failed to delete lease" });
  }
});

const terminateLease = expressAsync(async (req, res) => {
  try {
    const leaseId = req.params.id;
    const terminationData = req.body || {};
    const io = req.app && req.app.get ? req.app.get("io") : null;
    const result = await leaseServices.terminateLease(
      leaseId,
      terminationData,
      io
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error terminating lease:", error);
    res
      .status(400)
      .json({ message: error.message || "Failed to terminate lease" });
  }
});

const renewLease = expressAsync(async (req, res) => {
  try {
    const leaseId = req.params.id;
    const renewalData = req.body || {};
    const io = req.app && req.app.get ? req.app.get("io") : null;
    const result = await leaseServices.renewLease(leaseId, renewalData, io);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error renewing lease:", error);
    res.status(400).json({ message: error.message || "Failed to renew lease" });
  }
});

export {
  createLease,
  getAllLeases,
  getSingleLeaseById,
  getLeaseByUserId,
  updateLeaseById,
  deleteLeaseById,
  terminateLease,
  renewLease,
};
