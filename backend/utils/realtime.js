// Real-time updates using Server-Sent Events
const clients = new Map();

// In-memory buffer to cache recent Celery log lines (max 100 lines)
const logBuffer = [];
const MAX_LOGS = 100;

function bufferLog(text, type) {
  logBuffer.push({
    text,
    type,
    timestamp: new Date().toLocaleTimeString()
  });
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }
}

function getLogBuffer() {
  return logBuffer;
}

function addClient(userId, res) {
  if (!clients.has(userId)) {
    clients.set(userId, []);
  }
  clients.get(userId).push(res);
  
  // Remove client when connection closes
  res.on('close', () => {
    const userClients = clients.get(userId) || [];
    const index = userClients.indexOf(res);
    if (index > -1) {
      userClients.splice(index, 1);
    }
  });
}

function sendToUser(userId, event, data) {
  const userClients = clients.get(userId) || [];
  userClients.forEach(client => {
    try {
      client.write(`event: ${event}\n`);
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('Error sending SSE:', error);
    }
  });
}

function broadcastCampaignUpdate(userId, campaignId, stats) {
  sendToUser(userId, 'campaign-stats', {
    campaignId,
    stats,
    timestamp: new Date().toISOString()
  });
}

function broadcastEmailUpdate(userId, campaignId, emailLog) {
  sendToUser(userId, 'email-update', {
    campaignId,
    emailLog,
    timestamp: new Date().toISOString()
  });
}

function broadcastToAll(event, data) {
  clients.forEach((userClients) => {
    userClients.forEach(client => {
      try {
        client.write(`event: ${event}\n`);
        client.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        console.error('Error sending SSE broadcast:', error);
      }
    });
  });
}

module.exports = {
  addClient,
  sendToUser,
  broadcastCampaignUpdate,
  broadcastEmailUpdate,
  broadcastToAll,
  bufferLog,
  getLogBuffer
};