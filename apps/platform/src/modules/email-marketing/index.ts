export { dispatchLeadEmailAutomations } from "./services/dispatch.service";
export { listContacts, unsubscribeByToken, suppressContact, getContactByUnsubscribeToken, suppressContactByEmail } from "./services/contact.service";
export {
  listEmailLists,
  createEmailList,
  updateEmailList,
  deleteEmailList,
} from "./services/list.service";
export {
  listEmailTags,
  createEmailTag,
  updateEmailTag,
  deleteEmailTag,
  attachTagToContact,
  detachTagFromContact,
} from "./services/tag.service";
export {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  seedStarterTemplates,
  sampleMergeData,
} from "./services/template.service";
export {
  listAutomations,
  getAutomation,
  createAutomation,
  updateAutomation,
  activateAutomation,
  pauseAutomation,
  deleteAutomation,
} from "./services/automation.service";
export { processEmailSend, sendTestEmail } from "./services/send.service";
export {
  listBroadcasts,
  getBroadcast,
  previewBroadcastAudience,
  createBroadcast,
  createAndSendBroadcast,
  updateBroadcast,
  refreshBroadcastProgress,
} from "./services/broadcast.service";
export {
  getDefaultFromEmail,
  getMarketingProviderName,
} from "./services/marketing-sender.service";
export {
  getEmailStats,
  listSends,
  getAutomationStepStats,
  listAutomationMetricRecipients,
  getBroadcastStats,
  getSendTrend,
  getRecentActivity,
  assertStatsScopeOwnership,
} from "./services/stats.service";
export type {
  AutomationMetric,
  StatsScope,
  StatsSource,
} from "./services/stats.service";
export {
  getDomainWarmupStatus,
  type DomainWarmupStatus,
} from "./services/domain-warmup.service";
export {
  getAdvertiserEmailSettings,
  updateAdvertiserEmailSettings,
} from "./services/settings.service";
export {
  recordOpen,
  recordClick,
  recordProviderEvent,
  recordSesEvent,
} from "./services/tracking.service";
export {
  listSendingIdentities,
  listVerifiedSendingMailboxes,
  findVerifiedSendingMailbox,
  requestDomainVerification,
  refreshDomainVerification,
  setDefaultIdentity,
  updateIdentityFromEmail,
  addIdentityMailbox,
  removeIdentityMailbox,
  setDefaultIdentityMailbox,
  deleteSendingIdentity,
} from "./services/identity.service";
export { renderTemplate } from "./lib/render-template";
export { enqueueEmailSend } from "./queue/email-queue";
