const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const dns = require('dns').promises;
const nodemailer = require('nodemailer');
const Mailbox = require('../models/Mailbox');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const EmailLog = require('../models/EmailLog');
const { decrypt } = require('../utils/encryption');
const { parseSpintax } = require('../utils/spintax');
const { globalRateLimiter } = require('../utils/rateLimiter');
const emailTemplates = require('../utils/emailTemplates');
const { broadcastCampaignUpdate, broadcastEmailUpdate } = require('../utils/realtime');
const { generateOutreachIcebreaker } = require('../utils/ollamaClient');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null
});

// Helper for sleep/jitter
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// MX record lookup (Step 8)
async function verifyMxRecord(email) {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;
    const records = await dns.resolveMx(domain);
    return records && records.length > 0;
  } catch (err) {
    console.error(`MX verification failed for email ${email}:`, err);
    return false;
  }
}

// BullMQ Worker
const emailWorker = new Worker('EmailSequenceQueue', async (job) => {
  const { campaignId, contactId, stepIndex } = job.data;
  console.log(`[BullMQ Worker] Processing sequence job for campaign ${campaignId}, contact ${contactId}, step ${stepIndex}`);

  // 1. Fetch Campaign and Contact
  const campaign = await Campaign.findById(campaignId).populate('mailboxId');
  const contact = await Contact.findById(contactId);

  if (!campaign || !contact) {
    console.log(`[BullMQ Worker] Campaign or Contact not found. Terminating job.`);
    return;
  }

  // 2. LAZY VALIDATION (Step 10)
  if (campaign.status === 'paused') {
    console.log(`[BullMQ Worker] Campaign ${campaign.name} is paused. Re-queueing job with 5 minutes delay.`);
    const { emailSequenceQueue } = require('./emailQueue');
    await emailSequenceQueue.add(
      job.name,
      job.data,
      { delay: 5 * 60 * 1000 }
    );
    return;
  }

  if (campaign.status !== 'active') {
    console.log(`[BullMQ Worker] Campaign ${campaign.name} status is '${campaign.status}'. Skipping sequence.`);
    return;
  }

  if (['replied', 'unsubscribed', 'bounced'].includes(contact.status)) {
    console.log(`[BullMQ Worker] Contact ${contact.email} status is '${contact.status}'. Skipping sequence.`);
    return;
  }

  // Get sequence step configuration
  const currentStep = campaign.sequence && campaign.sequence[stepIndex];
  if (!currentStep) {
    console.log(`[BullMQ Worker] Step index ${stepIndex} not found in campaign sequence. End of sequence.`);
    return;
  }

  // 3. DNS / MX verification check (Step 8)
  const isMxValid = await verifyMxRecord(contact.email);
  if (!isMxValid) {
    console.log(`[BullMQ Worker] Failed MX check for ${contact.email}. Marking contact as bounced.`);
    contact.status = 'bounced';
    await contact.save();
    return;
  }

  // 4. Resolve Mailbox / SMTP Rotation (Step 5)
  let selectedMailbox = campaign.mailboxId;
  let rateCheck = globalRateLimiter.canSend(selectedMailbox._id, selectedMailbox);
  
  if (!rateCheck.allowed) {
    console.log(`[BullMQ Worker] Primary mailbox ${selectedMailbox.email} throttled. Initiating rotation...`);
    // Find verified active mailboxes of user
    const alternateMailboxes = await Mailbox.find({
      userId: campaign.userId,
      isVerified: true,
      status: 'active',
      _id: { $ne: selectedMailbox._id }
    });

    let rotated = false;
    for (const altMailbox of alternateMailboxes) {
      if (globalRateLimiter.canSend(altMailbox._id, altMailbox).allowed) {
        selectedMailbox = altMailbox;
        rotated = true;
        console.log(`[BullMQ Worker] Rotated SMTP sender to mailbox: ${altMailbox.email}`);
        break;
      }
    }

    if (!rotated) {
      console.log(`[BullMQ Worker] All SMTP senders throttled for user. Re-scheduling job for later.`);
      throw new Error('All SMTP mailboxes throttled. Retrying job later.');
    }
  }

  // 5. Generate dynamic icebreaker if Ollama is active
  let icebreaker = '';
  if (contact.company || contact.website) {
    icebreaker = await generateOutreachIcebreaker(`${contact.firstName || ''} ${contact.lastName || ''}`.trim(), contact.company, contact.website);
  }

  // 6. Spintax parsing & templates assembly (Step 6)
  let rawSubject = currentStep.subject;
  let rawBody = currentStep.body;

  // Substitute variables
  const variables = {
    firstName: contact.firstName || 'there',
    lastName: contact.lastName || '',
    email: contact.email || '',
    company: contact.company || 'your business',
    fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'there'
  };

  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rawSubject = rawSubject.replace(regex, variables[key]);
    rawBody = rawBody.replace(regex, variables[key]);
  });

  // Resolve spintax text strings
  let processedSubject = parseSpintax(rawSubject);
  let processedBody = parseSpintax(rawBody);

  // Prepend generated AI icebreaker if present
  if (icebreaker) {
    processedBody = `<p style="font-size: 16px; font-style: italic; color: #4f46e5; margin-bottom: 20px;">${icebreaker}</p>` + processedBody;
  }

  // Apply default design layout templates
  const templateType = currentStep.templateType || 'modern';
  const finalHtml = emailTemplates[templateType]
    ? emailTemplates[templateType](processedBody, variables.firstName)
    : emailTemplates.modern(processedBody, variables.firstName);

  // Decrypt SMTP password
  const decryptedPassword = decrypt(selectedMailbox.smtpSettings.password);

  // Nodemailer transporter initialization
  const transporter = nodemailer.createTransport({
    host: selectedMailbox.smtpSettings.host,
    port: selectedMailbox.smtpSettings.port,
    secure: selectedMailbox.smtpSettings.secure,
    auth: {
      user: selectedMailbox.smtpSettings.username,
      pass: decryptedPassword
    },
    timeout: 30000,
    connectionTimeout: 30000
  });

  // Generate unique log & tracking ID
  const trackingId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const emailLog = new EmailLog({
    userId: selectedMailbox.userId,
    campaignId: campaign._id,
    contactId: contact._id,
    mailboxId: selectedMailbox._id,
    stepNumber: stepIndex + 1,
    campaignRun: campaign.currentRun || 1,
    trackingId: trackingId,
    subject: processedSubject,
    status: 'sending'
  });
  const savedLog = await emailLog.save();

  // Primary image tracking (Step 11 logo masking)
  const baseUrl = process.env.BASE_URL || 'http://localhost:5001';
  const trackingPixel = `
    <!-- Masked tracking asset pixel -->
    <img src="${baseUrl}/assets/images/logo.png?mid=${savedLog._id}" width="1" height="1" style="display:block;opacity:0;" alt="" />
  `;

  // Dynamic opt-out unsubscribe footer insertion (Step 13)
  const unsubscribeFooter = `
    <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; text-align: center; color: #9ca3af;">
      Want to stop receiving follow-up emails? 
      <a href="${baseUrl}/unsubscribe?leadId=${contact._id}" style="color: #4f46e5; text-decoration: underline;">Unsubscribe here</a>
    </div>
  `;

  const finalBody = finalHtml + trackingPixel + unsubscribeFooter;

  const mailOptions = {
    from: `${selectedMailbox.displayName} <${selectedMailbox.email}>`,
    to: contact.email,
    subject: processedSubject,
    html: finalBody,
    headers: {
      'X-Mailer': 'Outreach SaaS Automation',
      'List-Unsubscribe': `<${baseUrl}/unsubscribe?leadId=${contact._id}>`,
      'X-Campaign-ID': campaign._id.toString()
    }
  };

  // 7. Send the email via SMTP
  try {
    const info = await transporter.sendMail(mailOptions);
    
    // Track sent rate limits
    globalRateLimiter.recordSent(selectedMailbox._id);

    // Update log
    savedLog.messageId = info.messageId;
    savedLog.status = 'sent';
    savedLog.sentAt = new Date();
    await savedLog.save();

    console.log(`[BullMQ Worker] Outbound email fired to ${contact.email}`);

    // Update Campaign totalSent statistics count
    campaign.stats.totalSent += 1;
    await campaign.save();

    broadcastCampaignUpdate(selectedMailbox.userId.toString(), campaign._id.toString(), campaign.stats);
    broadcastEmailUpdate(selectedMailbox.userId.toString(), campaign._id.toString(), {
      _id: savedLog._id,
      contactId: contact._id,
      status: 'sent',
      subject: processedSubject,
      sentAt: new Date()
    });

    // 8. Schedule next follow-up sequence step (Step 10)
    const nextStepIndex = stepIndex + 1;
    if (campaign.sequence && campaign.sequence[nextStepIndex]) {
      const nextStep = campaign.sequence[nextStepIndex];
      const delayMs = (nextStep.delayHours || 24) * 60 * 60 * 1000;
      
      const { emailSequenceQueue } = require('./emailQueue');
      await emailSequenceQueue.add(
        `step-${campaign._id}-${contact._id}-${nextStepIndex}`,
        { campaignId: campaign._id, contactId: contact._id, stepIndex: nextStepIndex },
        { delay: delayMs }
      );
      console.log(`[BullMQ Worker] Scheduled follow-up Step ${nextStepIndex + 1} for ${contact.email} in ${nextStep.delayHours} hours`);
    }

    // Safety delay to prevent rapid dispatch spikes
    await sleep(getJitterDelay());

  } catch (smtpError) {
    console.error('[BullMQ Worker] SMTP Dispatch error:', smtpError);
    savedLog.status = 'failed';
    savedLog.errorMessage = smtpError.message;
    await savedLog.save();
    throw smtpError;
  }
}, {
  connection,
  concurrency: 2
});

function getJitterDelay() {
  // 30 to 60 seconds delay
  return (Math.floor(Math.random() * (60 - 30 + 1)) + 30) * 1000;
}

module.exports = {
  emailWorker
};
