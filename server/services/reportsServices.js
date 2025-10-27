import conn from "../config/db.js";

const pool = await conn();

function toDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d) ? null : d;
}

function dateClause(col, from, to, params) {
  const parts = [];
  if (from) { parts.push(`${col} >= ?`); params.push(from); }
  if (to)   { parts.push(`${col} <= ?`); params.push(to); }
  return parts.length ? ` AND ${parts.join(" AND ")}` : "";
}

function propertyTenantClauses({ propertyId, tenantId }, params) {
  const parts = [];
  if (propertyId) { parts.push(`l.property_id = ?`); params.push(propertyId); }
  if (tenantId)   { parts.push(`l.user_id = ?`); params.push(tenantId); }
  return parts.length ? ` AND ${parts.join(" AND ")}` : "";
}

export async function getFinancialSummary(filters = {}) {
  const { from, to, propertyId, tenantId, groupBy = "month" } = filters || {};
  const params = [];

  const periodExpr = groupBy === "year" ? `DATE_FORMAT(pay.created_at,'%Y')`
    : groupBy === "quarter" ? `CONCAT(DATE_FORMAT(pay.created_at,'%Y'),'-Q', QUARTER(pay.created_at))`
    : `DATE_FORMAT(pay.created_at,'%Y-%m')`;

  const wherePayments = ` WHERE (pay.status IN ('Completed','Confirmed'))`
    + dateClause("pay.created_at", from, to, params)
    + ` AND 1=1`;
  
  const joinLT = ` FROM payments pay
    LEFT JOIN charges c ON pay.charge_id = c.charge_id
    LEFT JOIN leases l ON c.lease_id = l.lease_id`;

  const ptClause = propertyTenantClauses({ propertyId, tenantId }, params);

  
  const collectedSql = `SELECT ${periodExpr} AS period, SUM(pay.amount) AS total
    ${joinLT}
    ${wherePayments}${ptClause}
    GROUP BY period
    ORDER BY MIN(pay.created_at)`;
  const [collectedRows] = await pool.execute(collectedSql, params);

  
  const params2 = [];
  const whereCharges = ` WHERE 1=1`
    + dateClause("c.due_date", from, to, params2);
  const ptClause2 = propertyTenantClauses({ propertyId, tenantId }, params2);
  const outstandingSql = `SELECT 
      SUM(c.amount) - COALESCE(SUM(CASE WHEN pay.status IN ('Completed','Confirmed') THEN pay.amount ELSE 0 END),0) AS outstanding
    FROM charges c
    LEFT JOIN leases l ON c.lease_id = l.lease_id
    LEFT JOIN payments pay ON pay.charge_id = c.charge_id
    ${whereCharges}${ptClause2}`;
  const [outRows] = await pool.execute(outstandingSql, params2);
  const outstanding = outRows && outRows.length ? Number(outRows[0].outstanding || 0) : 0;

  
  const params4 = [];
  const depositSql = `SELECT 
      COALESCE(SUM(l.monthly_rent * l.advance_payment_months),0) AS total_advance,
      COALESCE(SUM(l.monthly_rent * l.security_deposit_months),0) AS total_security
    FROM leases l
    WHERE 1=1
      ${dateClause("l.lease_start_date", from, to, params4)}
      ${propertyId ? " AND l.property_id = ?" : ""}
      ${tenantId ? " AND l.user_id = ?" : ""}`;
  if (propertyId) params4.push(propertyId);
  if (tenantId) params4.push(tenantId);
  const [depRows] = await pool.execute(depositSql, params4);
  const deposits = depRows && depRows.length ? depRows[0] : { total_advance: 0, total_security: 0 };

  
  const params5 = [];
  const revPropSql = `SELECT l.property_id, p.property_name, COALESCE(SUM(pay.amount),0) AS total
    ${joinLT}
    LEFT JOIN properties p ON l.property_id = p.property_id
    WHERE (pay.status IN ('Completed','Confirmed'))
      ${dateClause("pay.created_at", from, to, params5)}
      ${propertyTenantClauses({ propertyId, tenantId }, params5)}
    GROUP BY l.property_id, p.property_name`;
  const [revPropRows] = await pool.execute(revPropSql, params5);

  const params6 = [];
  const recurringSql = `SELECT 
      SUM(CASE WHEN c.is_recurring = 1 THEN c.amount ELSE 0 END) AS recurring_sum,
      SUM(CASE WHEN c.is_recurring = 0 THEN c.amount ELSE 0 END) AS onetime_sum
    FROM charges c
    LEFT JOIN leases l ON c.lease_id = l.lease_id
    WHERE 1=1
      ${dateClause("c.due_date", from, to, params6)}
      ${propertyTenantClauses({ propertyId, tenantId }, params6)}`;
  const [recRows] = await pool.execute(recurringSql, params6);
  const recurringVsOneTime = recRows && recRows.length ? recRows[0] : { recurring_sum: 0, onetime_sum: 0 };

  return {
    totalCollectedByPeriod: collectedRows.map(r => ({ period: r.period, total: Number(r.total || 0) })),
    outstandingBalances: Number(outstanding || 0),
    depositsSummary: {
      advance: Number(deposits.total_advance || 0),
      security: Number(deposits.total_security || 0),
    },
    revenuePerProperty: revPropRows.map(r => ({ property_id: r.property_id, property_name: r.property_name || '', total: Number(r.total || 0) })),
    recurringVsOneTime: {
      recurring: Number(recurringVsOneTime.recurring_sum || 0),
      oneTime: Number(recurringVsOneTime.onetime_sum || 0),
    },
  };
}

