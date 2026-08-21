const nodemailer = require('nodemailer');

// Initialize Transporter with environment variables
const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || '"AyurSutra Wellness" <no-reply@ayursutra.com>';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

let transporter = null;

if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

/**
 * Generate a beautifully designed, responsive, Ayurvedic-themed HTML email template.
 */
function generatePatientCredentialsHtml({ patientName, email, phone, tempPassword, patientId, clinicName, loginUrl }) {
  const portalUrl = loginUrl || `${frontendUrl}/login`;
  const clinic = clinicName || 'AyurSutra Holistic Clinic';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AyurSutra - Your Login Credentials</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f3;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #2b3a33;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(27, 67, 50, 0.08);
      border: 1px solid #e2ebe4;
    }
    .header {
      background: linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%);
      padding: 35px 25px;
      text-align: center;
      color: #ffffff;
      border-bottom: 4px solid #d4af37;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 13px;
      color: #e8f5e9;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .content {
      padding: 35px 30px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #1b4332;
      margin-bottom: 12px;
    }
    .welcome-text {
      font-size: 15px;
      line-height: 1.6;
      color: #495e54;
      margin-bottom: 25px;
    }
    .credentials-card {
      background: #f8faf7;
      border: 1px solid #d8e5db;
      border-left: 5px solid #2d6a4f;
      border-radius: 8px;
      padding: 22px;
      margin-bottom: 28px;
    }
    .card-title {
      font-size: 14px;
      font-weight: 700;
      color: #1b4332;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
    }
    .cred-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 0;
      border-bottom: 1px dashed #d8e5db;
      font-size: 14px;
    }
    .cred-row:last-child {
      border-bottom: none;
    }
    .cred-label {
      color: #5b7267;
      font-weight: 500;
    }
    .cred-value {
      color: #1b4332;
      font-weight: 700;
    }
    .password-badge {
      background: #e8f5e9;
      color: #1b4332;
      font-family: 'Courier New', Courier, monospace;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #b7dfb9;
      font-size: 16px;
      letter-spacing: 1px;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0 25px 0;
    }
    .cta-button {
      background: linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%);
      color: #ffffff !important;
      padding: 14px 34px;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      border-radius: 8px;
      display: inline-block;
      box-shadow: 0 4px 12px rgba(45, 106, 79, 0.25);
      letter-spacing: 0.5px;
    }
    .security-note {
      background: #fffdf5;
      border: 1px solid #faeec7;
      border-radius: 8px;
      padding: 14px 18px;
      font-size: 13px;
      line-height: 1.5;
      color: #856404;
      margin-bottom: 25px;
    }
    .security-note strong {
      color: #533f03;
    }
    .quote-box {
      border-top: 1px solid #e2ebe4;
      padding-top: 20px;
      text-align: center;
      font-style: italic;
      color: #728c7f;
      font-size: 13px;
    }
    .footer {
      background: #f1f4f0;
      padding: 22px;
      text-align: center;
      font-size: 12px;
      color: #728c7f;
      border-top: 1px solid #e2ebe4;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <h1>🌿 AyurSutra</h1>
      <p>Panchakarma & Holistic Care Portal</p>
    </div>

    <!-- Content -->
    <div class="content">
      <div class="greeting">Namaste, ${patientName || 'Valued Patient'}! 🙏</div>
      <div class="welcome-text">
        Welcome to <strong>${clinic}</strong>. Your personalized Ayurvedic healing and Panchakarma treatment profile has been successfully set up. You can now log in to the AyurSutra patient portal to view your treatment schedule, daily diet regimens (<em>Pathya</em>), and clinical progress.
      </div>

      <!-- Credentials Box -->
      <div class="credentials-card">
        <div class="card-title">🔐 Your Patient Login Credentials</div>
        ${patientId ? `
        <div class="cred-row">
          <span class="cred-label">Patient ID:</span>
          <span class="cred-value">${patientId}</span>
        </div>` : ''}
        <div class="cred-row">
          <span class="cred-label">Login Identifier (Phone / Email):</span>
          <span class="cred-value">${phone || email || 'Registered Mobile'}</span>
        </div>
        ${email ? `
        <div class="cred-row">
          <span class="cred-label">Registered Email:</span>
          <span class="cred-value">${email}</span>
        </div>` : ''}
        <div class="cred-row">
          <span class="cred-label">Temporary Password:</span>
          <span class="cred-value password-badge">${tempPassword}</span>
        </div>
      </div>

      <!-- Security Advisory -->
      <div class="security-note">
        <strong>🔒 Security Advisory:</strong> For your privacy and data protection, please change your temporary password immediately upon your first sign-in under <em>Profile &rarr; Security Settings</em>.
      </div>

      <!-- Sanskrit Healing Verse -->
      <div class="quote-box">
        &ldquo;Swasthyasya Swasthya Rakshanam, Aturasya Vikara Prashamanam Cha&rdquo;<br>
        <span style="font-size: 11px;">(Preserve the health of the healthy, and relieve the disorders of the ailing - Charaka Samhita)</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>This is an automated notification from ${clinic}. Please do not reply directly to this email.</p>
      <p>&copy; ${new Date().getFullYear()} AyurSutra Healthcare Technologies. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send credentials email asynchronously without blocking registration execution.
 */
async function sendPatientCredentialsEmail({
  patientName,
  email,
  phone,
  tempPassword,
  patientId = null,
  clinicName = null,
}) {
  if (!email) {
    console.log(`ℹ️ [EmailService] Skipping credentials email for patient "${patientName}" (no email provided).`);
    return { success: false, reason: 'NO_EMAIL' };
  }

  const subject = '🌿 Welcome to AyurSutra - Your Patient Login Credentials';
  const htmlContent = generatePatientCredentialsHtml({
    patientName,
    email,
    phone,
    tempPassword,
    patientId,
    clinicName,
  });

  const textContent = `
Namaste ${patientName},

Welcome to AyurSutra! Your patient account has been created.

Your Login Credentials:
- Login ID / Phone: ${phone || email}
- Temporary Password: ${tempPassword}
- Portal URL: ${frontendUrl}/login

Please change your password upon your first login.

Warm regards,
AyurSutra Wellness Team
  `;

  // If real SMTP is configured, send via nodemailer transporter
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`✅ [EmailService] Credentials email sent successfully to ${email} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`❌ [EmailService] Failed to send email to ${email}:`, err.message);
      return { success: false, error: err.message };
    }
  } else {
    // Local / Dev Fallback: Log simulated email dispatch
    console.log(`📨 [EmailService - Simulated SMTP] Credentials email prepared for: ${email}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Credentials -> User: ${phone || email} | Password: ${tempPassword}`);
    console.log(`   Portal URL: ${frontendUrl}/login`);
    return {
      success: true,
      simulated: true,
      preview: {
        to: email,
        subject,
        loginId: phone || email,
        tempPassword,
      },
    };
  }
}

module.exports = {
  sendPatientCredentialsEmail,
  generatePatientCredentialsHtml,
};
