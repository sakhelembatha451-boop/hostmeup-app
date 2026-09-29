// Helper function to generate checkout redirection or payload
export interface CheckoutPayload {
  bookingId: string;
  paymentType: 'deposit' | 'remaining';
  amount: number;
}

export async function createCheckoutSession(payload: CheckoutPayload) {
  try {
    const { bookingId, paymentType, amount } = payload;

    if (!bookingId || !amount) {
      throw new Error('Missing required booking details for checkout.');
    }

    // Replace URL below with your PayFast / Stripe gateway link when ready
    const checkoutUrl = `https://your-payment-gateway.com/pay?booking=${bookingId}&type=${paymentType}&amount=${amount}`;

    return { success: true, url: checkoutUrl };
  } catch (error) {
    console.error('Checkout creation error:', error);
    return { success: false, error };
  }
}
