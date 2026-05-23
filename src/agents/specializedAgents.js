import { BaseAgent } from './baseAgent.js';
import { db } from '../data/database.js';

// 1. Sales & Revenue Agent
export class SalesAgent extends BaseAgent {
  constructor() {
    super(
      'SalesAgent',
      'Sales & Revenue Agent',
      'Financial Specialist',
      'Act as the Sales Analyst. Query orders, compute revenue metrics, and find financial variances.'
    );
  }

  async handleTask(payload) {
    this.transitionTo('THINKING', 'Parsing sales analysis request parameters...');
    await delay(1000);

    const targetDate = payload.parameters?.timeframe?.start || new Date().toISOString().split('T')[0];
    const compareDate = payload.parameters?.compareWith?.start || getOffsetDateStr(targetDate, -7);

    this.transitionTo('QUERYING', 'Running transaction queries for date range comparison...');
    const sql = `SELECT * FROM Orders WHERE order_date BETWEEN '${targetDate} 00:00:00' AND '${targetDate} 23:59:59';`;
    this.addQuery(sql);
    
    const compareSql = `SELECT * FROM Orders WHERE order_date BETWEEN '${compareDate} 00:00:00' AND '${compareDate} 23:59:59';`;
    this.addQuery(compareSql);

    await delay(1200);

    const orders = db.orders;
    const targetDayOrders = filterOrdersByDate(orders, targetDate);
    const compareDayOrders = filterOrdersByDate(orders, compareDate);

    this.transitionTo('ANALYZING', 'Computing GMV, volumes, and category variances...');
    
    // Aggregate data
    const targetGMV = targetDayOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const compareGMV = compareDayOrders.reduce((sum, o) => sum + o.total_amount, 0);
    
    const targetVol = targetDayOrders.length;
    const compareVol = compareDayOrders.length;

    const targetAOV = targetVol > 0 ? targetGMV / targetVol : 0;
    const compareAOV = compareVol > 0 ? compareGMV / compareVol : 0;

    // Category breakdown
    const getCatRev = (ordersList) => {
      const cats = {};
      ordersList.forEach(o => {
        const prod = db.products.find(p => p.product_id === o.product_id);
        const cat = prod ? prod.category : 'Unknown';
        cats[cat] = (cats[cat] || 0) + o.total_amount;
      });
      return cats;
    };

    const targetCats = getCatRev(targetDayOrders);
    const compareCats = getCatRev(compareDayOrders);

    const categoriesList = ['Electronics', 'Apparel', 'Home', 'Fitness'];
    const categoryVariance = {};
    categoriesList.forEach(c => {
      const tRev = targetCats[c] || 0;
      const cRev = compareCats[c] || 0;
      const diff = tRev - cRev;
      const pct = cRev > 0 ? (diff / cRev) * 100 : 0;
      categoryVariance[c] = { target: tRev, compare: cRev, changePct: pct };
    });

    const diffGMV = targetGMV - compareGMV;
    const changeGMVPct = compareGMV > 0 ? (diffGMV / compareGMV) * 100 : 0;

    await delay(1000);
    this.transitionTo('REPORTING', 'Writing sales comparison report...');
    
    return {
      success: true,
      data: {
        timeframe: { targetDate, compareDate },
        gmv: { target: targetGMV, compare: compareGMV, changePct: changeGMVPct },
        volume: { target: targetVol, compare: compareVol },
        aov: { target: targetAOV, compare: compareAOV },
        categoryVariance
      }
    };
  }
}

// 2. Customer Behavior Agent
export class CustomerAgent extends BaseAgent {
  constructor() {
    super(
      'CustomerAgent',
      'Customer Behavior Agent',
      'UX & Conversion Specialist',
      'Act as the UX analyst. Query website sessions, evaluate conversion funnels, and detect friction.'
    );
  }

