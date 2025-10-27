import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  getFinancialReport,
  getTenantReport,
  getPropertyLeaseReport,
  getMaintenanceReport,
} from "../controllers/reportsControllers.js";

const router = express.Router();

router.get('/', protect, (req, res) => {
  res.json({
    endpoints: [
      { path: '/financial', query: ['from','to','propertyId','tenantId','groupBy=month|quarter|year','format=json|csv'] },
      { path: '/tenants', query: ['from','to','propertyId','format=json|csv'] },
      { path: '/properties', query: ['from','to','format=json|csv'] },
      { path: '/maintenance', query: ['from','to','propertyId','format=json|csv'] }
    ]
  });
});
router.get('/financial', protect, getFinancialReport);
router.get('/tenants', protect, getTenantReport);
router.get('/properties', protect, getPropertyLeaseReport);
router.get('/maintenance', protect, getMaintenanceReport);

export default router;
