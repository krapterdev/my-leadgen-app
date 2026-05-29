require('dotenv').config();
const mongoose = require('mongoose');
const imaps = require('imap-simple');
const { decrypt } = require('./utils/encryption');
const Mailbox = require('./models/Mailbox');
const EmailLog = require('./models/EmailLog');

async function verifyImapTracking() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const mailboxes = await Mailbox.find({ isVerified: true });
    
    for (const mailbox of mailboxes) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Checking mailbox: ${mailbox.email}`);
      
      const decryptedPassword = decrypt(mailbox.imapSettings.password);
      const config = {
        imap: {
          user: mailbox.imapSettings.username,
          password: decryptedPassword,
          host: mailbox.imapSettings.host,
          port: mailbox.imapSettings.port,
          tls: mailbox.imapSettings.secure,
          authTimeout: 10000,
          tlsOptions: { rejectUnauthorized: false }
        }
      };

      const connection = await imaps.connect(config);
      console.log('✅ IMAP Connected');
      
      // Open Sent folder
      const boxes = await connection.getBoxes();
      let sentBoxName = 'Sent';
      if (boxes['[Gmail]'] && boxes['[Gmail]'].children && boxes['[Gmail]'].children['Sent Mail']) {
        sentBoxName = '[Gmail]/Sent Mail';
      }
      
      console.log(`📂 Opening Sent folder: ${sentBoxName}`);
      await connection.openBox(sentBoxName);
      
      // Fetch recent messages
      const searchCriteria = [['SINCE', new Date(Date.now() - 24 * 3600 * 1000)]];
      const fetchOptions = { bodies: ['HEADER'], struct: true, markSeen: false };
      
      const messages = await connection.search(searchCriteria, fetchOptions);
      console.log(`📤 Found ${messages.length} recent sent messages`);
      
      for (const item of messages) {
        const header = item.parts.find(p => p.which === 'HEADER').body;
        const messageId = header['message-id'] ? header['message-id'][0] : null;
        const subject = header.subject ? header.subject[0] : '(No Subject)';
        const flags = item.attributes.flags || [];
        
        console.log(`\n📧 Subject: ${subject}`);
        console.log(`   Message-ID: ${messageId}`);
        console.log(`   Flags: ${flags.join(', ')}`);
        
        if (messageId) {
           const cleanId = messageId.replace(/[<>]/g, '').trim();
           const log = await EmailLog.findOne({ 
             messageId: { $regex: cleanId, $options: 'i' } 
           });
           
           if (log) {
             console.log(`   ✅ DB Match: ${log._id} (Current Status: ${log.status})`);
             if (flags.includes('\\Seen')) console.log(`   👀 SEEN flag detected -> Should be OPENED`);
             if (flags.includes('\\Answered')) console.log(`   ↩️ ANSWERED flag detected -> Should be REPLIED`);
           } else {
             console.log(`   ❌ No DB match`);
           }
        }
      }
      
      connection.end();
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

verifyImapTracking();
