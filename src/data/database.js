/**
 * ShopEasy Mock Database Simulation Engine
 * Simulates a relational database in memory for:
 * - Orders (historical & live-updating transactions)
 * - Sessions (web session conversion funnel analysis)
 * - Inventory (stock counts, cost and retail pricing, lead times)
 * - Campaigns (marketing performance and spend metrics)
 */

export class MockDatabase {
  constructor() {
    this.reset();
  }

  reset() {
    this.products = [
      { product_id: 'PROD-001', product_name: 'Wireless Headphones', category: 'Electronics', stock_level: 120, reorder_point: 40, cost_price: 45.00, retail_price: 99.99, lead_time_days: 5 },
      { product_id: 'PROD-002', product_name: 'Smart Watch', category: 'Electronics', stock_level: 85, reorder_point: 30, cost_price: 90.00, retail_price: 199.99, lead_time_days: 7 },
      { product_id: 'PROD-003', product_name: 'Running Shoes', category: 'Apparel', stock_level: 150, reorder_point: 50, cost_price: 35.00, retail_price: 89.99, lead_time_days: 4 },
      { product_id: 'PROD-004', product_name: 'Designer Leather Jacket', category: 'Apparel', stock_level: 45, reorder_point: 15, cost_price: 120.00, retail_price: 299.99, lead_time_days: 10 },
      { product_id: 'PROD-005', product_name: 'Ergonomic Office Chair', category: 'Home', stock_level: 60, reorder_point: 20, cost_price: 110.00, retail_price: 249.99, lead_time_days: 8 },
      { product_id: 'PROD-006', product_name: 'Acoustic Guitar', category: 'Home', stock_level: 35, reorder_point: 10, cost_price: 75.00, retail_price: 179.99, lead_time_days: 12 },
      { product_id: 'PROD-007', product_name: 'Adjustable Dumbbells', category: 'Fitness', stock_level: 50, reorder_point: 15, cost_price: 160.00, retail_price: 349.99, lead_time_days: 6 },
      { product_id: 'PROD-008', product_name: 'Yoga Mat', category: 'Fitness', stock_level: 200, reorder_point: 60, cost_price: 12.00, retail_price: 39.99, lead_time_days: 3 }
    ];

    this.campaigns = [
      { campaign_id: 'CAMP-01', name: 'Google Search Ad', status: 'active', budget: 1500, ad_spend: 1200, impressions: 45000, clicks: 1800, revenue_generated: 4120.50 },
      { campaign_id: 'CAMP-02', name: 'Instagram Influencer Promo', status: 'active', budget: 2000, ad_spend: 1950, impressions: 90000, clicks: 3500, revenue_generated: 7840.00 },
      { campaign_id: 'CAMP-03', name: 'Weekly Email Newsletter', status: 'active', budget: 300, ad_spend: 250, impressions: 8000, clicks: 950, revenue_generated: 1250.25 },
      { campaign_id: 'CAMP-04', name: 'Facebook Retargeting Ads', status: 'active', budget: 1000, ad_spend: 850, impressions: 30000, clicks: 1200, revenue_generated: 2310.80 }
    ];

    this.orders = [];
    this.sessions = [];
    
    // Scenario active flags
    this.scenarios = {
      stockoutCrisisActive: false,
      checkoutFunnelBugActive: false,
      campaignSpikeActive: false
    };

    this.historicalDays = 30;
    this.generateBaselineHistory();
  }

  // Generates 30 days of historical baseline records
  generateBaselineHistory() {
    const today = new Date();
    
    for (let i = this.historicalDays; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      // Determine if a specific day should exhibit scenario properties
      // (Used to draw beautiful, context-rich chart anomaly points)
      let dailyStockout = false;
      let dailyBug = false;
      let dailySpike = false;

      // Make day 5 (5 days ago) a checkout bug day for historical reference
      if (i === 5) dailyBug = true;
      // Make day 12 (12 days ago) a stockout crisis day
      if (i === 12) dailyStockout = true;
      // Make day 20 (20 days ago) a marketing flash sale spike day
      if (i === 20) dailySpike = true;

      this.generateDailyData(date, dailyStockout, dailyBug, dailySpike);
    }
  }

