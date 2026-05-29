require('dotenv').config();
const mongoose = require('mongoose');
const EmailLog = require('./models/EmailLog');
const Contact = require('./models/Contact');

async function checkDb() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const logs = await EmailLog.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('contactId', 'email');
      
    console.log(`Found ${logs.length} logs:`);
    
    logs.forEach(log => {
      console.log(`\nID: ${log._id}`);
      console.log(`To: ${log.contactId ? log.contactId.email : 'Unknown'}`);
      console.log(`Status: ${log.status}`);
      console.log(`CampaignID: ${log.campaignId}`);
      console.log(`CampaignRun: ${log.campaignRun}`);
      console.log(`OpenedAt: ${log.openedAt}`);
      console.log(`RepliedAt: ${log.repliedAt}`);
    });

    const campaigns = await require('./models/Campaign').find();
    console.log(`\nFound ${campaigns.length} campaigns:`);
    campaigns.forEach(c => {
      console.log(`\nID: ${c._id}`);
      console.log(`Name: ${c.name}`);
      console.log(`CurrentRun: ${c.currentRun}`);
      console.log(`Stats:`, JSON.stringify(c.stats));
    });
    
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

checkDb();
