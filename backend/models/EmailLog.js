const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true
  },
  mailboxId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mailbox',
    required: true
  },
  stepNumber: {
    type: Number,
    required: true
  },
  campaignRun: {
    type: Number,
    default: 1
  },
  messageId: String,
  trackingId: String,
  subject: String,
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed'],
    default: 'sending'
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  openedAt: Date,
  clickedAt: Date,
  repliedAt: Date,
  bouncedAt: Date,
  errorMessage: String,
  // Reply content
  replySubject: String,
  replyBody: String,
  replyHtml: String,
  replyFrom: String,
  // Tracking metadata
  trackingMethods: [{
    method: {
      type: String,
      enum: ['pixel', 'css', 'link', 'manual']
    },
    timestamp: Date,
    userAgent: String,
    ipAddress: String
  }],
  trackingEvents: [{
    type: {
      type: String,
      enum: ['open', 'click']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    userAgent: String,
    ipAddress: String,
    url: String // For click events
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('EmailLog', emailLogSchema);