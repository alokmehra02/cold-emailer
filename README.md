# Cold Emailer 📧

A highly personalized, automated cold email system designed for job seekers and outreach. It integrates Google Sheets for lead management, OpenAI for AI-driven personalization, and Telegram for real-time notifications.

## 🚀 Features

- **AI-Powered Personalization**: Uses OpenAI to generate unique, context-aware emails for each lead.
- **Google Sheets Integration**: Automatically fetches leads and updates their status in real-time.
- **Automated Scheduling**: Cron-based execution to send emails at regular intervals within specific hours.
- **Telegram Notifications**: Get instant updates on your phone when an email is successfully sent.
- **Smart Rate Limiting**: Processes one lead at a time to maintain high deliverability and avoid spam filters.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Lead Management**: Google Sheets API
- **AI Engine**: OpenAI (GPT-4o/mini)
- **Email Delivery**: Nodemailer (via Gmail SMTP)
- **Scheduling**: Node-cron
- **Notifications**: Telegram Bot API

## 📋 Prerequisites

Before you begin, ensure you have the following:

1.  **Google Cloud Project**:
    - Enable the **Google Sheets API**.
    - Create **OAuth 2.0 Credentials** and download the `client_secret.json`.
    - Rename it to match the filename in `index.js` (e.g., `client_secret_...json`).
2.  **OpenAI API Key**: For generating personalized content.
3.  **Gmail App Password**: Required if you have 2FA enabled on your Gmail account.
4.  **Telegram Bot**:
    - Create a bot via [@BotFather](https://t.me/botfather) to get your `TELEGRAM_BOT_TOKEN`.
    - Use [@userinfobot](https://t.me/userinfobot) to get your `TELEGRAM_CHAT_ID`.

## ⚙️ Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/alokmehra02/cold-emailer.git
    cd cold-emailer
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory and add your credentials:
    ```bash
    cp env.example .env
    ```
    Fill in the following fields in `.env`:
    - `OPENAI_API_KEY`: Your OpenAI API key.
    - `GMAIL_USER`: Your Gmail address.
    - `GMAIL_PASS`: Your Gmail App Password.
    - `GOOGLE_SHEET_ID`: The ID of your Google Sheet.
    - `TELEGRAM_BOT_TOKEN`: Your Telegram Bot token.
    - `TELEGRAM_CHAT_ID`: Your Telegram Chat ID.
    - `RESUME_LINK`: Link to your hosted resume.
    - `CALENDER_LINK`: Link to your booking calendar (e.g., Calendly).

## 🚀 Usage

1.  **Prepare your Google Sheet**:
    - Ensure your sheet has columns for: `S.No`, `Name`, `Email`, `Title`, `Company`, `Status`, `Last Sent`, `Thread ID`.
    - Mark new leads with `NEW` in the **Status** column (Column F).

2.  **Run the script**:
    ```bash
    node index.js
    ```

3.  **Authentication**:
    - On the first run, the script will provide a URL to authorize the Google Sheets API.
    - Visit the URL, authorize the app, and paste the code back into the terminal.
    - A `token.json` file will be created for subsequent runs.

## ⏱️ Scheduling

By default, the script is scheduled to:
- Run every **10 minutes**.
- Only execute between **7:00 AM and 9:00 PM**.
- Process **one lead** per execution to stay within safe email limits.

## 📄 License

This project is licensed under the ISC License.
