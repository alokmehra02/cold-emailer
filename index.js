require("dotenv").config();
const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
const axios = require("axios");
const dayjs = require("dayjs");
const OpenAI = require("openai");

console.log("USER:", process.env.GMAIL_USER);
console.log("PASS:", process.env.GMAIL_PASS);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------- GOOGLE SHEETS (OAUTH) ----------------

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const TOKEN_PATH = "token.json";

async function authorize() {
  const content = fs.readFileSync("client_secret_416199702620-dun720o4ln807reu72t4836bsk4t9f7k.apps.googleusercontent.com.json");
  const credentials = JSON.parse(content);

  const { client_secret, client_id, redirect_uris } =
    credentials.installed;

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

// ---------------- OPENAI (SMART PERSONALIZATION) ----------------

async function generateEmail({ name, title, company }) {
  const prompt = `
You are helping a backend engineer send a cold email for job opportunities.

Candidate background:
- Backend Engineer (Node.js, Microservices, Distributed Systems)
- Experience with AWS, GCP, Kubernetes
- Strong in scalable systems and APIs
- Looking for SDE / Backend roles in startups or product companies

Write a highly personalized cold email.

Target:
Name: ${name}
Title: ${title}
Company: ${company}

Rules:
- Max 120 words
- Mention how candidate can add value to THEIR company
- Make it sound human (not AI)
- No buzzwords, no fluff
- Soft ask at end

Include:
- Personalized intro
- Why relevant to them
- Value proposition
- Resume link

Resume link:
${process.env.RESUME_LINK}

Output JSON:
{
  "subject": "...",
  "body": "..."
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return JSON.parse(response.choices[0].message.content);
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

  // 👉 Only pick ONE lead (rate limiting)
  const row = rows.find(r => r[5] === "NEW");

  if (!row) {
    console.log("No new leads");
    return;
  }

  const [sno, name, email, title, company, status, lastSent, threadId] =
    row;

  const rowIndex = rows.indexOf(row) + 2;

  try {
    const emailData = await generateEmail({ name, title, company });

    const msgId = await sendEmail(
      email,
      emailData.subject,
      emailData.body
    );

    await updateRow(rowIndex, [
      "SENT",
      new Date().toISOString(),
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

  // run once immediately
  await processLeads();

  // ⏱ every 15 minutes → 1 email
cron.schedule("*/10 7-21 * * *", async () => {
    console.log("⏱ Sending next email...");
    await processLeads();
  });
}

start();