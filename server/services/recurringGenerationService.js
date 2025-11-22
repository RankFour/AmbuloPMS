import conn from "../config/db.js";
import chargesServices from "./chargesServices.js";

const pool = await conn();

const FREQUENCY_MONTH_MAP = {
    Monthly: 1,
    Quarterly: 3,
    "Semi-annually": 6,
    Annually: 12,
};

function toDateOnly(date) {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function advanceDateByFrequency(dateStr, frequency) {
    const months = FREQUENCY_MONTH_MAP[frequency] || 1;
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();

    const advanced = new Date(year, month + months, day);
    return toDateOnly(advanced);
}

export async function generateUpcomingRecurringCharges({
    lookaheadDays = 14,
    dryRun = false,
} = {}) {
    const conn = await pool.getConnection();
    const results = [];
    try {
        const [templates] = await conn.query(
            `SELECT * FROM recurring_templates
        WHERE is_active = 1
          AND next_due BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
            [lookaheadDays]
        );

        for (const tmpl of templates) {
            const { template_id, next_due, auto_generate_until, frequency } = tmpl;

            if (
                auto_generate_until &&
                new Date(next_due) > new Date(auto_generate_until)
            ) {
                await conn.query(
                    "UPDATE recurring_templates SET is_active = 0 WHERE template_id = ?",
                    [template_id]
                );
                results.push({
                    template_id,
                    skipped: true,
                    reason: "past auto_generate_until; deactivated",
                });
                continue;
            }

            const [existing] = await conn.query(
                "SELECT charge_id FROM charges WHERE template_id = ? AND DATE(due_date) = DATE(?) LIMIT 1",
                [template_id, next_due]
            );
            if (existing.length) {
                results.push({
                    template_id,
                    skipped: true,
                    reason: "charge already exists for next_due",
                });
                continue;
            }

            if (dryRun) {
                results.push({ template_id, wouldCreate: true, next_due });
                continue;
            }

            const insertSql = `INSERT INTO charges (lease_id, charge_type, description, amount, charge_date, due_date, is_recurring, status, template_id)
                         VALUES (?, ?, ?, ?, NOW(), ?, 0, 'Unpaid', ?)`;
            await conn.query(insertSql, [
                tmpl.lease_id,
                tmpl.charge_type,
                tmpl.description,
                tmpl.amount,
                next_due,
                template_id,
            ]);

            const newNextDue = advanceDateByFrequency(next_due, frequency);
            let activeFlag = 1;
            if (
                auto_generate_until &&
                new Date(newNextDue) > new Date(auto_generate_until)
            ) {
                activeFlag = 0;
            }
            await conn.query(
                "UPDATE recurring_templates SET next_due = ?, is_active = ? WHERE template_id = ?",
                [newNextDue, activeFlag, template_id]
            );

            results.push({
                template_id,
                created: true,
                charge_due: next_due,
                next_due: newNextDue,
                deactivated: activeFlag === 0,
            });
        }
    } catch (e) {
        console.error("[RecurringGen] Error generating recurring charges", e);
        results.push({ error: e.message });
    } finally {
        conn.release();
    }
    return results;
}

let intervalHandle = null;

export function startRecurringGenerationJob(
    app,
    { intervalMinutes = 15, lookaheadDays = 14 } = {}
) {
    const run = async () => {
        const res = await generateUpcomingRecurringCharges({ lookaheadDays });

        try {
            const io = app.get("io");
            if (io) io.emit("recurring-generation-cycle", res);
        } catch {
            /* noop */
        }
    };

    run();

    if (intervalHandle) clearInterval(intervalHandle);
    intervalHandle = setInterval(run, intervalMinutes * 60 * 1000);
}

export default {
    generateUpcomingRecurringCharges,
    startRecurringGenerationJob,
};
