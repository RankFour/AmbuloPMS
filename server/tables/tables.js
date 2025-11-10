// users
import userAddressesTable from "./userAddressesTable.js";
import usersTable from "./usersTable.js";
import tenantEmergencyContactsTable from "./tenantEmergencyContactsTable.js";
import tenantIdsTable from "./tenantIdsTable.js";

//properties
import addressesTable from "./addressesTable.js";
import propertiesTable from "./propertiesTable.js";
import propertiesPicturesTable from "./propertiesPicturesTable.js";

//lease-related
import leaseContractsTable from "./leaseContractsTable.js";
import leasesTable from "./leasesTable.js";
import leaseDefaultTable from "./leaseDefaultTable.js";
import leaseTerminationTable from "./leaseTerminationTable.js";

// tickets
import ticketsTable from "./ticketsTable.js";
import ticketAttachmentsTable from "./ticketAttachmentsTable.js";
import ticketRatingsTable from "./ticketRatingsTable.js";

//cms
import companyInfoTable from "./companyInfoTable.js";
import companyAddressTable from "./companyAddressTable.js";
import aboutUsTable from "./aboutUsTable.js";
import faqsTable from "./faqsTable.js";
import contactSubmissionsTable from "./contactSubmissionsTable.js";

//payment-related
import recurringPaymentsTable from "./recurringPaymentsTable.js";
import chargesTable from "./chargesTable.js";
import paymentsTable from "./paymentsTable.js";
import paymentProofTable from "./paymentProofTable.js";
import chargesAuditTable from "./chargesAuditTable.js";
import paymentsAuditTable from "./paymentsAuditTable.js";
import invoicesTable from "./invoicesTable.js";
import invoiceItemsTable from "./invoiceItemsTable.js";
import paymentAllocationsTable from "./paymentAllocationsTable.js";

//messages
import messagesTable from "./messagesTable.js";
import messageAttachmentsTable from "./messageAttachmentsTable.js";
import notificationsTable from "./notificationsTable.js";

//assistant
import assistantLogsTable from "./assistantLogsTable.js";
import assistantConversationsTable from "./assistantConversationsTable.js";
import assistantMessagesTable from "./assistantMessagesTable.js";

const tables = async (dbConnection) => {
  const queries = [
    // users
    userAddressesTable,
    usersTable,
    tenantEmergencyContactsTable,
    tenantIdsTable,

    // properties
    addressesTable,
    propertiesTable,
    propertiesPicturesTable,

    // lease-related
    leaseContractsTable,
    leasesTable,
    leaseDefaultTable,
    leaseTerminationTable,

    // tickets
    ticketsTable,
    ticketAttachmentsTable,
    ticketRatingsTable,

    //cms
    companyInfoTable,
    companyAddressTable,
    aboutUsTable,
    faqsTable,
    contactSubmissionsTable,

    //payment-related
    recurringPaymentsTable,
    chargesTable,
    paymentsTable,
    paymentProofTable,
    chargesAuditTable,
    paymentsAuditTable,
    invoicesTable,
    invoiceItemsTable,
    paymentAllocationsTable,

    //messages
    messagesTable,
    messageAttachmentsTable,
    notificationsTable,

    // assistant analytics & chat persistence
    assistantLogsTable,
    assistantConversationsTable,
    assistantMessagesTable

  ];

  for (const query of queries) {
    try {
      if (typeof query === 'string') {
        await dbConnection.query(query);
      } else if (typeof query === 'function') {
        await query(dbConnection);
      } else {
        console.warn('[Tables] Unknown query type; skipping');
      }
    } catch (error) {
      console.error("Error creating table:", error);
    }
  }

};

export default tables;
