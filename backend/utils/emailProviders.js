const emailProviders = {
  gmail: {
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false
    },
    imap: {
      host: 'imap.gmail.com',
      port: 993,
      secure: true
    }
  },
  gsuite: {
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false
    },
    imap: {
      host: 'imap.gmail.com',
      port: 993,
      secure: true
    }
  },
  outlook: {
    smtp: {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false
    },
    imap: {
      host: 'outlook.office365.com',
      port: 993,
      secure: true
    }
  },
  office365: {
    smtp: {
      host: 'smtp.office365.com',
      port: 587,
      secure: false
    },
    imap: {
      host: 'outlook.office365.com',
      port: 993,
      secure: true
    }
  },
  yahoo: {
    smtp: {
      host: 'smtp.mail.yahoo.com',
      port: 587,
      secure: false
    },
    imap: {
      host: 'imap.mail.yahoo.com',
      port: 993,
      secure: true
    }
  }
};

function getProviderSettings(provider) {
  return emailProviders[provider] || null;
}

module.exports = { emailProviders, getProviderSettings };