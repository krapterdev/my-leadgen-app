const dns = require('dns').promises;
const net = require('net');

/**
 * Resolves MX records for a target domain
 */
async function resolveMxRecords(domain) {
  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) return null;
    
    // Sort by priority (lowest number first)
    records.sort((a, b) => a.priority - b.priority);
    return records[0].exchange;
  } catch (err) {
    console.warn(`MX lookup failed for domain ${domain}:`, err.message);
    return null;
  }
}

/**
 * Performs SMTP Handshake check for a recipient email address (Step 8)
 */
function checkSmtpHandshake(mxHost, recipientEmail, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = net.createConnection(25, mxHost);
    socket.setTimeout(timeoutMs);

    let step = 0;
    let success = false;

    const cleanUp = () => {
      if (!socket.destroyed) {
        socket.write('QUIT\r\n');
        socket.destroy();
      }
    };

    socket.on('connect', () => {
      // Socket connected, wait for 220 banner
    });

    socket.on('data', (data) => {
      const response = data.toString();
      // console.log(`[SMTP Handshake Debug] Step ${step}: ${response.trim()}`);

      if (response.startsWith('4') || response.startsWith('5')) {
        // Error returned from SMTP server
        cleanUp();
        resolve(false);
        return;
      }

      if (step === 0 && response.startsWith('220')) {
        socket.write('HELO localhost\r\n');
        step = 1;
      } else if (step === 1 && response.startsWith('250')) {
        socket.write('MAIL FROM: <test@localhost>\r\n');
        step = 2;
      } else if (step === 2 && response.startsWith('250')) {
        socket.write(`RCPT TO: <${recipientEmail}>\r\n`);
        step = 3;
      } else if (step === 3) {
        if (response.startsWith('250')) {
          success = true;
        }
        cleanUp();
        resolve(success);
      }
    });

    socket.on('error', (err) => {
      // console.warn(`SMTP Handshake socket error on ${mxHost}:`, err.message);
      cleanUp();
      resolve(false);
    });

    socket.on('timeout', () => {
      // console.warn(`SMTP Handshake timeout on ${mxHost}`);
      cleanUp();
      resolve(false);
    });
  });
}

/**
 * High-performance full DNS & SMTP verifier pipeline
 */
async function verifyEmailDeliverability(email) {
  const domain = email.split('@')[1];
  if (!domain) return false;

  // 1. Resolve MX records
  const mxHost = await resolveMxRecords(domain);
  if (!mxHost) return false;

  // 2. Perform SMTP Handshake verification
  const deliverable = await checkSmtpHandshake(mxHost, email);
  return deliverable;
}

module.exports = {
  resolveMxRecords,
  checkSmtpHandshake,
  verifyEmailDeliverability
};
