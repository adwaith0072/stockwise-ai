import { Email } from "@convex-dev/auth/providers/Email";
import { alphabet, generateRandomString } from "oslo/crypto";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  generateVerificationToken() {
    return generateRandomString(6, alphabet("0-9"));
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.AUTH_EMAIL_FROM || "StockWise AI <onboarding@resend.dev>";

    if (!resendApiKey) {
      console.info(
        `[DEV OTP] Verification code for ${email}: ${token} (Configure RESEND_API_KEY in Convex environment variables to send emails in production)`,
      );
      return;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Your StockWise AI Verification Code",
        html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="margin-bottom: 12px;">StockWise AI Verification Code</h2>
          <p style="color: #3f3f46;">Use the following 6-digit verification code to sign in. This code expires in 15 minutes.</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 16px; background: #f4f4f5; text-align: center; border-radius: 6px; margin: 20px 0;">${token}</div>
          <p style="color: #71717a; font-size: 12px;">If you did not request this code, you can safely ignore this email.</p>
        </div>`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Failed to send verification email via Resend (${response.status}): ${errorText}`,
      );
    }
  },
});
