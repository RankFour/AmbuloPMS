import expressAsync from "express-async-handler";
import leaseServices from "../services/leaseServices.js";

const createLease = expressAsync(async (req, res) => {
  try {
    const contractFile =
      req.files && req.files["contract"] && req.files["contract"][0]
        ? req.files["contract"][0]
        : null;

    const leaseData = req.body;
    const result = await leaseServices.createLease(leaseData, contractFile);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating lease:", error);
    res.status(400).json({ message: error.message || "Failed to create lease" });
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
    res.status(200).json(result);
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
    res.status(400).json({ message: error.message || "Failed to get leases by user" });
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

    const result = await leaseServices.updateLeaseById(leaseId, leaseData, contractFile);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating lease:", error);
    res.status(400).json({ message: error.message || "Failed to update lease" });
  }
});

const deleteLeaseById = expressAsync(async (req, res) => {
  try {
    const leaseId = req.params.id;
    const result = await leaseServices.deleteLeaseById(leaseId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error deleting lease:", error);
    res.status(400).json({ message: error.message || "Failed to delete lease" });
  }
});

export {
  createLease,
  getAllLeases,
  getSingleLeaseById,
  getLeaseByUserId,
  updateLeaseById,
  deleteLeaseById,
};