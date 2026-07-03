#!/usr/bin/env node
// Creates the two BoardGPT Razorpay subscription Plans (monthly ₹99, yearly ₹799)
// and prints their plan IDs so you can paste them into .env.
//
// Usage:
//   1. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server-cloud/.env
//   2. npm run create-plans
//   3. Copy the printed RAZORPAY_PLAN_MONTHLY / RAZORPAY_PLAN_YEARLY into .env
//
// Idempotency note: Razorpay does NOT dedupe plans — running this twice creates
// two more plans. Run it once, save the IDs, and reuse them.

import 'dotenv/config';
import Razorpay from 'razorpay';

const keyId = (process.env.RAZORPAY_KEY_ID ?? '').trim();
const keySecret = (process.env.RAZORPAY_KEY_SECRET ?? '').trim();

if (!keyId || !keySecret) {
  console.error(
    'Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET. Set them in server-cloud/.env first ' +
      '(get them from https://dashboard.razorpay.com/app/keys).',
  );
  process.exit(1);
}

const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

// Amounts are in paise (the INR subunit): ₹99 = 9900, ₹799 = 79900.
const PLANS = [
  {
    envVar: 'RAZORPAY_PLAN_MONTHLY',
    period: 'monthly',
    interval: 1,
    item: { name: 'BoardGPT Premium (Monthly)', amount: 9900, currency: 'INR' },
  },
  {
    envVar: 'RAZORPAY_PLAN_YEARLY',
    period: 'yearly',
    interval: 1,
    item: { name: 'BoardGPT Premium (Yearly)', amount: 79900, currency: 'INR' },
  },
];

async function main() {
  const results = [];
  for (const plan of PLANS) {
    const created = await razorpay.plans.create({
      period: plan.period,
      interval: plan.interval,
      item: plan.item,
      notes: { product: 'boardgpt-premium' },
    });
    const rupees = (Number(created.item.amount) / 100).toFixed(2);
    console.log(
      `Created ${plan.period} plan: ${created.id} (₹${rupees} ${created.item.currency})`,
    );
    results.push({ envVar: plan.envVar, id: created.id });
  }

  console.log('\nPaste these into server-cloud/.env:\n');
  for (const r of results) {
    console.log(`${r.envVar}=${r.id}`);
  }
}

main().catch((err) => {
  const message = err?.error?.description || err?.message || String(err);
  console.error('\nFailed to create plans:', message);
  process.exit(1);
});
