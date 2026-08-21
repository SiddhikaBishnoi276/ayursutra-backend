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
  const loginIdentifier = phone || toEmail || 'Registered Mobile';

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
    .role-badge {
      display: inline-block;
      background: #e8f5e9;
      color: #1b4332;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #c8e6c9;
      vertical-align: middle;
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
      font-size: 15px;
      letter-spacing: 1px;
      font-weight: 700;
    }
    .cta-container {
      text-align: center;
      margin: 30px 0 25px 0;
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
    <div class="header">
      <h1>🌿 AyurSutra</h1>
      <p>Panchakarma & Clinical Management Portal</p>
    </div>

    <div class="content">
      <div class="greeting">Namaste, ${name || 'Staff Member'}! 🙏</div>
      <div class="welcome-text">
        Welcome to the AyurSutra Clinical Team. Your staff account has been set up with the role of <span class="role-badge">${roleTitle}</span>. You can now log in to the AyurSutra staff portal to access clinical workflows, schedules, and patient management.
      </div>

      <div class="credentials-card">
        <div class="card-title">🔐 Your Staff Login Credentials</div>
        <div class="cred-row">
          <span class="cred-label">Designated Role:</span>
          <span class="cred-value">${roleTitle}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Login Identifier (Phone / Email):</span>
          <span class="cred-value">${loginIdentifier}</span>
        </div>
        ${toEmail ? `
        <div class="cred-row">
          <span class="cred-label">Registered Email:</span>
          <span class="cred-value">${toEmail}</span>
        </div>` : ''}
        <div class="cred-row">
          <span class="cred-label">Default Password:</span>
          <span class="cred-value password-badge">${staffPassword}</span>
        </div>
      </div>

      <div class="cta-container">
        <a href="${loginUrl}" class="cta-button" target="_blank">Sign In to Staff Portal</a>
      </div>

      <div class="security-note">
        <strong>🔒 Security Notice:</strong> This is a default temporary password. For healthcare privacy and compliance, please change your password immediately upon your first sign-in in your account settings.
      </div>

      <div class="quote-box">
        &ldquo;Shariram Adhyam Khalu Dharma Sadhanam&rdquo;<br>
        <span style="font-size: 11px;">(The body is the primary vehicle for fulfilling all life's purposes - Kalidasa)</span>
      </div>
    </div>

    <div class="footer">
      <p>This is an automated administrative notification from AyurSutra Healthcare. Please do not reply directly to this email.</p>
      <p>&copy; ${new Date().getFullYear()} AyurSutra Healthcare Technologies. All rights reserved.</p>
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

  return `<!DOCTYPE html>
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
    <div class="header">
      <h1>🌿 AyurSutra</h1>
      <p>Panchakarma & Holistic Care Portal</p>
    </div>

    <div class="content">
      <div class="greeting">Namaste, ${patientName || 'Valued Patient'}! 🙏</div>
      <div class="welcome-text">
        Welcome to <strong>${clinic}</strong>. Your personalized Ayurvedic healing and Panchakarma treatment profile has been successfully set up. You can now log in to the AyurSutra patient portal to view your treatment schedule, daily diet regimens (<em>Pathya</em>), and clinical progress.
      </div>

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

      <div class="cta-container">
        <a href="${portalUrl}" class="cta-button" target="_blank">Sign In to Patient Portal</a>
      </div>

      <div class="security-note">
        <strong>🔒 Security Advisory:</strong> For your privacy and data protection, please change your temporary password immediately upon your first sign-in under <em>Profile &rarr; Security Settings</em>.
      </div>

      <div class="quote-box">
        &ldquo;Swasthyasya Swasthya Rakshanam, Aturasya Vikara Prashamanam Cha&rdquo;<br>
        <span style="font-size: 11px;">(Preserve the health of the healthy, and relieve the disorders of the ailing - Charaka Samhita)</span>
      </div>
    </div>

    <div class="footer">
      <p>This is an automated notification from ${clinic}. Please do not reply directly to this email.</p>
      <p>&copy; ${new Date().getFullYear()} AyurSutra Healthcare Technologies. All rights reserved.</p>
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
