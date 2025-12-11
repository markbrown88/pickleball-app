import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });

async function main() {
  // First, let's see what account we're connected to
  const account = await stripe.accounts.retrieve();
  console.log('Connected Stripe Account:', account.id);
  console.log('Account Email:', account.email);
  console.log('');

  // Search for recent payments by email
  const emails = [
    'ccooke11@cogeco.ca',      // Catherine Cooke
    'nancyromeo3012@gmail.com', // nancy romeo
    'thworx@hotmail.com',       // Tanya Logan
  ];

  for (const email of emails) {
    console.log('='.repeat(50));
    console.log('Searching for:', email);
    
    // Search payment intents
    const paymentIntents = await stripe.paymentIntents.search({
      query: `metadata["customer_email"]:"${email}"`,
      limit: 5
    });
    
    if (paymentIntents.data.length > 0) {
      console.log('Found payment intents:', paymentIntents.data.length);
      for (const pi of paymentIntents.data) {
        console.log('  -', pi.id, pi.status, '$' + (pi.amount/100).toFixed(2));
      }
    } else {
      console.log('No payment intents found');
    }

    // Search charges
    const charges = await stripe.charges.search({
      query: `metadata["customer_email"]:"${email}"`,
      limit: 5
    });

    if (charges.data.length > 0) {
      console.log('Found charges:', charges.data.length);
      for (const c of charges.data) {
        console.log('  -', c.id, c.status, '$' + (c.amount/100).toFixed(2));
      }
    }
    console.log('');
  }
}
main();