  generateDailyData(date, isStockout = false, isBug = false, isSpike = false) {
    const dateStr = date.toISOString().split('T')[0];
    
    // Base traffic parameters
    let visitorCount = Math.floor(800 + Math.random() * 400); // 800-1200 base sessions
    if (isSpike) {
      visitorCount = Math.floor(2500 + Math.random() * 500); // Campaign traffic boost
    }

    const deviceDist = { mobile: 0.55, desktop: 0.38, tablet: 0.07 };
    const referrers = ['Google', 'Direct', 'Instagram', 'Facebook', 'Newsletter'];
    const referrerDist = isSpike 
      ? [0.15, 0.10, 0.20, 0.10, 0.45] // Email newsletter spike
      : [0.35, 0.20, 0.22, 0.13, 0.10]; // Normal distribution

    for (let s = 0; s < visitorCount; s++) {
      const sessionId = `SESS-${dateStr.replace(/-/g, '')}-${10000 + s}`;
      const customerId = `CUST-${Math.floor(5000 + Math.random() * 200)}`;
      
      // Roll device
      const devRoll = Math.random();
      let device = 'mobile';
      if (devRoll > deviceDist.mobile + deviceDist.desktop) device = 'tablet';
      else if (devRoll > deviceDist.mobile) device = 'desktop';

      // Roll referrer
      const refRoll = Math.random();
      let referrer = referrers[0];
      let sum = 0;
      for (let r = 0; r < referrers.length; r++) {
        sum += referrerDist[r];
        if (refRoll <= sum) {
          referrer = referrers[r];
          break;
        }
      }

      // Funnel Stages: landing -> product_view -> add_to_cart -> checkout_page -> completed
      let stage = 'landing';
      let duration = Math.floor(5 + Math.random() * 20);
      let pages = 1;

      // Funnel probabilities
      let pView = 0.70;
      let pCart = 0.45;
      let pCheck = 0.60;
      let pComp = 0.70; // 0.7 * 0.6 * 0.45 * 0.7 = ~13% of view, overall ~3% conversion

      // Mobile buggy checkout scenario drops checkout -> completed conversion
      if (isBug && device === 'mobile') {
        pComp = 0.05; // Drop mobile checkout success from 70% to 5%
      }

      if (Math.random() < pView) {
        stage = 'product_view';
        duration += Math.floor(15 + Math.random() * 45);
        pages += Math.floor(1 + Math.random() * 3);

        if (Math.random() < pCart) {
          stage = 'add_to_cart';
          duration += Math.floor(30 + Math.random() * 90);
          pages += Math.floor(2 + Math.random() * 4);

          if (Math.random() < pCheck) {
            stage = 'checkout_page';
            duration += Math.floor(45 + Math.random() * 120);
            pages += Math.floor(1 + Math.random() * 2);

            if (Math.random() < pComp) {
              stage = 'completed';
              duration += Math.floor(60 + Math.random() * 180);
              pages += 1;
            }
          }
        }
      }

      // Store session
      const timestamp = new Date(date);
      timestamp.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
      
      this.sessions.push({
        session_id: sessionId,
        customer_id: customerId,
        timestamp: timestamp.toISOString(),
        device_type: device,
        referrer: referrer,
        duration_seconds: duration,
        pages_viewed: pages,
        funnel_stage: stage
      });

      // If session converted, create corresponding order
      if (stage === 'completed') {
        // Roll product
        let productIdx = Math.floor(Math.random() * this.products.length);
        
        // Stockout scenario forces wireless headphones (PROD-001) to not be sold
        if (isStockout && productIdx === 0) {
          // Re-roll product index to something else
          productIdx = Math.floor(1 + Math.random() * (this.products.length - 1));
        }

        const product = this.products[productIdx];
        const quantity = Math.random() < 0.8 ? 1 : Math.random() < 0.9 ? 2 : 3;
        const discountApplied = isSpike && referrer === 'Newsletter' ? 20.0 : 0.0;
        
        const unitPrice = product.retail_price;
        const totalAmount = Number((unitPrice * quantity * (1 - discountApplied / 100)).toFixed(2));
        const orderId = `ORD-${dateStr.replace(/-/g, '')}-${1000 + this.orders.length}`;

        // Deduct from mock stocks (historical seeding bypasses full warning checks but decrements)
        if (product.stock_level > quantity) {
          product.stock_level -= quantity;
        }

        this.orders.push({
          order_id: orderId,
          customer_id: customerId,
          order_date: timestamp.toISOString(),
          product_id: product.product_id,
          quantity: quantity,
          unit_price: unitPrice,
          total_amount: totalAmount,
          payment_status: 'success',
          discount_applied: discountApplied
        });

        // Track revenue on campaigns if referral was ad
        if (referrer === 'Google') {
          this.campaigns[0].revenue_generated += totalAmount;
        } else if (referrer === 'Instagram') {
          this.campaigns[1].revenue_generated += totalAmount;
        } else if (referrer === 'Newsletter') {
          this.campaigns[2].revenue_generated += totalAmount;
        } else if (referrer === 'Facebook') {
          this.campaigns[3].revenue_generated += totalAmount;
        }
      }
    }
  }

