require("dotenv").config();
const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
const axios = require("axios");

// ---------------- GOOGLE SHEETS (OAUTH) ----------------

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const TOKEN_PATH = "token.json";

async function authorize() {
  const content = fs.readFileSync("client_secret_416199702620-dun720o4ln807reu72t4836bsk4t9f7k.apps.googleusercontent.com.json");
  const credentials = JSON.parse(content);

  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  }

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("🔐 Authorize:", authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter code: ", async (code) => {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
      rl.close();
      resolve(oAuth2Client);
    });
  });
}

let sheets;

async function initSheets() {
  const auth = await authorize();
  sheets = google.sheets({ version: "v4", auth });
}

async function getRows() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Sheet1!A2:H",
  });
  return res.data.values || [];
}

async function updateRow(rowIndex, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Sheet1!F${rowIndex}:H${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

// ---------------- EMAIL ----------------

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function sendEmail(to, subject, text, threadId = null) {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to,
    subject,
    text,
    headers: threadId
      ? {
        "In-Reply-To": threadId,
        References: threadId,
      }
      : {},
  };

  const info = await transporter.sendMail(mailOptions);
  return info.messageId;
}

// ---------------- EMAIL TEMPLATE ----------------

function generateEmail({ name, company }) {
  const fullBody =
    `Hi ${name},\r\n` +
    `\r\n` +
    `I'm Aalok, a backend engineer with close to 2 years of experience at Tudip Technologies and a graduate of National Institute of Technology Bhopal. Over the past couple of years, I've built and shipped backend systems across multiple domains — from real-time IoT platforms to event-driven cloud infrastructure — working closely with product and engineering teams to deliver things that actually work at scale.\r\n` +
    `\r\n` +
    `I'm exploring new roles where I can contribute immediately — whether in backend engineering, infrastructure, product, or any role that values ownership and strong execution. Based on what ${company} is building, I'd love to see if there might be a potential fit.\r\n` +
    `\r\n` +
    `Here are my details:\r\n` +
    `Resume: ${process.env.RESUME_LINK}\r\n` +
    `Calendar: ${process.env.CALENDAR_LINK}\r\n` +
    `\r\n` +
    `Best,\r\n` +
    `Aalok`;

  return {
    subject: "Exploring Opportunities on Your Team",
    body: fullBody,
  };
}

// ---------------- TELEGRAM ----------------

async function notify(msg) {
  await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: msg,
    }
  );
}

// ---------------- CORE LOGIC ----------------

async function processLeads() {
  const rows = await getRows();

  const row = rows.find(r => r[5] === "NEW");

  if (!row) {
    console.log("No new leads");
    return;
  }

  const [sno, name, email, title, company, status, lastSent, threadId] = row;
  const rowIndex = rows.indexOf(row) + 2;

  try {
    const emailData = generateEmail({ name, company }); // no await — not async anymore

    const msgId = await sendEmail(
      email,
      emailData.subject,
      emailData.body,
      threadId || null
    );

    await updateRow(rowIndex, [
      "SENT",
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      msgId,
    ]);

    await notify(`📤 Sent to ${name} (${company})`);

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

// ---------------- START ----------------

async function start() {
  await initSheets();

  await processLeads();

  // ⏱ every 15 minutes → 1 email
  cron.schedule("*/10 7-21 * * *", async () => {
    console.log("⏱ Sending next email...");
    await processLeads();
  });
}

start();