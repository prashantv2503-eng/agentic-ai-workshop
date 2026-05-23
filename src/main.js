import './style.css';
import { db } from './data/database.js';
import { broker } from './agents/messageBroker.js';
import { 
  OrchestratorAgent, 
  SalesAgent, 
  CustomerAgent, 
  InventoryAgent, 
  MarketingAgent 
} from './agents/specializedAgents.js';

// Global variables for Chart instances
let revenueChart = null;
let funnelChart = null;
let inventoryChart = null;
let marketingChart = null;

// Initialize Agents
const salesAgent = new SalesAgent();
const customerAgent = new CustomerAgent();
const inventoryAgent = new InventoryAgent();
const marketingAgent = new MarketingAgent();

broker.registerAgent(salesAgent);
broker.registerAgent(customerAgent);
broker.registerAgent(inventoryAgent);
broker.registerAgent(marketingAgent);

const orchestrator = new OrchestratorAgent(broker);
broker.registerAgent(orchestrator);

// DOM Elements
const simTimeEl = document.getElementById('sim-time');
const scenarioSelect = document.getElementById('scenario-select');
const resetDbBtn = document.getElementById('reset-db-btn');
const chatForm = document.getElementById('chat-form');
const chatInputText = document.getElementById('chat-input-text');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const clearTerminalBtn = document.getElementById('clear-terminal-btn');
const terminalLogsContainer = document.getElementById('terminal-logs-container');
const dbTableSelect = document.getElementById('db-table-select');
const databaseTableContainer = document.getElementById('database-table-container');
const recommendationsContainer = document.getElementById('recommendations-container');
const geminiApiKeyInput = document.getElementById('gemini-api-key');

// Tab buttons
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
  setupAgentListeners();
  setupBrokerListeners();
  setupTabListeners();
  setupSimulationClock();
  setupInterfaceListeners();
  
  // Seed charts and tables
  initCharts();
  renderDbTable(dbTableSelect.value);
});

// Setup event listeners for agents
function setupAgentListeners() {
  const agents = [orchestrator, salesAgent, customerAgent, inventoryAgent, marketingAgent];
  
  agents.forEach(agent => {
    agent.registerStateChangeCallback(updatedAgent => {
      const cardEl = document.getElementById(`card-${updatedAgent.name}`);
      if (!cardEl) return;
      
      // Update status text
      const statusTextEl = cardEl.querySelector('.status-text');
      const statusInd = cardEl.querySelector('.status-indicator');
      const dotEl = cardEl.querySelector('.dot');
      
      statusTextEl.textContent = updatedAgent.status;
      
      // Reset classes
      statusInd.className = 'status-indicator';
      statusInd.classList.add(updatedAgent.status);
      
      // Reset card glows
      cardEl.classList.remove('active-thinking', 'active-querying');
      if (updatedAgent.status === 'THINKING') {
        cardEl.classList.add('active-thinking');
      } else if (updatedAgent.status === 'QUERYING' || updatedAgent.status === 'ANALYZING') {
        cardEl.classList.add('active-querying');
      }

      // Update current task description
      const taskEl = cardEl.querySelector('.current-task');
      if (updatedAgent.logs.length > 0) {
        taskEl.textContent = updatedAgent.logs[updatedAgent.logs.length - 1].message;
      } else {
        taskEl.textContent = 'Ready.';
      }
    });
  });
}

// Setup event listeners for message broker
function setupBrokerListeners() {
  broker.onMessage(msg => {
    const row = document.createElement('div');
    row.className = 'terminal-row';
    
    const timeStr = new Date(msg.timestamp).toLocaleTimeString();
    
    if (msg.taskType === 'RESPONSE') {
      row.classList.add('rx');
      row.textContent = `[${timeStr}] ◀ [RESPONSE] ${msg.sender} responded to ${msg.recipient}. Status: SUCCESS`;
    } else {
      row.classList.add('tx');
      
      let params = '';
      if (msg.payload && msg.payload.parameters) {
        params = JSON.stringify(msg.payload.parameters);
      } else if (msg.payload) {
        params = JSON.stringify(msg.payload);
      }
      
      row.textContent = `[${timeStr}] ▶ [DISPATCH] ${msg.sender} to ${msg.recipient} (${msg.taskType}) Params: ${params}`;
    }
    
    terminalLogsContainer.appendChild(row);
    terminalLogsContainer.scrollTop = terminalLogsContainer.scrollHeight;
  });
}