  // Simulation step running in real-time (called on clock ticks, e.g. every 5 seconds)
  simulateTick() {
    const now = new Date();
    
    // Determine active scenario flags
    const isStockout = this.scenarios.stockoutCrisisActive;
    const isBug = this.scenarios.checkoutFunnelBugActive;
    const isSpike = this.scenarios.campaignSpikeActive;

    // Force stock level to 0 if stockout crisis is active
    if (isStockout) {
      const prod1 = this.products.find(p => p.product_id === 'PROD-001');
      if (prod1) prod1.stock_level = 0;
    }

    // Tick generates a miniature batch of traffic (e.g. 5-15 sessions)
    const newSessionsCount = isSpike ? Math.floor(15 + Math.random() * 15) : Math.floor(2 + Math.random() * 5);
    
    const deviceDist = { mobile: 0.55, desktop: 0.38, tablet: 0.07 };
    const referrers = ['Google', 'Direct', 'Instagram', 'Facebook', 'Newsletter'];
    const referrerDist = isSpike 
      ? [0.15, 0.10, 0.20, 0.10, 0.45] 
      : [0.35, 0.20, 0.22, 0.13, 0.10];

    const timestampStr = now.toISOString();

    for (let s = 0; s < newSessionsCount; s++) {
      const dateStr = timestampStr.split('T')[0];
      const sessionId = `SESS-LIVE-${Math.floor(Math.random() * 100000)}`;
      const customerId = `CUST-${Math.floor(5000 + Math.random() * 200)}`;
      
      const devRoll = Math.random();
      let device = 'mobile';
      if (devRoll > deviceDist.mobile + deviceDist.desktop) device = 'tablet';
      else if (devRoll > deviceDist.mobile) device = 'desktop';

      const refRoll = Math.random();
      let referrer = referrers[0];
      let sum = 0;
      for (let r = 0; r < referrers.length; r++) {
        sum += referrerDist[r];
        if (refRoll <= sum) {
          referrer = referrers[r];
          break;
        }
      }

      let stage = 'landing';
      let duration = Math.floor(5 + Math.random() * 10);
      let pages = 1;

      let pView = 0.70;
      let pCart = 0.45;
      let pCheck = 0.60;
      let pComp = 0.70;

      if (isBug && device === 'mobile') {
        pComp = 0.05; // Check out page conversion bottleneck
      }

      if (Math.random() < pView) {
        stage = 'product_view';
        duration += Math.floor(10 + Math.random() * 25);
        pages += Math.floor(1 + Math.random() * 2);

        if (Math.random() < pCart) {
          stage = 'add_to_cart';
          duration += Math.floor(20 + Math.random() * 40);
          pages += Math.floor(1 + Math.random() * 3);

          if (Math.random() < pCheck) {
            stage = 'checkout_page';
            duration += Math.floor(20 + Math.random() * 40);
            pages += 1;

            if (Math.random() < pComp) {
              stage = 'completed';
              duration += Math.floor(30 + Math.random() * 60);
              pages += 1;
            }
          }
        }
      }

      this.sessions.push({
        session_id: sessionId,
        customer_id: customerId,
        timestamp: timestampStr,
        device_type: device,
        referrer: referrer,
        duration_seconds: duration,
        pages_viewed: pages,
        funnel_stage: stage
      });

      if (stage === 'completed') {
        let productIdx = Math.floor(Math.random() * this.products.length);
        if (isStockout && productIdx === 0) {
          productIdx = Math.floor(1 + Math.random() * (this.products.length - 1));
        }

        const product = this.products[productIdx];
        
        // Ensure stock is available
        if (product.stock_level > 0) {
          const quantity = Math.random() < 0.95 ? 1 : 2;
          const discountApplied = isSpike && referrer === 'Newsletter' ? 20.0 : 0.0;
          const unitPrice = product.retail_price;
          const totalAmount = Number((unitPrice * quantity * (1 - discountApplied / 100)).toFixed(2));
          const orderId = `ORD-LIVE-${Math.floor(Math.random() * 100000)}`;

          product.stock_level = Math.max(0, product.stock_level - quantity);

          this.orders.push({
            order_id: orderId,
            customer_id: customerId,
            order_date: timestampStr,
            product_id: product.product_id,
            quantity: quantity,
            unit_price: unitPrice,
            total_amount: totalAmount,
            payment_status: 'success',
            discount_applied: discountApplied
          });

          // Attribute campaign revenue
          let campaign = null;
          if (referrer === 'Google') campaign = this.campaigns[0];
          else if (referrer === 'Instagram') campaign = this.campaigns[1];
          else if (referrer === 'Newsletter') campaign = this.campaigns[2];
          else if (referrer === 'Facebook') campaign = this.campaigns[3];

          if (campaign) {
            campaign.revenue_generated = Number((campaign.revenue_generated + totalAmount).toFixed(2));
          }
        }
      }
    }

    // Increment ad spend slowly over time for active campaigns
    this.campaigns.forEach(c => {
      if (c.status === 'active') {
        const costMultiplier = isSpike && c.campaign_id === 'CAMP-03' ? 5.0 : 1.0;
        const incrementalSpend = Number((Math.random() * 0.5 * costMultiplier).toFixed(2));
        const newImpressions = Math.floor(Math.random() * 10 * costMultiplier);
        const newClicks = Math.random() < 0.04 ? 1 : 0;
        
        c.ad_spend = Number((c.ad_spend + incrementalSpend).toFixed(2));
        c.impressions += newImpressions;
        c.clicks += newClicks;
      }
    });
  }

