import Razorpay from 'razorpay';
import { env } from './env.js';

let instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!instance) {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys are missing from environment');
    }
    instance = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return instance;
}
