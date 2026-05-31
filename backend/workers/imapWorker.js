const cron = require('node-cron');
const imaps = require('imap-simple');
const Mailbox = require('../models/Mailbox');
const EmailLog = require('../models/EmailLog');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
const { decrypt } = require('../utils/encryption');
const { broadcastCampaignUpdate } = require('../utils/realtime');

/**
 * Checks a mailbox for new replies
 */
/**
 * Checks a mailbox for updates (Sent folder for opens, Inbox for replies)
 */
async function checkMailboxStatus(mailbox) {
  console.log(`🔍 Checking updates for mailbox: ${mailbox.email}`);

  const decryptedPassword = decrypt(mailbox.imapSettings.password);

  const config = {
    imap: {
      user: mailbox.imapSettings.username,
      password: decryptedPassword,
      host: mailbox.imapSettings.host,
      port: mailbox.imapSettings.port,
      tls: mailbox.imapSettings.secure,
      authTimeout: 15000,
      tlsOptions: {
        rejectUnauthorized: false
      }
    },
  };

  let connection;
  try {
    connection = await imaps.connect(config);
    console.log(`✅ IMAP connection successful for ${mailbox.email}`);

    // 1. Check Sent Folder for Opens (\Seen) and Replies (\Answered)
    // Note: Gmail puts sent messages in "[Gmail]/Sent Mail" or "Sent"
    const boxes = await connection.getBoxes();
    let sentBoxName = 'Sent';
    
    // Find the correct Sent folder name
    const findSentBox = (boxList) => {
      for (const key in boxList) {
        if (key.toLowerCase().includes('sent')) return key;
        if (boxList[key].children) {
          const child = findSentBox(boxList[key].children);
          if (child) return key + delimiter + child; // This path logic might be complex, simplified below
        }
      }
      return null;
    };

    // Common Gmail path
    if (boxes['[Gmail]'] && boxes['[Gmail]'].children && boxes['[Gmail]'].children['Sent Mail']) {
      sentBoxName = '[Gmail]/Sent Mail';
    } else if (boxes['Sent']) {
      sentBoxName = 'Sent';
    }

    console.log(`📂 Opening Sent folder: ${sentBoxName}`);
    await connection.openBox(sentBoxName);

    // Fetch recent sent messages (last 24 hours to keep it fast)
    const delay = 24 * 3600 * 1000;
    const yesterday = new Date();
    yesterday.setTime(Date.now() - delay);
    
    const searchCriteria = [
      ['SINCE', yesterday]
    ];
    
    const fetchOptions = {
      bodies: ['HEADER'],
      struct: true,
      markSeen: false
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`📤 Found ${messages.length} recent sent messages`);

    for (const item of messages) {
      try {
        const headerPart = item.parts.find(p => p.which === 'HEADER');
        if (!headerPart || !headerPart.body) continue;

        const messageId = headerPart.body['message-id'] ? headerPart.body['message-id'][0] : null;
        if (!messageId) continue;

        const cleanMessageId = messageId.replace(/[<>]/g, '').trim();
        
        // Find matching log in DB
        const emailLog = await EmailLog.findOne({ 
          $or: [
            { messageId: cleanMessageId },
            { messageId: { $regex: cleanMessageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
          ]
        });

        if (emailLog) {
          const flags = item.attributes.flags || [];
          let updated = false;

          // Check for Open (\Seen)
          if (flags.includes('\\Seen') && !emailLog.openedAt) {
            emailLog.status = 'opened';
            emailLog.openedAt = new Date();
            updated = true;
            console.log(`✅ DETECTED OPEN via IMAP: ${emailLog._id}`);
          }

          // Check for Reply (\Answered)
          if (flags.includes('\\Answered') && emailLog.status !== 'replied') {
            emailLog.status = 'replied';
            emailLog.repliedAt = new Date();
            if (!emailLog.openedAt) emailLog.openedAt = new Date(); // Must be opened to reply
            updated = true;
            console.log(`✅ DETECTED REPLY via IMAP: ${emailLog._id}`);
          }

          if (updated) {
            await emailLog.save();
            
            // Update Campaign Stats
            if (emailLog.campaignId) {
              const updateStats = {};
              if (emailLog.status === 'opened') updateStats.$inc = { 'stats.totalOpened': 1 };
              if (emailLog.status === 'replied') {
                 updateStats.$inc = { 'stats.totalReplied': 1 };
                 // If it wasn't counted as opened before, count it now
                 // (This logic is a bit simplified, ideally we check previous state)
              }

              // Re-calculate stats to be safe
              const campaign = await Campaign.findById(emailLog.campaignId);
              const logs = await EmailLog.find({ campaignId: campaign._id });
              
              const totalOpened = logs.filter(l => l.openedAt).length;
              const totalReplied = logs.filter(l => l.repliedAt).length;
              
              campaign.stats.totalOpened = totalOpened;
              campaign.stats.totalReplied = totalReplied;
              await campaign.save();

              // Broadcast
              const { broadcastCampaignUpdate, broadcastEmailUpdate } = require('../utils/realtime');
              broadcastCampaignUpdate(mailbox.userId.toString(), emailLog.campaignId.toString(), campaign.stats);
              broadcastEmailUpdate(mailbox.userId.toString(), emailLog.campaignId.toString(), {
                _id: emailLog._id,
                contactId: emailLog.contactId,
                status: emailLog.status,
                openedAt: emailLog.openedAt,
                repliedAt: emailLog.repliedAt,
                subject: emailLog.subject
              });
            }
            
            // Update Contact Status if Replied
            if (emailLog.status === 'replied') {
               await Contact.findByIdAndUpdate(emailLog.contactId, { status: 'replied' });
            }
          }
        }
      } catch (err) {
        console.error('Error processing sent message:', err);
      }
    }

  } catch (error) {
    if (error.source === 'authentication') {
      console.error(`❌ IMAP Authentication Failed for ${mailbox.email}`);
    } else {
      console.error(`❌ IMAP error for ${mailbox.email}:`, error.message);
    }
  } finally {
    if (connection) {
      connection.end();
      console.log(`🔒 IMAP connection closed for ${mailbox.email}`);
    }
  }
}

// Check all verified mailboxes for replies
async function checkAllMailboxes() {
  if (global.activeSection && global.activeSection !== 'replies') {
    console.log(`[IMAP Worker] Skipping IMAP checking because active section is "${global.activeSection}" (not "replies")`);
    return;
  }

  try {
    const verifiedMailboxes = await Mailbox.find({ 
      isVerified: true,
      status: 'active'
    });

    for (const mailbox of verifiedMailboxes) {
      await checkMailboxStatus(mailbox);
    }
  } catch (error) {
    console.error('Error checking mailboxes for replies:', error);
  }
}

// Start IMAP worker
function startImapWorker() {
  console.log('🚀 IMAP worker started - checking replies every 5 minutes');
  cron.schedule('*/5 * * * *', checkAllMailboxes);
  
  // Run immediately on startup
  setTimeout(checkAllMailboxes, 10000);
}

module.exports = {
  checkMailboxStatus,
  checkAllMailboxes,
  startImapWorker
};