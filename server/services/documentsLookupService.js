// Higher-level helper functions around documentsService for assistant usage.
// Assumptions about folder structure:
// users/<userId>/*            - user profile docs
// users/<userId>/leases/*     - generic lease docs under user
// leases/<leaseId>/*          - specific lease documents
// tickets/<ticketId>/*        - ticket photos/attachments
// invoices/<paymentId>/*      - invoice/payment related files
// These can be adjusted if the actual structure differs. Functions are resilient: they fallback to empty arrays.

import { documentsService } from './documentsService.js';

export async function listUserDocuments(userId) {
  return documentsService.list(`users/${String(userId)}`);
}

export async function listLeaseDocuments(leaseId) {
  return documentsService.list(`leases/${String(leaseId)}`);
}

export async function listUserLeaseDocuments(userId) {
  return documentsService.list(`users/${String(userId)}/leases`);
}

export async function listTicketDocuments(ticketId) {
  return documentsService.list(`tickets/${String(ticketId)}`);
}

export async function listInvoiceDocuments(paymentOrInvoiceId) {
  return documentsService.list(`invoices/${String(paymentOrInvoiceId)}`);
}

export async function listAllDocuments() { // top-level listing only
  return documentsService.list('');
}

export default {
  listUserDocuments,
  listLeaseDocuments,
  listUserLeaseDocuments,
  listTicketDocuments,
  listInvoiceDocuments,
  listAllDocuments,
};
