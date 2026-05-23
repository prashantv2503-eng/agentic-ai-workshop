/**
 * Central Message Broker / Dispatcher
 * Facilitates agent-to-agent communication, logs telemetry,
 * and notifies the UI about conversational messages in real-time.
 */

export class MessageBroker {
  constructor() {
    this.agents = {};
    this.messageListeners = [];
    this.messageHistory = [];
  }

  registerAgent(agent) {
    this.agents[agent.name] = agent;
  }

  onMessage(callback) {
    this.messageListeners.push(callback);
  }

  notifyMessageListeners(msg) {
    this.messageHistory.push(msg);
    this.messageListeners.forEach(cb => cb(msg));
  }

  async dispatch(recipientName, payload) {
    const sender = payload.sender || 'Orchestrator';
    const recipient = this.agents[recipientName];

    if (!recipient) {
      console.error(`Broker Error: Agent '${recipientName}' is not registered.`);
      return { success: false, error: 'Agent not registered' };
    }

    const messageId = `msg-${Math.floor(Math.random() * 1000000)}`;
    const timestamp = new Date().toISOString();

    // Log the transmission starting (going into flight)
    const outboundMsg = {
      messageId,
      sender,
      recipient: recipientName,
      timestamp,
      taskType: payload.taskType || 'QUERY',
      payload: payload.payload || payload
    };
    
    this.notifyMessageListeners(outboundMsg);

    try {
      // Execute the task on the target specialized agent
      const response = await recipient.handleTask(payload);
      
      // Log response transmission back
      const replyMsg = {
        messageId: `${messageId}-reply`,
        sender: recipientName,
        recipient: sender,
        timestamp: new Date().toISOString(),
        taskType: 'RESPONSE',
        payload: response
      };
      
      this.notifyMessageListeners(replyMsg);
      return response;
    } catch (err) {
      console.error(`Broker dispatch failed to ${recipientName}:`, err);
      return { success: false, error: err.message };
    }
  }

  clearHistory() {
    this.messageHistory = [];
  }
}

export const broker = new MessageBroker();
