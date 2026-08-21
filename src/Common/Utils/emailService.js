const nodemailer = require('nodemailer');

/**
 * Helper to dynamically obtain or create a Nodemailer transporter.
 * Supports SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL.
 */
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }
  return null;
}

/**
 * Returns the default FROM email header.
 */
function getFromEmail() {
  return process.env.FROM_EMAIL || process.env.SMTP_FROM || '"AyurSutra Wellness" <no-reply@ayursutra.com>';
}

/**
 * Returns the frontend portal base URL.
 */
function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

/**
 * Generate a responsive, branded Ayurvedic HTML email template for Staff Credentials.
 */
function generateStaffCredentialsHtml({ name, role, toEmail, phone, password }) {
  const frontendUrl = getFrontendUrl();
  const loginUrl = `${frontendUrl}/login`;
  const roleTitle = role
    ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
    : 'Staff';
  const staffPassword = password || 'password@123';
  const loginIdentifier = toEmail || phone || 'Registered Email';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AyurSutra - Staff Account Credentials</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #FDFDFA;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #30352F;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      width: 100%;
      background-color: #FDFDFA;
      padding: 30px 10px;
    }
    .email-container {
      max-width: 580px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(3, 48, 21, 0.08);
      border: 1px solid #E1E4DA;
    }
    .header {
      background: linear-gradient(135deg, #033015 0%, #0c3b17 60%, #1b4332 100%);
      padding: 38px 24px 30px 24px;
      text-align: center;
      color: #FFFFFF;
      border-bottom: 4px solid #C9B884;
    }
    .logo-emblem {
      width: 56px;
      height: 56px;
      margin: 0 auto 12px auto;
      background: rgba(201, 184, 132, 0.15);
      border: 2px solid #C9B884;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header h1 {
      margin: 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.8px;
      color: #FFFFFF;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 11px;
      color: #C9B884;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 600;
    }
    .content {
      padding: 36px 32px;
      background-color: #FFFFFF;
    }
    .greeting {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 20px;
      font-weight: 700;
      color: #033015;
      margin-bottom: 12px;
    }
    .welcome-text {
      font-size: 14px;
      line-height: 1.65;
      color: #4A524A;
      margin-bottom: 24px;
    }
    .role-badge {
      display: inline-block;
      background: #E9EBDD;
      color: #033015;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 3px 10px;
      border-radius: 20px;
      border: 1px solid #C9B884;
      vertical-align: middle;
    }
    .credentials-card {
      background: #F9F8F2;
      border: 1px solid #E1E4DA;
      border-left: 5px solid #C9B884;
      border-radius: 12px;
      padding: 22px;
      margin: 24px 0 28px 0;
    }
    .card-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 15px;
      font-weight: 700;
      color: #033015;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cred-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px dashed #E1E4DA;
      font-size: 13px;
    }
    .cred-row:last-child {
      border-bottom: none;
      padding-bottom: 2px;
    }
    .cred-label {
      color: #667064;
      font-weight: 500;
    }
    .cred-value {
      color: #033015;
      font-weight: 700;
    }
    .password-badge {
      background: #FFFFFF;
      color: #033015;
      font-family: 'Courier New', Courier, monospace;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1.5px solid #C9B884;
      font-size: 15px;
      letter-spacing: 1.5px;
      font-weight: 700;
      box-shadow: 0 2px 6px rgba(3, 48, 21, 0.05);
    }
    .cta-container {
      text-align: center;
      margin: 30px 0 26px 0;
    }
    .cta-button {
      background: #033015;
      color: #FFFFFF !important;
      padding: 15px 36px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      border-radius: 10px;
      display: inline-block;
      box-shadow: 0 4px 14px rgba(3, 48, 21, 0.25);
      letter-spacing: 0.5px;
      border: 1px solid #C9B884;
    }
    .security-note {
      background: #FDFDFA;
      border: 1px solid #E1E4DA;
      border-radius: 10px;
      padding: 14px 18px;
      font-size: 12px;
      line-height: 1.55;
      color: #667064;
      margin-bottom: 22px;
    }
    .security-note strong {
      color: #033015;
    }
    .footer {
      background: #F9F8F2;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #667064;
      border-top: 1px solid #E1E4DA;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div style="font-size: 32px; line-height: 1; margin-bottom: 6px;">🌿</div>
        <h1>AyurSutra</h1>
        <p>Smart Panchakarma & Clinical Wellness</p>
      </div>

      <div class="content">
        <div class="greeting">Namaste, ${name || 'Staff Member'}! 🙏</div>
        <div class="welcome-text">
          Welcome to the AyurSutra Clinical Team. Your staff account has been set up with the role of <span class="role-badge">${roleTitle}</span>. You can now access your clinical dashboard, therapy schedules, and EMR portal.
        </div>

        <div class="credentials-card">
          <div class="card-title">🔐 Your Staff Login Credentials</div>
          <div class="cred-row">
            <span class="cred-label">Assigned Role:</span>
            <span class="cred-value">${roleTitle}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">Login Identifier:</span>
            <span class="cred-value">${loginIdentifier}</span>
          </div>
          ${toEmail ? `
          <div class="cred-row">
            <span class="cred-label">Registered Email:</span>
            <span class="cred-value">${toEmail}</span>
          </div>` : ''}
          ${phone ? `
          <div class="cred-row">
            <span class="cred-label">Mobile Number:</span>
            <span class="cred-value">${phone}</span>
          </div>` : ''}
          <div class="cred-row" style="margin-top: 6px; padding-top: 12px;">
            <span class="cred-label">Temporary Password:</span>
            <span class="password-badge">${staffPassword}</span>
          </div>
        </div>

        <div class="cta-container">
          <a href="${loginUrl}" target="_blank" class="cta-button">
            Access Staff Portal &rarr;
          </a>
        </div>

        <div class="security-note">
          <strong>🔒 Security Recommendation:</strong> Please change your password upon your initial login. Never share these credentials with unauthorized personnel.
        </div>
      </div>

      <div class="footer">
        <p style="font-weight: 600; color: #033015;">AyurSutra Clinical Administration</p>
        <p>Holistic Healing & Traditional Panchakarma Management Platform</p>
        <p style="font-size: 11px; color: #8C968A; margin-top: 10px;">&copy; ${new Date().getFullYear()} AyurSutra. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send automated welcome email with staff credentials.
 * Asynchronous, non-blocking, and safely handles missing emails / SMTP errors.
 *
 * @param {Object} params
 * @param {string} params.toEmail - Recipient email address
 * @param {string} params.name - Full name of the staff member
 * @param {string} params.role - Role ('doctor' | 'therapist')
 * @param {string} params.phone - Contact phone number
 * @param {string} [params.password='password@123'] - Staff password
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, simulated?: boolean }>}
 */