  async handleTask(payload) {
    this.transitionTo('THINKING', 'Parsing conversion and behavior request parameters...');
    await delay(1000);

    const dateStr = payload.parameters?.timeframe?.start || new Date().toISOString().split('T')[0];

    this.transitionTo('QUERYING', 'Executing clickstream and session logs queries...');
    const sql = `SELECT * FROM Sessions WHERE timestamp LIKE '${dateStr}%';`;
    this.addQuery(sql);
    await delay(1200);

    const sessions = db.sessions.filter(s => s.timestamp.startsWith(dateStr));
    
    this.transitionTo('ANALYZING', 'Analyzing session funnels and segmenting by device...');
    
    const getFunnelCounts = (sessList) => {
      const stages = { landing: 0, product_view: 0, add_to_cart: 0, checkout_page: 0, completed: 0 };
      sessList.forEach(s => {
        const stage = s.funnel_stage;
        stages.landing++;
        if (stage === 'landing') return;
        stages.product_view++;
        if (stage === 'product_view') return;
        stages.add_to_cart++;
        if (stage === 'add_to_cart') return;
        stages.checkout_page++;
        if (stage === 'checkout_page') return;
        stages.completed++;
      });
      return stages;
    };

    const overallFunnel = getFunnelCounts(sessions);
    
    // Segment by device
    const mobileSess = sessions.filter(s => s.device_type === 'mobile');
    const desktopSess = sessions.filter(s => s.device_type === 'desktop');
    const tabletSess = sessions.filter(s => s.device_type === 'tablet');

    const mobileFunnel = getFunnelCounts(mobileSess);
    const desktopFunnel = getFunnelCounts(desktopSess);

    // Calculate conversions
    const calcRates = (funnel) => {
      const l = funnel.landing || 1;
      return {
        overall: (funnel.completed / l) * 100,
        landing_to_view: (funnel.product_view / l) * 100,
        view_to_cart: funnel.product_view > 0 ? (funnel.add_to_cart / funnel.product_view) * 100 : 0,
        cart_to_checkout: funnel.add_to_cart > 0 ? (funnel.checkout_page / funnel.add_to_cart) * 100 : 0,
        checkout_to_completed: funnel.checkout_page > 0 ? (funnel.completed / funnel.checkout_page) * 100 : 0
      };
    };

    const overallRates = calcRates(overallFunnel);
    const mobileRates = calcRates(mobileFunnel);
    const desktopRates = calcRates(desktopFunnel);

    // Find anomalies (e.g. mobile conversion dropped significantly compared to desktop)
    let anomalyDetected = false;
    let anomalyDescription = 'No major funnel leaks detected.';
    
    if (desktopRates.checkout_to_completed > 40 && mobileRates.checkout_to_completed < 15) {
      anomalyDetected = true;
      anomalyDescription = `Funnel Leak Alert: Mobile checkout conversion is critically low (${mobileRates.checkout_to_completed.toFixed(1)}%) compared to Desktop (${desktopRates.checkout_to_completed.toFixed(1)}%). Potential UI/JS break on the checkout page.`;
    }

    await delay(1000);
    this.transitionTo('REPORTING', 'Generating UX and conversion breakdown report...');
    
    return {
      success: true,
      data: {
        totalSessions: sessions.length,
        overallFunnel,
        overallRates,
        mobileRates,
        desktopRates,
        anomalyDetected,
        anomalyDescription
      }
    };
  }
}

// 3. Inventory & Operations Agent
export class InventoryAgent extends BaseAgent {
  constructor() {
    super(
      'InventoryAgent',
      'Inventory & Operations Agent',
      'Supply Chain Specialist',
      'Act as the Operations Analyst. Monitor warehouse levels, flag stockouts, and recommend replenishment.'
    );
  }

  async handleTask(payload) {
    this.transitionTo('THINKING', 'Parsing inventory levels auditing parameters...');
    await delay(1000);

    const category = payload.parameters?.category;

    this.transitionTo('QUERYING', 'Fetching current stock balances and warehouse status...');
    const sql = category 
      ? `SELECT * FROM Inventory WHERE category = '${category}';`
      : `SELECT * FROM Inventory;`;
    this.addQuery(sql);
    await delay(1200);

    const products = category 
      ? db.products.filter(p => p.category === category)
      : db.products;

    this.transitionTo('ANALYZING', 'Analyzing inventory velocity and safety stock thresholds...');
    
    const stockAlerts = [];
    const restockRecommendations = [];

    products.forEach(p => {
      // Out of stock check
      if (p.stock_level === 0) {
        stockAlerts.push({
          product_id: p.product_id,
          product_name: p.product_name,
          category: p.category,
          status: 'OUT_OF_STOCK',
          stock: 0
        });

        // Restock suggestion
        restockRecommendations.push({
          product_id: p.product_id,
          product_name: p.product_name,
          current_stock: 0,
          reorder_qty: p.reorder_point * 3, // Reorder bulk
          estimated_lead_days: p.lead_time_days,
          reason: 'Item is completely depleted. High revenue loss risk.'
        });
      } 
      // Low stock check
      else if (p.stock_level <= p.reorder_point) {
        stockAlerts.push({
          product_id: p.product_id,
          product_name: p.product_name,
          category: p.category,
          status: 'LOW_STOCK',
          stock: p.stock_level
        });

        restockRecommendations.push({
          product_id: p.product_id,
          product_name: p.product_name,
          current_stock: p.stock_level,
          reorder_qty: p.reorder_point * 2,
          estimated_lead_days: p.lead_time_days,
          reason: 'Stock falls below calculated safety buffer.'
        });
      }
    });

    await delay(1000);
    this.transitionTo('REPORTING', 'Compiling warehouse restock advisory...');

    return {
      success: true,
      data: {
        alerts: stockAlerts,
        recommendations: restockRecommendations,
        totalItemsTracked: products.length
      }
    };
  }
}

