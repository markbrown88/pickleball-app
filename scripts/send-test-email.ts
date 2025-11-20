import { sendRegistrationConfirmationEmail } from '../src/server/email';

async function sendTestEmail() {
  try {
    console.log('Sending test registration confirmation email...');

    await sendRegistrationConfirmationEmail({
      to: 'markbrown8@gmail.com',
      playerName: 'Mark Brown',
      tournamentName: 'Test Tournament - 2025 Championship',
      tournamentId: 'test-123',
      startDate: new Date('2025-03-15'),
      endDate: new Date('2025-03-17'),
      location: 'Test Venue',
      isPaid: true,
      amountPaid: 5000, // $50.00
      registrationDate: new Date(),
      stops: [
        {
          id: 'stop-1',
          name: 'Stop 1 - Opening Weekend',
          startAt: new Date('2025-03-15T09:00:00Z'),
          endAt: new Date('2025-03-15T17:00:00Z'),
          bracketName: 'Mixed Doubles',
          club: {
            name: 'Downtown Pickleball Club',
            address1: '123 Main Street',
            city: 'Toronto',
            region: 'ON',
            postalCode: 'M5V 2T6',
          }
        },
        {
          id: 'stop-2',
          name: 'Stop 2 - Championship Finals',
          startAt: new Date('2025-03-17T09:00:00Z'),
          endAt: new Date('2025-03-17T18:00:00Z'),
          bracketName: 'Mixed Doubles',
          club: {
            name: 'Uptown Sports Center',
            address1: '456 Queen Street West',
            city: 'Toronto',
            region: 'ON',
            postalCode: 'M5V 3A1',
          }
        }
      ],
      clubName: 'Toronto Pickleball Club',
    });

    console.log('✓ Test email sent successfully to markbrown8@gmail.com');
    console.log('Check your inbox for the registration confirmation email with:');
    console.log('  - Klyng Cup logo');
    console.log('  - Tournament stops with Google Maps links');
    console.log('  - "See you on the court! 🏓" footer');
  } catch (error) {
    console.error('✗ Failed to send test email:', error);
    throw error;
  }
}

sendTestEmail();
