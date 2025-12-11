import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });

async function main() {
  // Check checkout sessions for all failed registrations
  const sessionIds = [
    { name: 'Miralyn Lopez', id: 'cs_live_b1yhhsOz0j8jzJtXeJ2e2Jljw5udj1UEgRzQtUBYXxfbyJk8wk6WWAxnL9' },
    { name: 'Catherine Cooke', id: 'cs_live_b1AajzLOepHxACxNy0oIKyfynI9esbD0dEFXfIyY4eERzJsdh0Gz5xMytu' },
    { name: 'Phil Milanis', id: 'cs_live_b1ACkV7p66fmXFYdpLYYpvrIHtvh76SA7zZYIzYrouyC47b18xynPjHO94' },
    { name: 'Patricia Beaver', id: 'cs_live_b1FeSqjbxvzExmxEQ08PLNPEv8DJ1vI87seDNacJt47CE5V4FxftOi7J5e' },
    { name: 'nancy romeo', id: 'cs_live_b1iTlkcWJM4DOigb05uAzc94tBDbKYx7OQeeAfecWo479I7WdC9IQMgx7Y' },
    { name: 'Tanya Logan', id: 'cs_live_b1srzaSsZ2qy2s2L58VsOckHYwiCklFBoFFmMWYdwVesp3kEY9iaHXwhQo' },
    { name: 'Gina Facca', id: 'cs_live_b1XVRILsCNLcMCIvf3doSIPtLhW4NmS6riaIsBEQiO9rMk1ySCERi9XyCL' },
    { name: 'Mark Cecchetto', id: 'cs_live_b177Uicsdtw6P84v6UbqotFkQz1KJS8fQuW5PCigkFkJFGIsAn8uJiDiwL' },
  ];

  for (const { name, id } of sessionIds) {
    try {
      const session = await stripe.checkout.sessions.retrieve(id);
      console.log('='.repeat(50));
      console.log('Player:', name);
      console.log('Session Status:', session.status);
      console.log('Payment Status:', session.payment_status);
      console.log('Amount Total:', session.amount_total ? '$' + (session.amount_total / 100).toFixed(2) : 'N/A');
      console.log('Payment Intent:', session.payment_intent || 'N/A');
      console.log('Created:', new Date(session.created * 1000).toISOString());
      if (session.payment_intent) {
        try {
          const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
          console.log('PI Status:', pi.status);
          console.log('PI Amount:', '$' + (pi.amount / 100).toFixed(2));
        } catch (e: any) {
          console.log('PI Error:', e.message);
        }
      }
    } catch (err: any) {
      console.log('='.repeat(50));
      console.log('Player:', name);
      console.log('Error:', err.message);
    }
    console.log('');
  }
}
main();