  // API query simulation helpers for specialized agents
  query(sqlQueryStr) {
    // Basic parser to mimic standard DB queries and return results
    const normalized = sqlQueryStr.toLowerCase();
    
    if (normalized.includes('select') && normalized.includes('orders')) {
      // Return order list or aggregations
      if (normalized.includes('group by product_id') || normalized.includes('group by category')) {
        // Mock structured query output
        return this.products.map(p => {
          const matchingOrders = this.orders.filter(o => o.product_id === p.product_id);
          const revenue = matchingOrders.reduce((sum, o) => sum + o.total_amount, 0);
          const quantitySold = matchingOrders.reduce((sum, o) => sum + o.quantity, 0);
          return {
            product_id: p.product_id,
            product_name: p.product_name,
            category: p.category,
            total_sales_qty: quantitySold,
            revenue_generated: Number(revenue.toFixed(2))
          };
        });
      }
      return this.orders;
    }
    
    if (normalized.includes('select') && normalized.includes('inventory')) {
      return this.products.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        category: p.category,
        stock_level: p.stock_level,
        reorder_point: p.reorder_point,
        cost_price: p.cost_price,
        retail_price: p.retail_price,
        lead_time_days: p.lead_time_days
      }));
    }

    if (normalized.includes('select') && normalized.includes('sessions')) {
      return this.sessions;
    }

    if (normalized.includes('select') && normalized.includes('campaigns')) {
      return this.campaigns;
    }

    return { error: 'Unknown query table context' };
  }

  // Action mutations (from recommendations approved by user)
  restockProduct(productId, amount) {
    const product = this.products.find(p => p.product_id === productId);
    if (product) {
      product.stock_level += amount;
      return { success: true, new_stock: product.stock_level };
    }
    return { success: false, error: 'Product not found' };
  }

  fixCheckoutBug() {
    this.scenarios.checkoutFunnelBugActive = false;
    return { success: true, message: 'Checkout funnel bug patched!' };
  }

  adjustCampaignBudget(campaignId, newBudget) {
    const campaign = this.campaigns.find(c => c.campaign_id === campaignId);
    if (campaign) {
      campaign.budget = newBudget;
      return { success: true, new_budget: campaign.budget };
    }
    return { success: false, error: 'Campaign not found' };
  }
}

// Global instance exports
export const db = new MockDatabase();