// 4. Marketing & Campaign Agent
export class MarketingAgent extends BaseAgent {
  constructor() {
    super(
      'MarketingAgent',
      'Marketing & Campaign Agent',
      'Growth Specialist',
      'Act as the Marketing Analyst. Audit active advertising campaign spend, calculate ROAS, and simulate promos.'
    );
  }

  async handleTask(payload) {
    this.transitionTo('THINKING', 'Parsing marketing campaign evaluation parameters...');
    await delay(1000);

    this.transitionTo('QUERYING', 'Running marketing performance metrics queries...');
    const sql = `SELECT * FROM Campaigns WHERE status = 'active';`;
    this.addQuery(sql);
    await delay(1200);

    const campaigns = db.campaigns;
    
    this.transitionTo('ANALYZING', 'Calculating ROAS, CPC, and CTR statistics...');
    
    const results = campaigns.map(c => {
      const roas = c.ad_spend > 0 ? c.revenue_generated / c.ad_spend : 0;
      const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
      const cpc = c.clicks > 0 ? c.ad_spend / c.clicks : 0;

      return {
        campaign_id: c.campaign_id,
        name: c.name,
        budget: c.budget,
        spend: c.ad_spend,
        clicks: c.clicks,
        impressions: c.impressions,
        revenue: c.revenue_generated,
        roas: Number(roas.toFixed(2)),
        ctr: Number(ctr.toFixed(2)),
        cpc: Number(cpc.toFixed(2))
      };
    });

    // Simulate promo discounts simulation (if requested or for advice)
    const discountSimulation = [
      { discount: '10%', marginImpact: '-4.5%', estQuantityBoost: '+15%' },
      { discount: '15%', marginImpact: '-7.2%', estQuantityBoost: '+28%' },
      { discount: '20%', marginImpact: '-10.5%', estQuantityBoost: '+50%' }
    ];

    await delay(1000);
    this.transitionTo('REPORTING', 'Generating marketing campaign analytics audit...');

    return {
      success: true,
      data: {
        campaignMetrics: results,
        discountSimulation
      }
    };
  }
}

// 5. Orchestrator Agent (The Lead Analyst)
export class OrchestratorAgent extends BaseAgent {
  constructor(messageBroker) {
    super(
      'Orchestrator',
      'Orchestrator Agent',
      'Lead Analyst',
      'Main entry point. Coordinates specialists, plans analyses, and synthesizes findings.'
    );
    this.broker = messageBroker;
  }

