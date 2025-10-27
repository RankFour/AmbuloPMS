import expressAsync from "express-async-handler";
import reportsServices from "../services/reportsServices.js";

function parseFilters(req) {
  const { from, to, propertyId, tenantId, groupBy, format } = req.query || {};
  return { from, to, propertyId, tenantId, groupBy, format };
}

function maybeCsv(res, data, format) {
  if (String(format || '').toLowerCase() !== 'csv') return res.json(data);
  const toCsv = (rows) => {
    if (!Array.isArray(rows) || !rows.length) return '';
    const headers = Object.keys(rows[0]);
    const out = [headers.join(',')];
    for (const r of rows) {
      out.push(headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
    }
    return out.join('\n');
  };

  let csv = '';
  if (Array.isArray(data)) csv = toCsv(data);
  else {
    const firstArrayKey = Object.keys(data).find(k => Array.isArray(data[k]));
    if (firstArrayKey) csv = toCsv(data[firstArrayKey]);
    else csv = toCsv([data]);
  }
  res.setHeader('Content-Type', 'text/csv');
  return res.send(csv);
}

export const getFinancialReport = expressAsync(async (req, res) => {
  const filters = parseFilters(req);
  const result = await reportsServices.getFinancialSummary(filters);
  return maybeCsv(res, result, filters.format);
});

export const getTenantReport = expressAsync(async (req, res) => {
  const filters = parseFilters(req);
  const result = await reportsServices.getTenantSummary(filters);
  return maybeCsv(res, result, filters.format);
});

export const getPropertyLeaseReport = expressAsync(async (req, res) => {
  const filters = parseFilters(req);
  const result = await reportsServices.getPropertyLeaseSummary(filters);
  return maybeCsv(res, result, filters.format);
});

export const getMaintenanceReport = expressAsync(async (req, res) => {
  const filters = parseFilters(req);
  const result = await reportsServices.getMaintenanceSummary(filters);
  return maybeCsv(res, result, filters.format);
});

export default {
  getFinancialReport,
  getTenantReport,
  getPropertyLeaseReport,
  getMaintenanceReport,
};
