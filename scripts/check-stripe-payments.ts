import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });

async function main() {
  const paymentIntentIds = [
    'pi_3ScFuUDnHE5trALU0JHaBDXq', // Catherine Cooke
    'pi_3Saq84DnHE5trALU0EroZnPM', // nancy romeo  
    'pi_3SVtiQDnHE5trALU48FHOPPc', // Tanya Logan
  ];

  for (const piId of paymentIntentIds) {
    try {
      const pi = await stripe.paymentIntents.retrieve(piId);
      console.log('='.repeat(50));
      console.log('Payment Intent:', piId);
      console.log('Status:', pi.status);
      console.log('Amount:', '$' + (pi.amount / 100).toFixed(2));
      console.log('Created:', new Date(pi.created * 1000).toISOString());
      if (pi.last_payment_error) {
        console.log('Error:', pi.last_payment_error.message);
      }
      console.log('Metadata:', pi.metadata);
    } catch (err: any) {
      console.log('Error fetching', piId, ':', err.message);
    }
    console.log('');
  }
}
main();