  async handleUserQuery(userQueryText) {
    this.clearLogs();
    this.transitionTo('THINKING', 'Parsing natural language query and mapping analytical steps...');
    await delay(1200);

    const queryLower = userQueryText.toLowerCase();
    
    // Determine which specialized agents we need
    const plan = [];
    
    if (queryLower.includes('sale') || queryLower.includes('revenue') || queryLower.includes('drop') || queryLower.includes('performance') || queryLower.includes('poor')) {
      plan.push('SalesAgent');
    }
    
    if (queryLower.includes('conversion') || queryLower.includes('funnel') || queryLower.includes('bug') || queryLower.includes('traffic') || queryLower.includes('mobile') || queryLower.includes('sessions')) {
      plan.push('CustomerAgent');
    }

    if (queryLower.includes('stock') || queryLower.includes('inventory') || queryLower.includes('reorder') || queryLower.includes('warehouse') || queryLower.includes('drop') || queryLower.includes('headphones')) {
      plan.push('InventoryAgent');
    }

    if (queryLower.includes('marketing') || queryLower.includes('campaign') || queryLower.includes('ad') || queryLower.includes('newsletter') || queryLower.includes('roas')) {
      plan.push('MarketingAgent');
    }

    // Default fallback if query is very general
    if (plan.length === 0) {
      plan.push('SalesAgent', 'InventoryAgent');
    }

    this.addLog(`Formulated coordination plan. Delegating sub-tasks to: ${plan.join(', ')}.`);
    
    const results = {};
    
    for (const agentName of plan) {
      this.addLog(`Sending inquiry message to ${agentName}...`);
      
      const payload = {
        sender: 'orchestrator',
        recipient: agentName,
        taskType: 'DATA_QUERY',
        parameters: {
          timeframe: { start: new Date().toISOString().split('T')[0] }
        }
      };

      // Dispatch request via broker and await specialists
      const agentResponse = await this.broker.dispatch(agentName, payload);
      results[agentName] = agentResponse.data;
      
      this.addLog(`Received analysis summary from ${agentName}.`);
    }

    // Double check dependencies:
    // If SalesAgent reports a drop and we haven't queried InventoryAgent, query it
    if (results.SalesAgent && !results.InventoryAgent) {
      const salesChange = results.SalesAgent.gmv.changePct;
      if (salesChange < -5) {
        this.addLog('Sales drop detected. Initiating secondary inquiry with InventoryAgent to cross-reference stockouts...');
        const payload = { sender: 'orchestrator', recipient: 'InventoryAgent', taskType: 'DATA_QUERY' };
        const agentResponse = await this.broker.dispatch('InventoryAgent', payload);
        results.InventoryAgent = agentResponse.data;
      }
    }

    this.transitionTo('ANALYZING', 'Correlating specialist reports and compiling final executive response...');
    await delay(1500);

    // Synthesis and Action drafting
    const responseText = this.synthesizeReport(userQueryText, results);
    const recommendations = this.generateRecommendations(results);

    this.transitionTo('REPORTING', 'Publishing final multi-agent analysis output.');
    
    return {
      analysis: responseText,
      recommendations
    };
  }

  synthesizeReport(query, results) {
    let report = `### Multi-Agent Consolidated Business Audit\n\n`;
    report += `**Query Analysed:** _"${query}"_\n\n`;

    if (results.SalesAgent) {
      const s = results.SalesAgent;
      const arrow = s.gmv.changePct >= 0 ? '📈' : '📉';
      report += `#### 💵 Financial Operations Status (Sales Agent)\n`;
      report += `- **Today's Revenue:** $${s.gmv.target.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} (vs $${s.gmv.compare.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} last week ${arrow} **${s.gmv.changePct.toFixed(1)}%**)\n`;
      report += `- **Transactions Count:** ${s.volume.target} orders (vs ${s.volume.compare} last week)\n`;
      
      const worstCat = Object.entries(s.categoryVariance)
        .sort((a, b) => a[1].changePct - b[1].changePct)[0];
      
      if (worstCat && worstCat[1].changePct < 0) {
        report += `- **Key Underperformer:** Product Category **${worstCat[0]}** dropped by **${worstCat[1].changePct.toFixed(1)}%** week-over-week.\n\n`;
      } else {
        report += `- **Category Performance:** All categories show stable growth velocities.\n\n`;
      }
    }

    if (results.InventoryAgent) {
      const i = results.InventoryAgent;
      report += `#### 📦 Inventory & Operations Audit (Inventory Agent)\n`;
      if (i.alerts.length > 0) {
        const outOfStock = i.alerts.filter(a => a.status === 'OUT_OF_STOCK');
        const lowStock = i.alerts.filter(a => a.status === 'LOW_STOCK');
        
        if (outOfStock.length > 0) {
          report += `- ⚠️ **Critical Stockout Alert:** Product(s) **${outOfStock.map(p => p.product_name).join(', ')}** are completely sold out.\n`;
        }
        if (lowStock.length > 0) {
          report += `- ⚠️ **Low Buffer Alerts:** **${lowStock.length}** item(s) are below safety stock reorder thresholds.\n`;
        }
      } else {
        report += `- ✅ **Warehouse Buffer:** All product stocks are above safety line bounds.\n`;
      }
      report += `\n`;
    }

    if (results.CustomerAgent) {
      const c = results.CustomerAgent;
      report += `#### 👥 Web Traffic & Funnel Friction (Customer Behavior Agent)\n`;
      report += `- **Total Active Web Sessions:** ${c.totalSessions}\n`;
      report += `- **Global Conversion Rate:** ${c.overallRates.overall.toFixed(2)}%\n`;
      
      if (c.anomalyDetected) {
        report += `- 🔴 **UX Anomaly Alert:** ${c.anomalyDescription}\n\n`;
      } else {
        report += `- ✅ **Funnel Diagnostics:** Landing -> Purchase funnel is converting within normal variance limits.\n\n`;
      }
    }

    if (results.MarketingAgent) {
      const m = results.MarketingAgent;
      report += `#### 📢 Advertising Effectiveness (Marketing Agent)\n`;
      m.campaignMetrics.forEach(c => {
        report += `- **${c.name}:** ROAS is **${c.roas}x** (Spend: $${c.spend.toFixed(0)}, Revenue Generated: $${c.revenue.toFixed(0)})\n`;
      });
      report += `\n`;
    }

    // Synthesis block
    report += `#### 🧠 Lead Analyst Insights Summary\n`;
    
    const hasStockout = results.InventoryAgent?.alerts.some(a => a.status === 'OUT_OF_STOCK');
    const hasFunnelBug = results.CustomerAgent?.anomalyDetected;
    const hasNewsletterSpike = results.SalesAgent?.gmv.changePct > 15 && db.scenarios.campaignSpikeActive;

    if (hasStockout && results.SalesAgent?.gmv.changePct < 0) {
      report += `The drop in sales is primarily attributed to inventory depletion. Specifically, **Wireless Headphones** went out of stock, driving weekly Electronics category revenue down. Replenishing this inventory immediately is expected to restore baseline daily sales.\n`;
    } else if (hasFunnelBug) {
      report += `Conversion funnels are failing for mobile users. A checkout script error or broken layout in the latest update is blocking mobile completions, leading to an estimated revenue leak of ~80% on mobile ad spend. Technical intervention is required immediately.\n`;
    } else if (hasNewsletterSpike) {
      report += `We observe a major positive spike in transactions driven by the weekly Email Newsletter campaign code \`FLASH20\`. Discount codes increased average quantity per order by 25%, off-setting the 20% margin reduction with volume sales.\n`;
    } else {
      report += `Operational performance is stable. Growth metrics are within healthy limits, and there are no immediate critical alerts needing engineer or operations intervention.\n`;
    }

    return report;
  }