export async function getTenantSummary(filters = {}) {
  const { from, to, propertyId } = filters || {};
  const params = [];
  const whereLeaseDates = ` WHERE 1=1 ${dateClause("l.lease_start_date", from, to, params)}`
    + (propertyId ? " AND l.property_id = ?" : "");
  if (propertyId) params.push(propertyId);

  const activeSql = `SELECT 
      SUM(CASE WHEN l.lease_status IN ('ACTIVE','PENDING') THEN 1 ELSE 0 END) AS active_leases,
      COUNT(*) AS total_leases
    FROM leases l ${whereLeaseDates}`;
  const [actRows] = await pool.execute(activeSql, params);
  const activeLeases = actRows && actRows.length ? Number(actRows[0].active_leases || 0) : 0;
  const totalLeases = actRows && actRows.length ? Number(actRows[0].total_leases || 0) : 0;

  const [overdueRows] = await pool.execute(
    `SELECT COUNT(DISTINCT l.user_id) AS cnt
     FROM charges c
     JOIN leases l ON c.lease_id = l.lease_id
     WHERE c.due_date < NOW() AND c.status IN ('Unpaid','Partially Paid')
       ${propertyId ? " AND l.property_id = ?" : ""}`,
    propertyId ? [propertyId] : []
  );
  const tenantsWithOverdue = overdueRows && overdueRows.length ? Number(overdueRows[0].cnt || 0) : 0;

  const [tenureRows] = await pool.execute(
    `SELECT AVG(TIMESTAMPDIFF(MONTH, l.lease_start_date, l.lease_end_date)) AS avg_months
     FROM leases l ${whereLeaseDates}`,
    params
  );
  const avgTenureMonths = tenureRows && tenureRows.length ? Number(tenureRows[0].avg_months || 0) : 0;

  const [expRows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM leases l 
     WHERE l.lease_end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
     ${propertyId ? " AND l.property_id = ?" : ""}`,
    propertyId ? [propertyId] : []
  );
  const upcomingExpirations = expRows && expRows.length ? Number(expRows[0].cnt || 0) : 0;

  const [tbp] = await pool.execute(
    `SELECT l.property_id, COUNT(DISTINCT l.user_id) AS tenants
     FROM leases l
     ${whereLeaseDates}
     GROUP BY l.property_id`,
    params
  );

  return {
    activeVsInactive: { active: activeLeases, inactive: Math.max(0, totalLeases - activeLeases) },
    tenantsWithOverdue,
    averageTenureMonths: avgTenureMonths,
    upcomingLeaseExpirations: upcomingExpirations,
    tenantsByProperty: tbp.map(r => ({ property_id: r.property_id, tenants: Number(r.tenants || 0) })),
  };
}

export async function getPropertyLeaseSummary(filters = {}) {
  const { from, to } = filters || {};
  const params = [];
  const whereLeaseDates = ` WHERE 1=1 ${dateClause("l.lease_start_date", from, to, params)}`;

  const [occRows] = await pool.execute(
    `SELECT l.property_id, p.property_name,
            SUM(CASE WHEN l.lease_status IN ('ACTIVE','PENDING') THEN 1 ELSE 0 END) AS activeLeases,
            COUNT(*) AS totalLeases
     FROM leases l
     LEFT JOIN properties p ON l.property_id = p.property_id
     ${whereLeaseDates}
     GROUP BY l.property_id, p.property_name`,
    params
  );

  const [rentRows] = await pool.execute(
    `SELECT l.property_id, p.property_name, AVG(l.monthly_rent) AS avgRent
     FROM leases l
     LEFT JOIN properties p ON l.property_id = p.property_id
     ${whereLeaseDates}
     GROUP BY l.property_id, p.property_name`,
    params
  );

  const [rtRows] = await pool.execute(
    `SELECT 
        SUM(CASE WHEN l.renewal_count > 0 THEN 1 ELSE 0 END) AS renewals,
        SUM(CASE WHEN l.lease_status = 'TERMINATED' THEN 1 ELSE 0 END) AS terminations
     FROM leases l ${whereLeaseDates}`,
    params
  );

  const [activeRows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM leases l
     WHERE l.lease_status IN ('ACTIVE','PENDING')`);
  const totalActiveLeases = activeRows && activeRows.length ? Number(activeRows[0].cnt || 0) : 0;

  const [vacRows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM leases l 
     WHERE l.lease_end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`);
  const upcomingVacancies = vacRows && vacRows.length ? Number(vacRows[0].cnt || 0) : 0;

  return {
    occupancyPerProperty: occRows.map(r => ({ property_id: r.property_id, property_name: r.property_name || '', activeLeases: Number(r.activeLeases||0), totalLeases: Number(r.totalLeases||0) })),
    averageRentPerProperty: rentRows.map(r => ({ property_id: r.property_id, property_name: r.property_name || '', avgRent: Number(r.avgRent || 0) })),
    renewalsVsTerminations: { renewals: Number(rtRows?.[0]?.renewals || 0), terminations: Number(rtRows?.[0]?.terminations || 0) },
    totalActiveLeases,
    upcomingVacancies,
  };
}

export async function getMaintenanceSummary(filters = {}) {
  const { from, to, propertyId } = filters || {};
  
  const needLeaseJoin = !!propertyId;

  
  function applyPropertyClause(paramsArr) {
    let join = '';
    let clause = '';
    if (needLeaseJoin) {
      join = ' LEFT JOIN leases l ON t.lease_id = l.lease_id ';
      clause = ' AND l.property_id = ?';
      paramsArr.push(propertyId);
    }
    return { join, clause };
  }

  
  const paramsMonth = [];
  const { join: joinMonth, clause: clauseMonth } = applyPropertyClause(paramsMonth);
  const dateWhereMonth = dateClause('t.created_at', from, to, paramsMonth);
  const sqlByMonth = `
    SELECT DATE_FORMAT(t.created_at,'%Y-%m') AS period, COUNT(*) AS total
    FROM tickets t
    ${joinMonth}
    WHERE 1=1 ${dateWhereMonth} ${clauseMonth}
    GROUP BY period
    ORDER BY period`;
  const [byMonth] = await pool.execute(sqlByMonth, paramsMonth);

  
  const paramsStatus = [];
  const { join: joinStatus, clause: clauseStatus } = applyPropertyClause(paramsStatus);
  const dateWhereStatus = dateClause('t.created_at', from, to, paramsStatus);
  const sqlByStatus = `
    SELECT t.ticket_status AS status, COUNT(*) AS total
    FROM tickets t
    ${joinStatus}
    WHERE 1=1 ${dateWhereStatus} ${clauseStatus}
    GROUP BY t.ticket_status`;
  const [byStatus] = await pool.execute(sqlByStatus, paramsStatus);

  
  const paramsAvg = [];
  const { join: joinAvg, clause: clauseAvg } = applyPropertyClause(paramsAvg);
  const dateWhereAvg = dateClause('t.created_at', from, to, paramsAvg);
  const sqlAvg = `
    SELECT AVG(TIMESTAMPDIFF(HOUR, t.start_datetime, t.end_datetime)) AS avgHrs
    FROM tickets t
    ${joinAvg}
    WHERE 1=1 ${dateWhereAvg}
      AND t.start_datetime IS NOT NULL 
      AND t.end_datetime IS NOT NULL ${clauseAvg}`;
  const [avgRes] = await pool.execute(sqlAvg, paramsAvg);
  const avgResolutionHours = avgRes && avgRes.length ? Number(avgRes[0].avgHrs || 0) : 0;

  
  const paramsIssues = [];
  const { join: joinIssues, clause: clauseIssues } = applyPropertyClause(paramsIssues);
  const dateWhereIssues = dateClause('t.created_at', from, to, paramsIssues);
  const sqlIssues = `
    SELECT t.request_type, COUNT(*) AS total
    FROM tickets t
    ${joinIssues}
    WHERE 1=1 ${dateWhereIssues} ${clauseIssues}
    GROUP BY t.request_type
    ORDER BY total DESC
    LIMIT 10`;
  const [issues] = await pool.execute(sqlIssues, paramsIssues);

  let ratings = [{ count: 0, avgRating: 0 }];
  try {
    const paramsRatings = [];
    const { join: joinRatings, clause: clauseRatings } = applyPropertyClause(paramsRatings);
    
    const dateWhereRatings = dateClause('t.created_at', from, to, paramsRatings);
    const sqlRatings = `
      SELECT COUNT(*) AS count, AVG(r.rating) AS avgRating
      FROM ticket_ratings r
      JOIN tickets t ON t.ticket_id = r.ticket_id
      ${joinRatings}
      WHERE 1=1 ${dateWhereRatings} ${clauseRatings}`;
    const [rows] = await pool.execute(sqlRatings, paramsRatings);
    ratings = rows && rows.length ? rows : ratings;
  } catch (e) {
    
    console.warn('Ratings query failed (table may not exist):', e.message);
  }

  return {
    ticketsByMonth: (byMonth || []).map(r => ({ period: r.period, total: Number(r.total || 0) })),
    ticketsByStatus: (byStatus || []).map(r => ({ status: r.status, total: Number(r.total || 0) })),
    averageResolutionHours: avgResolutionHours,
    commonIssues: (issues || []).map(r => ({ type: r.request_type, total: Number(r.total || 0) })),
    ratings: { count: Number(ratings?.[0]?.count || 0), average: Number(ratings?.[0]?.avgRating || 0) },
  };
}

export default {
  getFinancialSummary,
  getTenantSummary,
  getPropertyLeaseSummary,
  getMaintenanceSummary,
};
