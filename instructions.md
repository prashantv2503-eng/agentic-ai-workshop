# ShopEasy Multi-Agent Data Analyst System: Operation & Simulation Instructions

This document provides configuration, schema, and simulation guidelines for implementing the **ShopEasy Data Analyst Agent** dashboard.

---

## 1. Mock Database Schemas

To enable agents to perform meaningful queries, the application will maintain a mock relational database in-memory. Below are the key tables and fields:

### `Orders` Table
*   `order_id`: String (e.g., `ORD-1001`)
*   `customer_id`: String (e.g., `CUST-5002`)
*   `order_date`: ISO String
*   `product_id`: String (e.g., `PROD-001`)
*   `quantity`: Integer
*   `unit_price`: Float
*   `total_amount`: Float
*   `payment_status`: String (`success`, `failed`, `refunded`)
*   `discount_applied`: Float (percentage, e.g., `15.0`)

### `Sessions` (Behavioral) Table
*   `session_id`: String (e.g., `SESS-9988`)
*   `customer_id`: String
*   `timestamp`: ISO String
*   `device_type`: String (`mobile`, `desktop`, `tablet`)
*   `referrer`: String (`Google`, `Direct`, `Instagram`, `Facebook`, `Newsletter`)
*   `duration_seconds`: Integer
*   `pages_viewed`: Integer
*   `funnel_stage`: String (`landing`, `product_view`, `add_to_cart`, `checkout_page`, `completed`)

### `Inventory` Table
*   `product_id`: String (e.g., `PROD-001`)
*   `product_name`: String
*   `category`: String (`Electronics`, `Apparel`, `Home`, `Fitness`)
*   `stock_level`: Integer
*   `reorder_point`: Integer
*   `cost_price`: Float
*   `retail_price`: Float
*   `lead_time_days`: Integer

### `Campaigns` Table
*   `campaign_id`: String (e.g., `CAMP-01`)
*   `name`: String (e.g., `Summer Clearance`)
*   `status`: String (`active`, `paused`, `completed`)
*   `budget`: Float
*   `ad_spend`: Float
*   `impressions`: Integer
*   `clicks`: Integer
*   `revenue_generated`: Float

---

## 2. Interactive Scenarios (Simulated Crises/Events)

The dashboard will allow the user to trigger pre-packaged operational events to test the multi-agent system.

### Scenario A: "The Out of Stock Crisis"
*   **Trigger**: A popular high-margin item (e.g., `PROD-001` - wireless headphones) runs out of stock.
*   **Result**: Sales for the category drop.
*   **Expected Agent Behavior**:
    1.  *User* queries: "Why did revenue drop this morning?"
    2.  *Orchestrator* asks *Sales Agent* for sales trends.
    3.  *Sales Agent* reports drop in headphones revenue.
    4.  *Orchestrator* asks *Inventory Agent* for stocks of top items.
    5.  *Inventory Agent* reports `PROD-001` is at 0 stock and was selling 50 units/day.
    6.  *Orchestrator* concludes the drop was due to stockout, drafts restock request, and estimates lost revenue.

### Scenario B: "The Checkout Funnel Leak"
*   **Trigger**: A buggy checkout page update causes mobile user conversion rates to drop by 80%.
*   **Expected Agent Behavior**:
    1.  *User* queries: "Are our conversion rates normal today?"
    2.  *Orchestrator* asks *Customer Behavior Agent* for conversion funnel metrics.
    3.  *Customer Behavior Agent* computes funnel, segments by device, and highlights mobile conversion drop from 3.5% to 0.4% at the `checkout_page -> completed` transition.
    4.  *Orchestrator* issues alert, suggesting a bug in the mobile checkout flow, and links it to active campaigns to show lost spend.

### Scenario C: "The Flash Sale Spike"
*   **Trigger**: A flash marketing email goes out with a 20% discount code.
*   **Expected Agent Behavior**:
    1.  *User* queries: "How is our latest newsletter campaign performing?"
    2.  *Orchestrator* coordinates with *Marketing Agent* and *Sales Agent*.
    3.  *Marketing Agent* tracks clicks and coupon usage.
    4.  *Sales Agent* correlates time of email with orders.
    5.  *Orchestrator* presents campaign ROAS and lists top purchased items using the discount.

---

## 3. Agent Execution Engine (Frontend Simulation)

To run without requiring complex backend servers, the agent execution loop will be simulated in frontend JavaScript using structured prompts sent to a local LLM or simulated through intelligent deterministic template rules (or a toggle between a mock LLM generator and a real API key integration). 

### Step-by-Step Agent Agentic Loop:
1.  **Parse Request**: Orchestrator builds the execution flow.
2.  **Dispatch**: Tasks are sent to corresponding agents.
3.  **Visualization of Thinking**: UI updates showing "Agent is querying data...", showing the actual SQL/Pandas code generated.
4.  **Consolidated Report**: The results are presented in a conversational markdown-rendered format alongside dynamically refreshed charts.
5.  **Actions Generated**: Actionable recommendations appear in an approval panel (e.g., "Reorder 500 units of PROD-001 from Supplier X").
