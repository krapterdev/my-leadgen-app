const mongoose = require('mongoose');

const dnsSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  domain: {
    type: String,
    required: true
  },
  spfRecord: String,
  dkimRecord: String,
  dmarcRecord: String,
  trackingDomain: String,
  isVerified: {
    type: Boolean,
    default: false
  },
  lastVerified: Date
}, {
  timestamps: true
});

dnsSettingsSchema.index({ userId: 1, domain: 1 }, { unique: true });

module.exports = mongoose.model('DnsSettings', dnsSettingsSchema);