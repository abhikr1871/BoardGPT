import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { env, razorpayEnabled } from '../env.js';
import { getRazorpay } from '../razorpay.js';
import { UserModel } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../types.js';

const router = Router();

function razorpayUnavailable(res: Response): void {
  res.status(503).json({
    error: 'Payments are not configured on this server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable checkout.',
  });
}

const PRICE_MAP: Record<string, number> = {
  monthly: 9900, // INR in paise (₹99)
  yearly: 79900, // INR in paise (₹799)
};

router.post('/create-order', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!razorpayEnabled()) {
    razorpayUnavailable(res);
    return;
  }
  const rzp = getRazorpay();
  const { userId } = req as AuthedRequest;
  const interval = (req.body?.interval as string) === 'yearly' ? 'yearly' : 'monthly';
  const amount = PRICE_MAP[interval] || 79900;

  const user = await UserModel.findById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const order = (await rzp.orders.create({
    amount,
    currency: 'INR',
    receipt: userId,
  })) as any;

  res.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: env.RAZORPAY_KEY_ID,
  });
}));

router.post('/verify', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!razorpayEnabled()) {
    razorpayUnavailable(res);
    return;
  }
  
  const { userId } = req as AuthedRequest;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: 'Missing payment verification details' });
    return;
  }

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    res.status(400).json({ error: 'Invalid payment signature' });
    return;
  }

  // Payment is authentic! Upgrade the user.
  const user = await UserModel.findById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  user.plan = 'premium';
  await user.save();

  res.json({ success: true });
}));

export default router;
