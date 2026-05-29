require('dotenv').config();
const mongoose = require('mongoose');
const imaps = require('imap-simple');
const { decrypt } = require('./utils/encryption');
const Mailbox = require('./models/Mailbox');
const EmailLog = require('./models/EmailLog');

async function debugImap() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const mailboxes = await Mailbox.find({ isVerified: true });
    console.log(`Found ${mailboxes.length} verified mailboxes`);

    for (const mailbox of mailboxes) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Checking mailbox: ${mailbox.email}`);
      
      try {
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
        
        await connection.openBox('INBOX');
        
        // Fetch last 10 emails
        const searchCriteria = ['ALL'];
        const fetchOptions = {
          bodies: ['HEADER'],
          markSeen: false,
          struct: true
        };
        
        const messages = await connection.search(searchCriteria, fetchOptions);
        const recentMessages = messages.slice(-5); // Last 5
        
        console.log(`Found ${messages.length} total messages. Showing last 5:`);
        
        for (const item of recentMessages) {
          const header = item.parts.find(p => p.which === 'HEADER').body;
          const subject = header.subject ? header.subject[0] : '(No Subject)';
          const from = header.from ? header.from[0] : '(Unknown)';
          const messageId = header['message-id'] ? header['message-id'][0] : 'N/A';
          const inReplyTo = header['in-reply-to'] ? header['in-reply-to'][0] : null;
          
          console.log(`\n📧 Subject: ${subject}`);
          console.log(`   From: ${from}`);
          console.log(`   Message-ID: ${messageId}`);
          
          if (inReplyTo) {
            console.log(`   ↩️ In-Reply-To: ${inReplyTo}`);
            
            // Check if this ID exists in our DB
            const cleanId = inReplyTo.replace(/[<>]/g, '').trim();
            const log = await EmailLog.findOne({ 
              messageId: { $regex: cleanId, $options: 'i' } 
            });
            
            if (log) {
              console.log(`   ✅ MATCH FOUND in DB! Log ID: ${log._id}, Status: ${log.status}`);
            } else {
              console.log(`   ❌ NO MATCH in DB for ID: ${cleanId}`);
              // List similar IDs in DB for debugging
              const similar = await EmailLog.find().sort({createdAt: -1}).limit(3);
              console.log(`   (Latest DB IDs: ${similar.map(l => l.messageId).join(', ')})`);
            }
          }
        }
        
        connection.end();
      } catch (err) {
        console.error(`❌ Error checking mailbox ${mailbox.email}:`, err.message);
      }
    }
    
  } catch (error) {
    console.error('Global error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugImap();
