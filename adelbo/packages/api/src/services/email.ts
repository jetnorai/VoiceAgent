import sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@adelbo.com';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Adelbo';

export async function sendOTP(email: string, token: string): Promise<void> {
  try {
    await sgMail.send({
      to: email,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: `Your Adelbo sign-in code: ${token}`,
      text: `Your Adelbo sign-in code is: ${token}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
      html: `
        <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #060609; color: #f5f5f0;">
          <img src="https://adelbo.com/logo.png" alt="Adelbo" style="height: 32px; margin-bottom: 32px;" />
          <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Your sign-in code</h2>
          <p style="color: #9ca3af; margin-bottom: 24px;">Enter this code to sign in to Adelbo. It expires in 10 minutes.</p>
          <div style="background: #0d0d14; border: 1px solid #1f1f2e; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 40px; font-weight: 900; letter-spacing: 8px; color: #e8a838; font-family: 'Outfit', sans-serif;">${token}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this sign-in code, you can safely ignore this email. Your account is secure.</p>
        </div>
      `,
    });
    logger.info('OTP email sent', { email });
  } catch (err: any) {
    logger.error('Failed to send OTP email', { email, error: err.message });
    throw err;
  }
}

export async function sendBookingConfirmation(
  email: string,
  data: {
    bookingId: string;
    hotelId: string;
    checkIn: string;
    checkOut: string;
    totalAmount: string;
    currency: string;
    travelCreditEarned: string;
  }
): Promise<void> {
  try {
    const checkIn = new Date(data.checkIn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const checkOut = new Date(data.checkOut).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    await sgMail.send({
      to: email,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: 'Your booking is confirmed',
      text: `Your Adelbo booking is confirmed.\n\nCheck-in: ${checkIn}\nCheck-out: ${checkOut}\nTotal: ${data.currency} ${data.totalAmount}\n\nTravel Credit to earn on completion: ${data.currency} ${data.travelCreditEarned}\n\nView your booking: https://adelbo.com/trips/${data.bookingId}`,
      html: `
        <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #060609; color: #f5f5f0;">
          <img src="https://adelbo.com/logo.png" alt="Adelbo" style="height: 32px; margin-bottom: 32px;" />
          <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Booking confirmed</h2>
          <p style="color: #9ca3af; margin-bottom: 24px;">Everything is set. Here are your stay details.</p>
          <div style="background: #0d0d14; border: 1px solid #1f1f2e; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #6b7280;">Check-in</span>
              <span style="font-weight: 600;">${checkIn}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #6b7280;">Check-out</span>
              <span style="font-weight: 600;">${checkOut}</span>
            </div>
            <div style="border-top: 1px solid #1f1f2e; padding-top: 12px; margin-top: 12px; display: flex; justify-content: space-between;">
              <span style="color: #6b7280;">Total paid</span>
              <span style="font-weight: 700; color: #e8a838;">${data.currency} ${data.totalAmount}</span>
            </div>
          </div>
          <div style="background: #0d1a0d; border: 1px solid #1a3d1a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; color: #6b9e6b;">
              After your stay completes, you'll earn <strong style="color: #22c55e;">${data.currency} ${data.travelCreditEarned}</strong> in Travel Credit.
            </p>
          </div>
          <a href="https://adelbo.com/trips/${data.bookingId}" style="display: block; background: #e8a838; color: #060609; font-weight: 700; text-align: center; padding: 14px 24px; border-radius: 10px; text-decoration: none;">View booking</a>
        </div>
      `,
    });
  } catch (err: any) {
    logger.error('Failed to send booking confirmation', { email, error: err.message });
  }
}
