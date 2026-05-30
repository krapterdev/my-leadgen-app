const nodemailer = require('nodemailer');
const cron = require('node-cron');
const Mailbox = require('../models/Mailbox');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const EmailLog = require('../models/EmailLog');
const { decrypt } = require('../utils/encryption');
const { validateEmail } = require('../utils/emailValidator');
const { globalRateLimiter } = require('../utils/rateLimiter');
const emailTemplates = require('../utils/emailTemplates');
const { broadcastCampaignUpdate, broadcastEmailUpdate } = require('../utils/realtime');

// Send email using specific mailbox
async function sendUsingMailbox(mailboxId, to, subject, body, metadata = {}) {
  try {
    // Validate email address
    const emailValidation = validateEmail(to);
    if (!emailValidation.valid) {
      throw new Error(`Invalid recipient email: ${emailValidation.reason}`);
    }

    const mailbox = await Mailbox.findById(mailboxId);
    if (!mailbox || !mailbox.isVerified) {
      throw new Error('Mailbox not found or not verified');
    }

    // Check rate limits
    const rateLimitCheck = globalRateLimiter.canSend(mailboxId, mailbox.throttleSettings);
    if (!rateLimitCheck.allowed) {
      throw new Error(`Rate limit exceeded: ${rateLimitCheck.reason}. Reset in ${Math.ceil(rateLimitCheck.resetIn / 60000)} minutes`);
    }

    // Decrypt password
    const decryptedPassword = decrypt(mailbox.smtpSettings.password);

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: mailbox.smtpSettings.host,
      port: mailbox.smtpSettings.port,
      secure: mailbox.smtpSettings.secure,
      auth: {
        user: mailbox.smtpSettings.username,
        pass: decryptedPassword
      },
      timeout: 30000,
      connectionTimeout: 30000
    });

    // Generate unique tracking ID
    const trackingId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get contact info for variable replacement
    let processedSubject = subject;
    let processedBody = body;
    let emailLogId = null;
    
    if (metadata.contactId) {
      const Contact = require('../models/Contact');
      const contact = await Contact.findById(metadata.contactId);
      
      if (contact) {
        // Replace variables in subject and body
        const variables = {
          firstName: contact.firstName || 'there',
          lastName: contact.lastName || '',
          email: contact.email || '',
          fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'there'
        };
        
        // Replace {{variable}} syntax
        Object.keys(variables).forEach(key => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          processedSubject = processedSubject.replace(regex, variables[key]);
          processedBody = processedBody.replace(regex, variables[key]);
        });
        
        // Apply modern HTML template (same as test email)
        processedBody = emailTemplates.modern(processedBody, variables.firstName);
      } else {
        // Use modern template even without contact data
        processedBody = emailTemplates.modern(processedBody, 'there');
      }
    } else {
      // Use modern template for non-campaign emails
      processedBody = emailTemplates.modern(processedBody, 'there');
    }
    
    // Create email log to get tracking ID
    if (metadata.campaignId && metadata.contactId) {
      const emailLog = new EmailLog({
        userId: mailbox.userId,
        campaignId: metadata.campaignId,
        contactId: metadata.contactId,
        mailboxId: mailboxId,
        stepNumber: metadata.stepNumber || 1,
        campaignRun: metadata.campaignRun || 1,
        trackingId: trackingId,
        subject: processedSubject,
        status: 'sending'
      });
      const savedLog = await emailLog.save();
      emailLogId = savedLog._id;
    }

    // Multi-method tracking for maximum reliability (Mailtrack-style)
    const baseUrl = process.env.BASE_URL || 'http://localhost:5001';
    const trackingPixel = emailLogId ? `
      <!-- Primary tracking pixel -->
      <img src="${baseUrl}/t/track?mid=${emailLogId}&m=1" width="1" height="1" style="display:block;opacity:0;" alt="" />
      
      <!-- Secondary tracking pixel (different method) -->
      <img src="${baseUrl}/t/track?mid=${emailLogId}&m=2" width="1" height="1" style="display:none;opacity:0;" alt="" />
      
      <!-- CSS background tracking -->
      <div style="width:1px;height:1px;background:url('${baseUrl}/t/track?mid=${emailLogId}&m=3');"></div>
      
      <!-- Hidden div with tracking -->
      <div style="position:absolute;left:-9999px;top:-9999px;">
        <img src="${baseUrl}/t/track?mid=${emailLogId}&m=4" width="1" height="1" alt="" />
      </div>
      
      <!-- Inline style tracking -->
      <span style="display:none;background-image:url('${baseUrl}/t/track?mid=${emailLogId}&m=5');width:0;height:0;"></span>
    ` : '';
    
    // Add tracking pixel
    const finalBody = processedBody + trackingPixel;

    // Send email with professional headers
    const mailOptions = {
      from: `${mailbox.displayName} <${mailbox.email}>`,
      to,
      subject: processedSubject,
      html: finalBody,
      headers: {
        'X-Mailer': 'Professional Email Marketing Platform',
        'List-Unsubscribe': `<${process.env.BASE_URL}/api/tracking/unsubscribe/${metadata.contactId}>`
      }
    };
    
    if (metadata.campaignId) {
      mailOptions.headers['X-Campaign-ID'] = metadata.campaignId;
    }
    
    const info = await transporter.sendMail(mailOptions);

    // Record rate limit
    globalRateLimiter.recordSent(mailboxId);

    // Update email log with success status
    if (emailLogId) {
      const updateData = {
        messageId: info.messageId,
        status: 'sent',
        sentAt: new Date()
      };
      
      await EmailLog.findByIdAndUpdate(emailLogId, updateData);
      
      console.log(`📧 Email sent with tracking ID: ${emailLogId}`);
      console.log(`🔗 Tracking URL: ${baseUrl}/api/tracking/pixel/${emailLogId}.gif`);

      // Update campaign stats and broadcast
      if (metadata.campaignId) {
        const campaign = await Campaign.findByIdAndUpdate(
          metadata.campaignId,
          { $inc: { 'stats.totalSent': 1 } },
          { new: true }
        );
        
        if (campaign) {
          broadcastCampaignUpdate(mailbox.userId.toString(), metadata.campaignId, campaign.stats);
          broadcastEmailUpdate(mailbox.userId.toString(), metadata.campaignId, {
            _id: emailLogId,
            contactId: metadata.contactId,
            status: 'sent',
            subject: processedSubject,
            sentAt: new Date()
          });
        }
      }
    }

    console.log(`✅ Email sent successfully to ${to} via ${mailbox.email}`);
    console.log(`📊 Message ID: ${info.messageId}`);
    return { ...info, emailLogId };
  } catch (error) {
    console.error('Email sending error:', error);
    
    // Update email log with failed status
    if (emailLogId) {
      await EmailLog.findByIdAndUpdate(emailLogId, {
        status: 'failed',
        errorMessage: error.message
      });
    }
    
    throw error;
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Process email sequences
async function processEmailSequences(options = {}) {
  const { campaignId, force = false } = options;
  console.log(`🔄 Processing email sequences${campaignId ? ` for campaign ${campaignId}` : ''}${force ? ' (FORCE MODE)' : ''}...`);
  
  try {
    const query = { status: 'active' };
    if (campaignId) {
      query._id = campaignId;
    }

    const activeCampaigns = await Campaign.find(query)
      .populate('contacts')
      .populate('mailboxId');

    console.log(`Found ${activeCampaigns.length} active campaigns to process`);

    for (const campaign of activeCampaigns) {
      if (!campaign.mailboxId) {
        console.log(`⚠️ Campaign ${campaign.name} has no mailbox configured. Skipping.`);
        continue;
      }
      console.log(`Processing campaign: ${campaign.name} (${campaign.contacts.length} contacts)`);
      let processedCount = 0;

      for (const contact of campaign.contacts) {
        if (contact.status !== 'active') {
          // console.log(`Skipping ${contact.email}: Status is ${contact.status}`);
          continue;
        }

        // Get last email sent to this contact for this campaign
        const lastEmail = await EmailLog.findOne({
          campaignId: campaign._id,
          contactId: contact._id
        }).sort({ sentAt: -1 });

        if (!lastEmail) {
           // This should technically not happen if campaign started correctly, 
           // but if it does, we might want to send step 1? 
           // For now, assuming step 1 is sent on start.
           // console.log(`Skipping ${contact.email}: No previous email found (Step 1 not sent?)`);
           continue; 
        }

        // Check if contact replied (stop sequence if they did)
        if (contact.status === 'replied') {
          console.log(`Skipping ${contact.email}: Contact replied`);
          continue;
        }

        // Find next step
        const nextStepNumber = lastEmail.stepNumber + 1;
        const nextStep = campaign.sequence.find(step => step.stepNumber === nextStepNumber);

        if (!nextStep) {
          // console.log(`Skipping ${contact.email}: No more steps (Last step: ${lastEmail.stepNumber})`);
          continue; 
        }

        // Check if enough time has passed
        const delayMs = nextStep.delayHours * 60 * 60 * 1000;
        const timeSinceLastEmail = Date.now() - lastEmail.sentAt.getTime();

        if (!force && timeSinceLastEmail < delayMs) {
          const remainingMinutes = Math.ceil((delayMs - timeSinceLastEmail) / 60000);
          console.log(`Skipping ${contact.email}: Waiting for delay (Next step in ${remainingMinutes} mins)`);
          continue;
        }

        // Check condition
        if (nextStep.condition === 'no-reply' && lastEmail.status === 'replied') {
          console.log(`Skipping ${contact.email}: Condition 'no-reply' met`);
          continue;
        }

        // Check safety limit & perform dynamic rotation to other active mailboxes if throttled
        let sendingMailboxId = campaign.mailboxId._id;
        const rateLimitCheck = globalRateLimiter.canSend(sendingMailboxId, campaign.mailboxId.throttleSettings);
        if (!rateLimitCheck.allowed) {
          console.log(`⚠️ Mailbox ${campaign.mailboxId.email} throttled. Checking alternate verified mailboxes for user: ${campaign.userId}`);
          const alternateMailboxes = await Mailbox.find({
            userId: campaign.userId,
            isVerified: true,
            status: 'active',
            _id: { $ne: sendingMailboxId }
          });
          
          let rotated = false;
          for (const altMailbox of alternateMailboxes) {
            if (globalRateLimiter.canSend(altMailbox._id, altMailbox.throttleSettings).allowed) {
              console.log(`🔄 Rotating SMTP sender to alternate mailbox: ${altMailbox.email}`);
              sendingMailboxId = altMailbox._id;
              rotated = true;
              break;
            }
          }
          
          if (!rotated) {
            console.log(`❌ All mailboxes are throttled for user: ${campaign.userId}. Skipping contact dispatch.`);
            continue;
          }
        }

        console.log(`🚀 Sending Step ${nextStepNumber} to ${contact.email} using mailbox ${sendingMailboxId}...`);

        // Send next step
        await sendUsingMailbox(
          sendingMailboxId,
          contact.email,
          nextStep.subject,
          nextStep.body,
          {
            campaignId: campaign._id,
            contactId: contact._id,
            stepNumber: nextStepNumber,
            campaignRun: campaign.currentRun || 1
          }
        );
        processedCount++;
        
        // Add a 15-second safety delay to protect SMTP sender reputation from rapid spikes
        await sleep(15000);
      }
      console.log(`Finished campaign ${campaign.name}: Sent ${processedCount} emails`);
    }
  } catch (error) {
    console.error('Error processing email sequences:', error);
  }
}

// Start email worker
function startEmailWorker() {
  // Process sequences every 5 minutes
  cron.schedule('*/5 * * * *', processEmailSequences);
  console.log('Email worker started');
}

module.exports = {
  sendUsingMailbox,
  processEmailSequences,
  startEmailWorker
};