const nodemailer = require('nodemailer');
const { generatePatientCredentialsHtml } = require('../src/Common/Services/emailService');
require('dotenv').config();

async function sendLiveTestEmail(recipientEmail = 'user.test@ayursutra.com') {
  console.log(`\n🌿 Preparing Live Test Email for: ${recipientEmail} ...\n`);

  let transporter;
  const isRealSmtp = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (isRealSmtp) {
    console.log(`⚙️ Using Configured SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    console.log('⚡ No SMTP credentials found in .env — generating temporary live Ethereal test inbox...');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`📧 Test SMTP Account Created: ${testAccount.user}`);
  }

  const mockPatient = {
    patientName: 'Riddhima Sharma',
    email: recipientEmail,
    phone: '+91-9876543210',
    tempPassword: 'AYUR_' + Math.random().toString(36).slice(-6).toUpperCase(),
    patientId: 'PAT-AYUR-2026-892',
    clinicName: 'AyurSutra Wellness & Panchakarma Clinic',
    loginUrl: 'http://localhost:5173/login',
  };

  const html = generatePatientCredentialsHtml(mockPatient);

  const mailOptions = {
    from: process.env.SMTP_FROM || '"AyurSutra Wellness" <wellness@ayursutra.com>',
    to: recipientEmail,
    subject: '🌿 Welcome to AyurSutra - Your Patient Login Credentials',
    text: `Namaste ${mockPatient.patientName},\n\nYour AyurSutra patient account is ready.\nLogin ID: ${mockPatient.phone}\nPassword: ${mockPatient.tempPassword}\n\nAccess portal at: ${mockPatient.loginUrl}`,
    html: html,
  };

  console.log('🚀 Sending email...');
  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ Email Dispatched! Message ID: ${info.messageId}`);

  if (!isRealSmtp) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('\n===============================================================');
    console.log('🔗 LIVE WEB PREVIEW URL (Click to view the rendered email):');
    console.log(previewUrl);
    console.log('===============================================================\n');
    return { success: true, previewUrl, messageId: info.messageId };
  }

  return { success: true, messageId: info.messageId };
}

const targetEmail = process.argv[2] || 'test.patient@ayursutra.com';
sendLiveTestEmail(targetEmail)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Failed to send test email:', err);
    process.exit(1);
  });
