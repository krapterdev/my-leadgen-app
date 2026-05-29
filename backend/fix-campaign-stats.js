const mongoose = require('mongoose');
const Campaign = require('./models/Campaign');
const EmailLog = require('./models/EmailLog');
require('dotenv').config();

async function checkCampaignStats() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the campaign "the shree laxmi"
    const campaign = await Campaign.findOne({ name: /shree laxmi/i });
    
    if (!campaign) {
      console.log('❌ Campaign "the shree laxmi" not found');
      await mongoose.disconnect();
      return;
    }

    console.log('📊 Campaign Details:');
    console.log(`   Name: ${campaign.name}`);
    console.log(`   Status: ${campaign.status}`);
    console.log(`   ID: ${campaign._id}`);
    console.log(`   Contacts: ${campaign.contacts.length}`);
    console.log(`\n📈 Campaign Stats (from DB):`);
    console.log(`   Total Sent: ${campaign.stats.totalSent}`);
    console.log(`   Total Opened: ${campaign.stats.totalOpened}`);
    console.log(`   Total Clicked: ${campaign.stats.totalClicked}`);
    console.log(`   Total Replied: ${campaign.stats.totalReplied}`);

    // Get email logs for this campaign
    const emailLogs = await EmailLog.find({ campaignId: campaign._id })
      .sort({ sentAt: -1 });

    console.log(`\n📧 Email Logs (${emailLogs.length} total):`);
    emailLogs.forEach((log, index) => {
      console.log(`\n   Email ${index + 1}:`);
      console.log(`      ID: ${log._id}`);
      console.log(`      To: Contact ID ${log.contactId}`);
      console.log(`      Subject: ${log.subject}`);
      console.log(`      Status: ${log.status}`);
      console.log(`      Sent: ${log.sentAt}`);
      console.log(`      Opened: ${log.openedAt || 'Not opened'}`);
      console.log(`      Tracking URL: http://localhost:5001/t/track?mid=${log._id}`);
    });

    // Calculate actual stats from email logs
    const actualSent = emailLogs.filter(log => ['sent', 'opened', 'clicked', 'replied'].includes(log.status)).length;
    const actualOpened = emailLogs.filter(log => log.status === 'opened' || log.openedAt).length;
    const actualClicked = emailLogs.filter(log => log.status === 'clicked').length;
    const actualReplied = emailLogs.filter(log => log.status === 'replied').length;

    console.log(`\n🔍 Calculated Stats from Logs:`);
    console.log(`   Sent: ${actualSent}`);
    console.log(`   Opened: ${actualOpened}`);
    console.log(`   Clicked: ${actualClicked}`);
    console.log(`   Replied: ${actualReplied}`);

    if (campaign.stats.totalOpened !== actualOpened) {
      console.log(`\n⚠️  MISMATCH DETECTED!`);
      console.log(`   Campaign shows ${campaign.stats.totalOpened} opened`);
      console.log(`   But actual count is ${actualOpened}`);
      console.log(`\n🔧 Fixing campaign stats...`);
      
      campaign.stats.totalSent = actualSent;
      campaign.stats.totalOpened = actualOpened;
      campaign.stats.totalClicked = actualClicked;
      campaign.stats.totalReplied = actualReplied;
      await campaign.save();
      
      console.log(`✅ Campaign stats updated!`);
    } else {
      console.log(`\n✅ Stats are correct!`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkCampaignStats();
