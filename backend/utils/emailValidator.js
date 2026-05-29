const validator = require('validator');

// Professional email validation
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email is required' };
  }

  // Basic format validation
  if (!validator.isEmail(email)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  // Check for common disposable email domains
  const disposableDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
    'mailinator.com', 'yopmail.com', 'temp-mail.org'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (disposableDomains.includes(domain)) {
    return { valid: false, reason: 'Disposable email addresses not allowed' };
  }

  return { valid: true };
}

// Validate email list for campaigns
function validateEmailList(emails) {
  const results = {
    valid: [],
    invalid: [],
    duplicates: []
  };

  const seen = new Set();
  
  emails.forEach(email => {
    const normalizedEmail = email.toLowerCase().trim();
    
    if (seen.has(normalizedEmail)) {
      results.duplicates.push(email);
      return;
    }
    
    seen.add(normalizedEmail);
    const validation = validateEmail(email);
    
    if (validation.valid) {
      results.valid.push(email);
    } else {
      results.invalid.push({ email, reason: validation.reason });
    }
  });

  return results;
}

module.exports = {
  validateEmail,
  validateEmailList
};