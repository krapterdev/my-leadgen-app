const mongoose = require('mongoose');

const mailboxSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    enum: ['gmail', 'gsuite', 'outlook', 'office365', 'yahoo', 'custom'],
    required: true
  },
  smtpSettings: {
    host: String,
    port: Number,
    secure: Boolean,
    username: String,
    password: String // Encrypted
  },
  imapSettings: {
    host: String,
    port: Number,
    secure: Boolean,
    username: String,
    password: String // Encrypted
  },
  throttleSettings: {
    perHour: {
      type: Number,
      default: 50
    },
    perDay: {
      type: Number,
      default: 200
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastVerified: Date,
  warmupEnabled: {
    type: Boolean,
    default: false
  },
  warmupStartDate: {
    type: Date,
    default: () => new Date()
  },
  warmupStartLimit: {
    type: Number,
    default: 5
  },
  warmupIncrement: {
    type: Number,
    default: 5
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'error'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Mailbox', mailboxSchema);