// Setup Tab selector bindings
function setupTabListeners() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      
      // Force chart redraw to correct layout shifts
      refreshActiveChart();
    });
  });
}

// Interfaces binding
function setupInterfaceListeners() {
  // Scenario select trigger
  scenarioSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    
    // Clear scenarios
    db.scenarios.stockoutCrisisActive = false;
    db.scenarios.checkoutFunnelBugActive = false;
    db.scenarios.campaignSpikeActive = false;
    
    // Inject active scenario
    if (val === 'stockout') {
      db.scenarios.stockoutCrisisActive = true;
      appendTerminalLog(`[CRISIS INJECTED]: Scenario A initiated. PROD-001 Headphones stock cleared out. Sales dropping.`);
    } else if (val === 'bug') {
      db.scenarios.checkoutFunnelBugActive = true;
      appendTerminalLog(`[CRISIS INJECTED]: Scenario B initiated. Bug deployed on checkout script. Mobile funnel collapsing.`);
    } else if (val === 'spike') {
      db.scenarios.campaignSpikeActive = true;
      appendTerminalLog(`[SCENARIO INJECTED]: Scenario C initiated. Promo code FLASH20 broadcasted in weekly Newsletter.`);
    } else {
      appendTerminalLog(`[SYSTEM RESET]: Restored normal baseline operations.`);
    }
    
    // Perform tick immediately to force database adjustments
    db.simulateTick();
    updateChartsData();
    renderDbTable(dbTableSelect.value);
  });

  // Reset database button
  resetDbBtn.addEventListener('click', () => {
    db.reset();
    broker.clearHistory();
    
    // Reset agent displays
    const agents = [orchestrator, salesAgent, customerAgent, inventoryAgent, marketingAgent];
    agents.forEach(a => a.clearLogs());
    
    scenarioSelect.value = 'none';
    terminalLogsContainer.innerHTML = `<div class="terminal-row sys">[SYSTEM RESET]: Database seeded with new 30-day baseline data. All history clear.</div>`;
    
    // Clear recommendations
    recommendationsContainer.innerHTML = `<div class="rec-empty-state">No recommendations generated yet. Query the agent system to see recommended operational actions.</div>`;
    
    updateChartsData();
    renderDbTable(dbTableSelect.value);
    
    appendTerminalLog('[SYSTEM INITIALIZATION]: Core database restored.');
  });

  // Clear dialogue log terminal
  clearTerminalBtn.addEventListener('click', () => {
    terminalLogsContainer.innerHTML = `<div class="terminal-row sys">[TERMINAL CLEANED]: Dialogue history wiped. Listening for agent requests...</div>`;
  });

  // DB Inspect Table toggle
  dbTableSelect.addEventListener('change', (e) => {
    renderDbTable(e.target.value);
  });

  // Prompt chips clicks
  document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      chatInputText.value = prompt;
      chatForm.dispatchEvent(new Event('submit'));
    });
  });

  // Chat form submit
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const queryText = chatInputText.value.trim();
    if (!queryText) return;

    chatInputText.value = '';
    appendMessage('user', queryText);
    
    // Disable send button while generating
    const submitBtn = document.getElementById('chat-send-btn');
    submitBtn.disabled = true;
    
    try {
      appendTerminalLog(`[USER PROMPT RECEIVED]: Query: "${queryText}". Commencing lead coordination loop.`);
      
      const response = await orchestrator.handleUserQuery(queryText);
      
      // Let's check if we have a Gemini API Key to enrich findings
      const apiKey = geminiApiKeyInput.value.trim();
      if (apiKey) {
        appendTerminalLog('[COGNITIVE ENRICHMENT]: Gemini API Key detected. Forwarding context report for advanced generative summary...');
        const enrichedReport = await callGeminiAPI(apiKey, queryText, response.analysis);
        appendMessage('orchestrator', enrichedReport);
      } else {
        appendMessage('orchestrator', response.analysis);
      }
      
      renderRecommendations(response.recommendations);
    } catch (err) {
      console.error(err);
      appendMessage('orchestrator', `⚠️ Lead Orchestrator encountered an execution error: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// Real-time clock and database ticks
function setupSimulationClock() {
  setInterval(() => {
    const timeStr = new Date().toLocaleTimeString();
    simTimeEl.textContent = timeStr;
  }, 1000);

  // Live simulation tick every 5 seconds
  setInterval(() => {
    db.simulateTick();
    updateChartsData();
    renderDbTable(dbTableSelect.value);
  }, 5000);
}

// Append log in simple local text terminal
function appendTerminalLog(msg) {
  const row = document.createElement('div');
  row.className = 'terminal-row sys';
  const timeStr = new Date().toLocaleTimeString();
  row.textContent = `[${timeStr}] ${msg}`;
  terminalLogsContainer.appendChild(row);
  terminalLogsContainer.scrollTop = terminalLogsContainer.scrollHeight;
}

// Append conversation message inside chat box
function appendMessage(sender, content) {
  const msgEl = document.createElement('div');
  msgEl.className = `message ${sender}-msg`;
  
  const timeLabel = sender === 'user' ? 'Operator' : 'Orchestrator Agent';
  const timeStr = new Date().toLocaleTimeString();
  
  msgEl.innerHTML = `
    <span class="msg-timestamp">${timeLabel} - ${timeStr}</span>
    <div>${formatMarkdown(content)}</div>
  `;
  
  chatMessagesContainer.appendChild(msgEl);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// Markdown formatter (support bold, lists, alerts)
function formatMarkdown(text) {
  let html = text
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/## (.*)/g, '<h3>$1</h3>')
    .replace(/#### (.*)/g, '<h4>$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/- (.*)/g, '<li>$1</li>');
    
  // Wrap list items in <ul>
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  
  // Replace simple linebreaks
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// Renders the Database inspect sandbox
function renderDbTable(tableName) {
  const data = db.query(`SELECT * FROM ${tableName}`);
  
  if (Array.isArray(data)) {
    if (data.length === 0) {
      databaseTableContainer.innerHTML = `<div class="rec-empty-state">Table is empty.</div>`;
      return;
    }
    
    // Sort orders or sessions descending to show fresh actions
    let sortedData = [...data];
    if (tableName === 'orders') {
      sortedData = sortedData.reverse().slice(0, 15);
    } else if (tableName === 'sessions') {
      sortedData = sortedData.reverse().slice(0, 15);
    }

    const headers = Object.keys(sortedData[0]);
    
    let html = `<table class="db-grid-table"><thead><tr>`;
    headers.forEach(h => {
      // Shorten headers for space
      const displayHeader = h.replace('_', ' ').toUpperCase();
      html += `<th>${displayHeader}</th>`;
    });
    html += `</tr></thead><tbody>`;
    
    sortedData.forEach(row => {
      html += `<tr>`;
      headers.forEach(h => {
        let val = row[h];
        if (typeof val === 'number') {
          // Format floats
          val = Number.isInteger(val) ? val : val.toFixed(2);
        } else if (typeof val === 'string' && val.length > 25) {
          // Truncate long dates or UUIDs
          val = val.substring(0, 19).replace('T', ' ');
        }
        html += `<td>${val}</td>`;
      });
      html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    databaseTableContainer.innerHTML = html;
  } else {
    databaseTableContainer.innerHTML = `<div class="rec-empty-state">Error: ${data.error || 'Query fail'}</div>`;
  }
}

// Render Recommendations list
function renderRecommendations(recs) {
  if (!recs || recs.length === 0) {
    recommendationsContainer.innerHTML = `<div class="rec-empty-state">No recommendations generated yet. Query the agent system to see recommended operational actions.</div>`;
    return;
  }

  recommendationsContainer.innerHTML = '';
  recs.forEach(r => {
    const card = document.createElement('div');
    card.className = 'rec-card';
    card.id = `card-${r.id}`;
    
    card.innerHTML = `
      <div class="rec-meta">
        <span class="rec-title">${r.title}</span>
        <span class="rec-impact-badge ${r.impact}">${r.impact} Impact</span>
      </div>
      <p class="rec-desc">${r.description}</p>
      <div class="rec-action-row">
        <span class="rec-agent-badge">📍 Suggested by ${r.agent}</span>
        <button class="btn-rec-approve" data-id="${r.id}" data-action="${r.actionType}" data-params='${JSON.stringify(r.params)}'>Approve</button>
      </div>
    `;
    
    // Bind approve action
    card.querySelector('.btn-rec-approve').addEventListener('click', (e) => {
      const action = e.target.getAttribute('data-action');
      const params = JSON.parse(e.target.getAttribute('data-params'));
      const id = e.target.getAttribute('data-id');
      
      executeAction(id, action, params);
    });
    
    recommendationsContainer.appendChild(card);
  });
}

// Execute recommeded database mutations
function executeAction(id, action, params) {
  appendTerminalLog(`[OPERATOR APPROVED RECOMMENDATION]: Executing action: ${action} with params: ${JSON.stringify(params)}`);
  
  let result = null;
  
  if (action === 'RESTOCK') {
    result = db.restockProduct(params.productId, params.qty);
    if (result.success) {
      appendTerminalLog(`[OPERATIONS MUTATION]: Restocked ${params.productId}. New stock: ${result.new_stock}`);
    }
  } else if (action === 'PATCH_BUG') {
    result = db.fixCheckoutBug();
    // Also reset dropdown state if scenario bug was selected
    if (scenarioSelect.value === 'bug') {
      scenarioSelect.value = 'none';
    }
    appendTerminalLog(`[ENGINEERING PATCH]: Patched Checkout script bug. Mobile funnel restored to 100% health.`);
  } else if (action === 'ADJUST_BUDGET') {
    result = db.adjustCampaignBudget(params.campaignId, params.budget);
    if (result.success) {
      appendTerminalLog(`[MARKETING REALLOCATION]: Budget adjusted for campaign ${params.campaignId}. New buffer: $${result.new_budget}`);
    }
  } else {
    // Advisory confirmation
    result = { success: true, message: 'Advisory ticket registered!' };
    appendTerminalLog(`[PLANNING SYSTEM]: Registered operational advisory ticket.`);
  }

  // Remove the approved card from list
  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.remove();
  }

  // If no card left, show empty state
  if (recommendationsContainer.children.length === 0) {
    recommendationsContainer.innerHTML = `<div class="rec-empty-state">All recommendations executed. System stabilized.</div>`;
  }

  // Refresh
  updateChartsData();
  renderDbTable(dbTableSelect.value);
}

// Call real Gemini API
async function callGeminiAPI(apiKey, query, analysisText) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const systemPrompt = `You are the lead orchestrator of the ShopEasy Multi-Agent Data Analyst system. 
The user queried: "${query}".
The specialized analytics agents have already processed the databases and returned the following findings:
${analysisText}

Your task is to review this synthesis report and compile a highly professional, formatted executive summary (in Markdown format). 
- Provide business-relevant context.
- Keep the language engaging, precise, and metric-oriented.
- Highlight critical anomalies (like stockouts or checkout script bugs) or campaigns showing high ROAS.
- Organize sections with headers (using ###, ####) and clear bullet points.
- Structure it cleanly so a business owner can immediately act on it.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: systemPrompt
              }
            ]
          }
        ]
      })
    });

    const json = await response.json();
    if (json.candidates && json.candidates[0].content.parts[0].text) {
      return json.candidates[0].content.parts[0].text;
    } else {
      throw new Error(JSON.stringify(json));
    }
  } catch (err) {
    console.error('Failed to query Gemini API:', err);
    return `### Generative AI Report Error\nFailed to enrich analytical summaries using the Gemini API. Falling back to simulated coordinator insights:\n\n${analysisText}`;
  }
}

