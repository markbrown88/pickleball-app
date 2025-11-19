import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatPhoneForStorage } from '@/lib/phone';
import { sendEmail } from '@/server/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      address1,
      city,
      region,
      postalCode,
      phone,
      contactEmail,
      contactName,
      contactPhone,
      description
    } = body;

    // Validate required fields
    if (!name || !address1 || !city || !region || !postalCode || !contactEmail || !contactName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate phone format (if provided)
    if (phone && phone.replace(/\D/g, '').length !== 10) {
      return NextResponse.json(
        { error: 'Phone must be 10 digits' },
        { status: 400 }
      );
    }

    if (contactPhone && contactPhone.replace(/\D/g, '').length !== 10) {
      return NextResponse.json(
        { error: 'Contact phone must be 10 digits' },
        { status: 400 }
      );
    }

    // Check if club with same name already exists
    const existingClub = await prisma.club.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive'
        }
      }
    });

    if (existingClub) {
      return NextResponse.json(
        { error: 'A club with this name already exists' },
        { status: 409 }
      );
    }

    // Create club registration record
    const clubRegistration = await prisma.clubRegistration.create({
      data: {
        name: name.trim(),
        address1: address1.trim(),
        city: city.trim(),
        region: region.trim(),
        postalCode: postalCode.trim(),
        phone: phone ? formatPhoneForStorage(phone) : null,
        contactEmail: contactEmail.trim(),
        contactName: contactName.trim(),
        contactPhone: contactPhone?.trim() || null,
        description: description?.trim() || null,
        status: 'PENDING',
        submittedAt: new Date()
      }
    });

    // Send notification email to admins
    try {
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@klyngcup.com',
        subject: `New Club Registration: ${name}`,
        html: `
          <h2>New Club Registration</h2>
          <p><strong>Club Name:</strong> ${name}</p>
          <p><strong>Contact Name:</strong> ${contactName}</p>
          <p><strong>Contact Email:</strong> ${contactEmail}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Address:</strong> ${address1}, ${city}, ${region} ${postalCode}</p>
          ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
          <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't fail the registration if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Club registration submitted successfully',
      id: clubRegistration.id
    });

  } catch (error) {
    console.error('Club registration error:', error);
    return NextResponse.json(
      { error: 'Failed to submit club registration' },
      { status: 500 }
    );
  }
}
