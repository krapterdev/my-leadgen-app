const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  firstName: String,
  lastName: String,
  company: String,
  title: String,
  timezone: String,
  status: {
    type: String,
    enum: ['active', 'suppressed', 'bounced', 'unsubscribed', 'replied'],
    default: 'active'
  },
  tags: [String],
  customFields: {
    type: Map,
    of: String
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScraperBatch'
  }
}, {
  timestamps: true
});

contactSchema.index({ userId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Contact', contactSchema);