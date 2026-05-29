require('dotenv').config();
const mongoose = require('mongoose');
const EmailLog = require('./models/EmailLog');
const Campaign = require('./models/Campaign');

async function checkOpenStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all email logs
    const allLogs = await EmailLog.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('contactId', 'email firstName lastName')
      .populate('campaignId', 'name');

    console.log('📊 OPEN STATUS REPORT');
    console.log('='.repeat(100));
    console.log('');

    let totalSent = 0;
    let totalOpened = 0;
    let totalReplied = 0;

    allLogs.forEach((log, index) => {
      totalSent++;
      if (log.openedAt) totalOpened++;
      if (log.repliedAt) totalReplied++;

      const contact = log.contactId;
      const campaign = log.campaignId;
      
      console.log(`${index + 1}. ${contact?.firstName} ${contact?.lastName} (${contact?.email})`);
      console.log(`   Campaign: ${campaign?.name || 'N/A'}`);
      console.log(`   Status: ${log.status.toUpperCase()}`);
      console.log(`   📧 Sent: ${log.sentAt.toLocaleString()}`);
      
      if (log.openedAt) {
        console.log(`   ✅ OPENED: ${log.openedAt.toLocaleString()} ✓`);
      } else {
        console.log(`   ❌ NOT OPENED YET`);
      }
      
      if (log.repliedAt) {
        console.log(`   💬 REPLIED: ${log.repliedAt.toLocaleString()}`);
      }
      
      console.log(`   Tracking ID: ${log._id}`);
      console.log(`   Tracking URL: ${process.env.BASE_URL}/api/tracking/pixel/${log._id}.gif`);
      console.log('');
    });

    console.log('='.repeat(100));
    console.log('\n📈 SUMMARY:');
    console.log(`   Total Sent: ${totalSent}`);
    console.log(`   Total Opened: ${totalOpened} (${((totalOpened/totalSent)*100).toFixed(1)}%)`);
    console.log(`   Total Replied: ${totalReplied} (${((totalReplied/totalSent)*100).toFixed(1)}%)`);
    console.log(`   Not Opened: ${totalSent - totalOpened}`);

    // Check campaign stats
    console.log('\n\n📊 CAMPAIGN STATS:');
    console.log('='.repeat(100));
    const campaigns = await Campaign.find().sort({ createdAt: -1 }).limit(5);
    
    campaigns.forEach((campaign, index) => {
      console.log(`\n${index + 1}. ${campaign.name}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Sent: ${campaign.stats.totalSent}`);
      console.log(`   Opened: ${campaign.stats.totalOpened} (${campaign.stats.totalSent > 0 ? ((campaign.stats.totalOpened/campaign.stats.totalSent)*100).toFixed(1) : 0}%)`);
      console.log(`   Clicked: ${campaign.stats.totalClicked}`);
      console.log(`   Replied: ${campaign.stats.totalReplied}`);
    });

    console.log('\n\n💡 HOW TO CHECK IF EMAIL WAS OPENED:');
    console.log('='.repeat(100));
    console.log('1. Check "OPENED" column in Email History page');
    console.log('2. Look for ✓ (checkmark) in Campaign details');
    console.log('3. Status will show "opened" or "replied"');
    console.log('4. Timeline will show "Opened: [timestamp]"');
    console.log('5. If replied, it was definitely opened (auto-marked)');
    console.log('\n💡 If tracking not working:');
    console.log('1. Make sure images are enabled in email client');
    console.log('2. Check if email went to spam');
    console.log('3. Some email clients block tracking pixels');
    console.log('4. Gmail web usually works best for tracking');

    await mongoose.disconnect();
    console.log('\n✅ Check complete');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkOpenStatus();
