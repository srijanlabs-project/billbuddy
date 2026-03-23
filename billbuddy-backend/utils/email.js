const nodemailer = require("nodemailer");

let cachedTransporter = null;

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST
    && process.env.SMTP_PORT
    && process.env.SMTP_USER
    && process.env.SMTP_PASSWORD
    && process.env.SMTP_FROM_EMAIL
  );
}

function getTransporter() {
  if (!isEmailConfigured()) {
    throw new Error("Email sending is not configured. Please set SMTP credentials.");
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  return cachedTransporter;
}

async function sendMail(message) {
  const transporter = getTransporter();
  return transporter.sendMail(message);
}

module.exports = {
  isEmailConfigured,
  sendMail
};