  generateRecommendations(results) {
    const list = [];
    
    if (results.InventoryAgent && results.InventoryAgent.recommendations.length > 0) {
      results.InventoryAgent.recommendations.forEach(r => {
        list.push({
          id: `REC-STOCK-${r.product_id}`,
          title: `Restock ${r.product_name}`,
          agent: 'Inventory Agent',
          description: `Create purchase order of ${r.reorder_qty} units from default supplier. Estimated delivery lead time is ${r.estimated_lead_days} days.`,
          actionType: 'RESTOCK',
          params: { productId: r.product_id, qty: r.reorder_qty },
          impact: 'High'
        });
      });
    }

    if (results.CustomerAgent && results.CustomerAgent.anomalyDetected) {
      list.push({
        id: `REC-BUG-FIX`,
        title: `Rollback/Patch Mobile Checkout Page`,
        agent: 'Customer Behavior Agent',
        description: `Deploy high-priority bugfix to resolve mobile click handler failing during the payment step. Restore mobile conversion to historical 3.2%.`,
        actionType: 'PATCH_BUG',
        params: {},
        impact: 'Critical'
      });
    }

    if (results.MarketingAgent) {
      const lowRoasCampaign = results.MarketingAgent.campaignMetrics.find(c => c.roas < 1.2 && c.spend > 100);
      if (lowRoasCampaign) {
        list.push({
          id: `REC-BUDGET-${lowRoasCampaign.campaign_id}`,
          title: `Scale down budget for ${lowRoasCampaign.name}`,
          agent: 'Marketing Agent',
          description: `The campaign ROAS is currently underperforming (${lowRoasCampaign.roas}x). Reduce daily budget by 50% to conserve capital.`,
          actionType: 'ADJUST_BUDGET',
          params: { campaignId: lowRoasCampaign.campaign_id, budget: Math.round(lowRoasCampaign.budget * 0.5) },
          impact: 'Medium'
        });
      }
    }

    // Default recommendation if list empty
    if (list.length === 0) {
      list.push({
        id: `REC-GENERAL-AUDIT`,
        title: `Schedule Category Clearance Sale`,
        agent: 'Marketing Agent',
        description: `Create a 15% promo campaign for slow items in apparel to boost inventory turns.`,
        actionType: 'PROMO_ADVISORY',
        params: {},
        impact: 'Low'
      });
    }

    return list;
  }
}

// Helpers
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getOffsetDateStr(dateStr, offsetDays) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function filterOrdersByDate(orders, dateStr) {
  return orders.filter(o => o.order_date.startsWith(dateStr));
}
