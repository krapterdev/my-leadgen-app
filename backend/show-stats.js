const mongoose = require('mongoose');
const Campaign = require('./models/Campaign');
const EmailLog = require('./models/EmailLog');
require('dotenv').config();

async function showStats() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const campaign = await Campaign.findOne({ name: /shree laxmi/i });
    
    if (campaign) {
      console.log('\n📊 Campaign: ' + campaign.name);
      console.log('   Status: ' + campaign.status);
      console.log('   Sent: ' + campaign.stats.totalSent);
      console.log('   Opened: ' + campaign.stats.totalOpened);
      console.log('   Clicked: ' + campaign.stats.totalClicked);
      console.log('   Replied: ' + campaign.stats.totalReplied);
      
      const logs = await EmailLog.find({ campaignId: campaign._id });
      console.log('\n📧 Email Logs: ' + logs.length);
      logs.forEach((log, i) => {
        console.log(`   ${i+1}. Status: ${log.status}, Opened: ${log.openedAt ? 'Yes' : 'No'}`);
        console.log(`      Track: http://localhost:5001/t/track?mid=${log._id}`);
      });
    } else {
      console.log('Campaign not found');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await mongoose.disconnect();
  }
}

showStats();