// ----------------------------------------------------
// CHART CONFIGURATIONS (CHART.JS)
// ----------------------------------------------------

function initCharts() {
  const ctxRevenue = document.getElementById('revenue-chart').getContext('2d');
  const ctxFunnel = document.getElementById('funnel-chart').getContext('2d');
  const ctxInventory = document.getElementById('inventory-chart').getContext('2d');
  const ctxMarketing = document.getElementById('marketing-chart').getContext('2d');

  // Linear charts options & colors
  const purpleGradient = ctxRevenue.createLinearGradient(0, 0, 0, 300);
  purpleGradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
  purpleGradient.addColorStop(1, 'rgba(168, 85, 247, 0.01)');

  const cyanGradient = ctxRevenue.createLinearGradient(0, 0, 0, 300);
  cyanGradient.addColorStop(0, 'rgba(14, 165, 233, 0.3)');
  cyanGradient.addColorStop(1, 'rgba(14, 165, 233, 0.01)');

  // 1. Revenue comparison chart
  revenueChart = new Chart(ctxRevenue, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Target Day Transactions',
          borderColor: '#a855f7',
          backgroundColor: purpleGradient,
          fill: true,
          borderWidth: 2,
          tension: 0.3,
          data: []
        },
        {
          label: 'Compare Day (Offset -7d)',
          borderColor: '#0ea5e9',
          backgroundColor: cyanGradient,
          fill: true,
          borderWidth: 2,
          tension: 0.3,
          borderDash: [5, 5],
          data: []
        }
      ]
    },
    options: getChartOptions('Hourly Sales Revenue ($)', true)
  });

  // 2. Funnel conversion chart
  funnelChart = new Chart(ctxFunnel, {
    type: 'bar',
    data: {
      labels: ['Landing', 'Product View', 'Add To Cart', 'Checkout Page', 'Purchase Completed'],
      datasets: [
        {
          label: 'Desktop Sessions',
          backgroundColor: 'rgba(14, 165, 233, 0.75)',
          borderColor: '#0ea5e9',
          borderWidth: 1,
          data: []
        },
        {
          label: 'Mobile Sessions',
          backgroundColor: 'rgba(236, 72, 153, 0.75)', // pink
          borderColor: '#ec4899',
          borderWidth: 1,
          data: []
        }
      ]
    },
    options: getChartOptions('Total Sessions Count', false)
  });

  // 3. Inventory stock limits chart
  inventoryChart = new Chart(ctxInventory, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Current Warehouse Stock',
          backgroundColor: [], // Color coded dynamically
          data: []
        },
        {
          label: 'Safety Threshold buffer',
          type: 'line',
          borderColor: '#ef4444',
          borderWidth: 2,
          borderDash: [4, 4],
          fill: false,
          pointStyle: 'circle',
          data: []
        }
      ]
    },
    options: getChartOptions('Stock Quantity Units', false)
  });

  // 4. Marketing ROAS performance
  marketingChart = new Chart(ctxMarketing, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Campaign Return on Spend (ROAS)',
          backgroundColor: 'rgba(168, 85, 247, 0.8)',
          borderColor: '#a855f7',
          borderWidth: 1,
          data: []
        }
      ]
    },
    options: {
      ...getChartOptions('Multiplier Factor (x)', false),
      indexAxis: 'y' // Horizontal bar chart
    }
  });

  // Load first datasets
  updateChartsData();
}