async function sendStaffCredentialsEmail({ toEmail, name, role, phone, password = 'password@123' }) {
  try {
    if (!toEmail || !toEmail.trim()) {
      console.log(`ℹ️ [EmailService] Skipping staff credentials email for "${name || 'Staff'}" (no email provided).`);
      return { success: false, reason: 'NO_EMAIL' };
    }

    const recipient = toEmail.trim();
    const roleTitle = role
      ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
      : 'Staff';
    const staffPassword = password || 'password@123';
    const loginIdentifier = phone || recipient;
    const frontendUrl = getFrontendUrl();

    const subject = `🌿 Welcome to AyurSutra - Your ${roleTitle} Staff Credentials`;
    const htmlContent = generateStaffCredentialsHtml({
      name,
      role,
      toEmail: recipient,
      phone,
      password: staffPassword,
    });

    const textContent = `
Namaste ${name || 'Staff Member'},

Welcome to AyurSutra! Your ${roleTitle} staff account has been created.

Your Login Credentials:
- Role: ${roleTitle}
- Login ID / Phone: ${loginIdentifier}
- Registered Email: ${recipient}
- Default Password: ${staffPassword}
- Portal URL: ${frontendUrl}/login

Please change your password immediately upon your first login.

Warm regards,
AyurSutra Clinical Team
    `.trim();

    const transporter = getTransporter();

    if (transporter) {
      const from = getFromEmail();
      const info = await transporter.sendMail({
        from,
        to: recipient,
        subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`✅ [EmailService] Staff credentials email sent to ${recipient} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } else {
      console.log(`📨 [EmailService - Simulated SMTP] Staff credentials email prepared for: ${recipient}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Role: ${roleTitle} | Name: ${name}`);
      console.log(`   Login: ${loginIdentifier} | Password: ${staffPassword}`);
      console.log(`   Portal: ${frontendUrl}/login`);
      return {
        success: true,
        simulated: true,
        preview: {
          to: recipient,
          name,
          role: roleTitle,
          phone: loginIdentifier,
          password: staffPassword,
        },
      };
    }
  } catch (err) {
    console.error(`❌ [EmailService] Error in sendStaffCredentialsEmail for ${toEmail}:`, err.message || err);
    return { success: false, error: err.message || 'EMAIL_SEND_FAILED' };
  }
}

/**
 * Generate a responsive, Ayurvedic-themed HTML email template for Patient Credentials.
 */
function generatePatientCredentialsHtml({ patientName, email, phone, tempPassword, patientId, clinicName, loginUrl }) {
  const frontendUrl = getFrontendUrl();
  const portalUrl = loginUrl || `${frontendUrl}/login`;
  const clinic = clinicName || 'AyurSutra Holistic Clinic';
  const cleanPassword = tempPassword || 'Ayur@2026';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to AyurSutra - Your Patient Login Credentials</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #FDFDFA;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #30352F;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      width: 100%;
      background-color: #FDFDFA;
      padding: 30px 10px;
    }
    .email-container {
      max-width: 580px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(3, 48, 21, 0.08);
      border: 1px solid #E1E4DA;
    }
    .header {
      background: linear-gradient(135deg, #033015 0%, #0c3b17 60%, #1b4332 100%);
      padding: 38px 24px 30px 24px;
      text-align: center;
      color: #FFFFFF;
      border-bottom: 4px solid #C9B884;
    }
    .header h1 {
      margin: 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.8px;
      color: #FFFFFF;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 11px;
      color: #C9B884;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 600;
    }
    .content {
      padding: 36px 32px;
      background-color: #FFFFFF;
    }
    .greeting {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px;
      font-weight: 700;
      color: #033015;
      margin-bottom: 12px;
    }
    .welcome-text {
      font-size: 14px;
      line-height: 1.65;
      color: #4A524A;
      margin-bottom: 24px;
    }
    .credentials-card {
      background: #F9F8F2;
      border: 1px solid #E1E4DA;
      border-left: 5px solid #C9B884;
      border-radius: 12px;
      padding: 22px;
      margin: 24px 0 28px 0;
    }
    .card-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 15px;
      font-weight: 700;
      color: #033015;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }
    .cred-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px dashed #E1E4DA;
      font-size: 13px;
    }
    .cred-row:last-child {
      border-bottom: none;
      padding-bottom: 2px;
    }
    .cred-label {
      color: #667064;
      font-weight: 500;
    }
    .cred-value {
      color: #033015;
      font-weight: 700;
    }
    .password-badge {
      background: #FFFFFF;
      color: #033015;
      font-family: 'Courier New', Courier, monospace;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1.5px solid #C9B884;
      font-size: 16px;
      letter-spacing: 1.5px;
      font-weight: 700;
      box-shadow: 0 2px 6px rgba(3, 48, 21, 0.05);
    }
    .cta-container {
      text-align: center;
      margin: 30px 0 26px 0;
    }
    .cta-button {
      background: #033015;
      color: #FFFFFF !important;
      padding: 15px 36px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      border-radius: 10px;
      display: inline-block;
      box-shadow: 0 4px 14px rgba(3, 48, 21, 0.25);
      letter-spacing: 0.5px;
      border: 1px solid #C9B884;
    }
    .security-note {
      background: #FDFDFA;
      border: 1px solid #E1E4DA;
      border-radius: 10px;
      padding: 14px 18px;
      font-size: 12px;
      line-height: 1.55;
      color: #667064;
      margin-bottom: 22px;
    }
    .security-note strong {
      color: #033015;
    }
    .quote-box {
      border-top: 1px solid #E1E4DA;
      padding-top: 20px;
      text-align: center;
      font-style: italic;
      color: #667064;
      font-size: 12px;
      line-height: 1.6;
    }
    .footer {
      background: #F9F8F2;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #667064;
      border-top: 1px solid #E1E4DA;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div style="font-size: 32px; line-height: 1; margin-bottom: 6px;">🌿</div>
        <h1>AyurSutra</h1>
        <p>Smart Panchakarma & Patient Portal</p>
      </div>

      <div class="content">
        <div class="greeting">Namaste, ${patientName || 'Valued Patient'}! 🙏</div>
        <div class="welcome-text">
          Welcome to <strong>${clinic}</strong>. Your personalized AyurSutra patient account has been created. You can now log in to view your prescribed Panchakarma therapy schedules, daily diet instructions (Pathya Apathya), and treatment progress.
        </div>

        <div class="credentials-card">
          <div class="card-title">🔐 Your Patient Login Credentials</div>
          <div class="cred-row">
            <span class="cred-label">Patient Name:</span>
            <span class="cred-value">${patientName}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">Login Identifier (Email / Phone):</span>
            <span class="cred-value">${email || phone}</span>
          </div>
          ${phone ? `
          <div class="cred-row">
            <span class="cred-label">Registered Mobile:</span>
            <span class="cred-value">${phone}</span>
          </div>` : ''}
          <div class="cred-row" style="margin-top: 6px; padding-top: 12px;">
            <span class="cred-label">Temporary Password:</span>
            <span class="password-badge">${cleanPassword}</span>
          </div>
        </div>

        <div class="cta-container">
          <a href="${portalUrl}" target="_blank" class="cta-button">
            Access Patient Portal &rarr;
          </a>
        </div>

        <div class="security-note">
          <strong>🌿 Tip for Your Therapy:</strong> Please log in to review your pre-procedure fasting and diet instructions prior to your scheduled therapy sessions.
        </div>

        <div class="quote-box">
          <em>&ldquo;Swasthyasya Swasthya Rakshanam, Aturasya Vikara Prashamanam Cha.&rdquo;</em><br>
          <span style="font-size: 11px; color: #8C968A;">— Charaka Samhita (Preserving health of the healthy and relieving disorders of the diseased)</span>
        </div>
      </div>

      <div class="footer">
        <p style="font-weight: 600; color: #033015;">${clinic}</p>
        <p>Powered by AyurSutra Panchakarma Management Platform</p>
        <p style="font-size: 11px; color: #8C968A; margin-top: 10px;">&copy; ${new Date().getFullYear()} AyurSutra. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}


/**
 * Send patient credentials email asynchronously without blocking registration execution.
 */
async function sendPatientCredentialsEmail({
  patientName,
  email,
  phone,
  tempPassword,
  patientId = null,
  clinicName = null,
}) {
  try {
    if (!email || !email.trim()) {
      console.log(`ℹ️ [EmailService] Skipping credentials email for patient "${patientName}" (no email provided).`);
      return { success: false, reason: 'NO_EMAIL' };
    }

    const recipient = email.trim();
    const subject = '🌿 Welcome to AyurSutra - Your Patient Login Credentials';
    const htmlContent = generatePatientCredentialsHtml({
      patientName,
      email: recipient,
      phone,
      tempPassword,
      patientId,
      clinicName,
    });

    const frontendUrl = getFrontendUrl();
    const textContent = `
Namaste ${patientName},

Welcome to AyurSutra! Your patient account has been created.

Your Login Credentials:
- Login ID / Phone: ${phone || recipient}
- Temporary Password: ${tempPassword}
- Portal URL: ${frontendUrl}/login

Please change your password upon your first login.

Warm regards,
AyurSutra Wellness Team
    `.trim();

    const transporter = getTransporter();

    if (transporter) {
      const from = getFromEmail();
      const info = await transporter.sendMail({
        from,
        to: recipient,
        subject,
        text: textContent,
        html: htmlContent,
      });
      console.log(`✅ [EmailService] Credentials email sent successfully to ${recipient} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } else {
      console.log(`📨 [EmailService - Simulated SMTP] Credentials email prepared for: ${recipient}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Credentials -> User: ${phone || recipient} | Password: ${tempPassword}`);
      console.log(`   Portal URL: ${frontendUrl}/login`);
      return {
        success: true,
        simulated: true,
        preview: {
          to: recipient,
          subject,
          loginId: phone || recipient,
          tempPassword,
        },
      };
    }
  } catch (err) {
    console.error(`❌ [EmailService] Failed to send email to ${email}:`, err.message || err);
    return { success: false, error: err.message || 'EMAIL_SEND_FAILED' };
  }
}

module.exports = {
  sendStaffCredentialsEmail,
  generateStaffCredentialsHtml,
  sendPatientCredentialsEmail,
  generatePatientCredentialsHtml,
  getTransporter,
};
