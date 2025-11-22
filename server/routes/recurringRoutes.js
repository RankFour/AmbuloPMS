import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import recurringGen from "../services/recurringGenerationService.js";

const router = express.Router();

router.post("/generate", protect, async (req, res) => {
    try {
        if (!req.user || req.user.role !== "ADMIN") {
            return res
                .status(403)
                .json({ message: "Forbidden: Admin role required" });
        }
        const lookaheadDays = Number(req.body.lookaheadDays || 14);
        const dryRun = req.body.dryRun === true || req.body.dryRun === "true";
        const results = await recurringGen.generateUpcomingRecurringCharges({
            lookaheadDays,
            dryRun,
        });
        res.json({ results, lookaheadDays, dryRun });
    } catch (e) {
        console.error("[RecurringGenRoute] Error:", e);
        res
            .status(500)
            .json({ message: "Recurring generation failed", error: e.message });
    }
});

export default router;