function getChartOptions(yLabel, isGridX) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 } }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)', display: isGridX },
        ticks: { color: '#64748b', font: { family: 'Fira Code', size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b', font: { family: 'Fira Code', size: 10 } },
        title: {
          display: true,
          text: yLabel,
          color: '#64748b',
          font: { family: 'Inter', size: 9, weight: 'bold' }
        }
      }
    }
  };
}

// Forces updates to all chart objects
function updateChartsData() {
  if (!revenueChart || !funnelChart || !inventoryChart || !marketingChart) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const compareStr = getOffsetDateStr(todayStr, -7);

  // --- 1. REVENUE DATA UPDATE ---
  const todayOrders = db.orders.filter(o => o.order_date.startsWith(todayStr));
  const compareOrders = db.orders.filter(o => o.order_date.startsWith(compareStr));

  const hourlyRevenueToday = Array(24).fill(0);
  const hourlyRevenueCompare = Array(24).fill(0);

  todayOrders.forEach(o => {
    const hr = new Date(o.order_date).getHours();
    hourlyRevenueToday[hr] = Number((hourlyRevenueToday[hr] + o.total_amount).toFixed(2));
  });

  compareOrders.forEach(o => {
    const hr = new Date(o.order_date).getHours();
    hourlyRevenueCompare[hr] = Number((hourlyRevenueCompare[hr] + o.total_amount).toFixed(2));
  });

  revenueChart.data.labels = Array(24).fill(0).map((_, i) => `${String(i).padStart(2, '0')}:00`);
  revenueChart.data.datasets[0].data = hourlyRevenueToday;
  revenueChart.data.datasets[1].data = hourlyRevenueCompare;
  revenueChart.update();

  const totalRevToday = hourlyRevenueToday.reduce((a, b) => a + b, 0);
  const totalRevCompare = hourlyRevenueCompare.reduce((a, b) => a + b, 0);
  const revDiffPct = totalRevCompare > 0 ? ((totalRevToday - totalRevCompare) / totalRevCompare) * 100 : 0;
  const revArrow = revDiffPct >= 0 ? '+' : '';

  document.getElementById('revenue-stats').innerHTML = `
    <div class="stat-item"><span>Today Revenue</span><strong>$${totalRevToday.toLocaleString(undefined, {maximumFractionDigits:0})}</strong></div>
    <div class="stat-item"><span>Last Week Same Day</span><strong>$${totalRevCompare.toLocaleString(undefined, {maximumFractionDigits:0})}</strong></div>
    <div class="stat-item"><span>Percentage Shift</span><strong class="${revDiffPct >= 0 ? 'success' : 'danger'}">${revArrow}${revDiffPct.toFixed(1)}%</strong></div>
    <div class="stat-item"><span>Transaction Velocity</span><strong>${todayOrders.length} orders/day</strong></div>
  `;

  // --- 2. FUNNEL DATA UPDATE ---
  const todaySessions = db.sessions.filter(s => s.timestamp.startsWith(todayStr));
  
  const getFunnelCounts = (sessList) => {
    const stages = { landing: 0, product_view: 0, add_to_cart: 0, checkout_page: 0, completed: 0 };
    sessList.forEach(s => {
      stages.landing++;
      if (s.funnel_stage === 'landing') return;
      stages.product_view++;
      if (s.funnel_stage === 'product_view') return;
      stages.add_to_cart++;
      if (s.funnel_stage === 'add_to_cart') return;
      stages.checkout_page++;
      if (s.funnel_stage === 'checkout_page') return;
      stages.completed++;
    });
    return Object.values(stages);
  };

  const desktopSessions = todaySessions.filter(s => s.device_type === 'desktop');
  const mobileSessions = todaySessions.filter(s => s.device_type === 'mobile');

  const desktopFunnelData = getFunnelCounts(desktopSessions);
  const mobileFunnelData = getFunnelCounts(mobileSessions);

  funnelChart.data.datasets[0].data = desktopFunnelData;
  funnelChart.data.datasets[1].data = mobileFunnelData;
  funnelChart.update();

  const globConv = todaySessions.length > 0 
    ? (todaySessions.filter(s => s.funnel_stage === 'completed').length / todaySessions.length) * 100 
    : 0;

  const mobConv = mobileSessions.length > 0 
    ? (mobileSessions.filter(s => s.funnel_stage === 'completed').length / mobileSessions.length) * 100 
    : 0;

  const deskConv = desktopSessions.length > 0 
    ? (desktopSessions.filter(s => s.funnel_stage === 'completed').length / desktopSessions.length) * 100 
    : 0;

  document.getElementById('funnel-stats').innerHTML = `
    <div class="stat-item"><span>Active User Sessions</span><strong>${todaySessions.length}</strong></div>
    <div class="stat-item"><span>Global Conversion</span><strong class="${globConv > 2.0 ? 'success' : 'warning'}">${globConv.toFixed(2)}%</strong></div>
    <div class="stat-item"><span>Desktop Conv Rate</span><strong>${deskConv.toFixed(2)}%</strong></div>
    <div class="stat-item"><span>Mobile Conv Rate</span><strong class="${mobConv < 1.0 && deskConv > 2.5 ? 'danger' : ''}">${mobConv.toFixed(2)}%</strong></div>
  `;

  // --- 3. INVENTORY DATA UPDATE ---
  const labels = db.products.map(p => p.product_name);
  const stocks = db.products.map(p => p.stock_level);
  const buffers = db.products.map(p => p.reorder_point);
  
  // Dynamic color coding: warn if stock <= reorder point, alert if stock === 0
  const colors = db.products.map(p => {
    if (p.stock_level === 0) return 'rgba(239, 68, 68, 0.85)'; // red
    if (p.stock_level <= p.reorder_point) return 'rgba(245, 158, 11, 0.85)'; // yellow
    return 'rgba(16, 185, 129, 0.85)'; // green
  });

  inventoryChart.data.labels = labels;
  inventoryChart.data.datasets[0].data = stocks;
  inventoryChart.data.datasets[0].backgroundColor = colors;
  inventoryChart.data.datasets[1].data = buffers;
  inventoryChart.update();

  const outOfStockItems = db.products.filter(p => p.stock_level === 0).length;
  const lowStockItems = db.products.filter(p => p.stock_level > 0 && p.stock_level <= p.reorder_point).length;

  document.getElementById('inventory-stats').innerHTML = `
    <div class="stat-item"><span>Total SKUs Tracked</span><strong>${db.products.length}</strong></div>
    <div class="stat-item"><span>Stockout Alerts</span><strong class="${outOfStockItems > 0 ? 'danger' : ''}">${outOfStockItems}</strong></div>
    <div class="stat-item"><span>Low Stock Buffers</span><strong class="${lowStockItems > 0 ? 'warning' : ''}">${lowStockItems}</strong></div>
    <div class="stat-item"><span>Warehouse Capacity</span><strong>Healthy</strong></div>
  `;

  // --- 4. MARKETING ROAS UPDATE ---
  const mLabels = db.campaigns.map(c => c.name);
  const roasData = db.campaigns.map(c => c.ad_spend > 0 ? Number((c.revenue_generated / c.ad_spend).toFixed(2)) : 0);

  marketingChart.data.labels = mLabels;
  marketingChart.data.datasets[0].data = roasData;
  marketingChart.update();

  const totalSpend = db.campaigns.reduce((sum, c) => sum + c.ad_spend, 0);
  const totalRevGenerated = db.campaigns.reduce((sum, c) => sum + c.revenue_generated, 0);
  const averageRoas = totalSpend > 0 ? totalRevGenerated / totalSpend : 0;

  document.getElementById('marketing-stats').innerHTML = `
    <div class="stat-item"><span>Total Ads Spend</span><strong>$${totalSpend.toLocaleString(undefined, {maximumFractionDigits:0})}</strong></div>
    <div class="stat-item"><span>Attr. Ad Revenue</span><strong>$${totalRevGenerated.toLocaleString(undefined, {maximumFractionDigits:0})}</strong></div>
    <div class="stat-item"><span>Blended ROAS Factor</span><strong class="${averageRoas > 2.0 ? 'success' : 'warning'}">${averageRoas.toFixed(2)}x</strong></div>
    <div class="stat-item"><span>Active Ad Channels</span><strong>${db.campaigns.filter(c => c.status === 'active').length}</strong></div>
  `;
}

function refreshActiveChart() {
  if (revenueChart) revenueChart.resize();
  if (funnelChart) funnelChart.resize();
  if (inventoryChart) inventoryChart.resize();
  if (marketingChart) marketingChart.resize();
}

// Date helpers
function getOffsetDateStr(dateStr, offsetDays) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}
