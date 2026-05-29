const mongoose = require('mongoose');

const sequenceStepSchema = new mongoose.Schema({
  stepNumber: {
    type: Number,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  delayHours: {
    type: Number,
    default: 24
  },
  condition: {
    type: String,
    enum: ['no-reply', 'always'],
    default: 'no-reply'
  }
});

const campaignSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  mailboxId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mailbox',
    required: true
  },
  sequence: [sequenceStepSchema],
  contacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact'
  }],
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'stopped', 'completed'],
    default: 'draft'
  },
  stats: {
    totalSent: { type: Number, default: 0 },
    totalOpened: { type: Number, default: 0 },
    totalClicked: { type: Number, default: 0 },
    totalReplied: { type: Number, default: 0 },
    totalBounced: { type: Number, default: 0 }
  },
  startDate: Date,
  endDate: Date,
  currentRun: {
    type: Number,
    default: 1
  },
  totalRuns: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Campaign', campaignSchema);