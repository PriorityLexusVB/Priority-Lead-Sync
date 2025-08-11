require("dotenv").config();

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = "Leads"; // This must match your sheet tab name exactly (case-sensitive)

async function appendLeadToSheet(lead) {
  let client;
  try {
    client = await auth.getClient();
  } catch (err) {
    console.error("Failed to authenticate Google client:", err);
    throw err;
  }

  const sheets = google.sheets({ version: "v4", auth: client });

  const resource = {
    values: [[
      lead.firstName,
      lead.lastName,
      lead.email,
      lead.phone,
      lead.source,
      lead.notes,
      new Date().toLocaleString()
    ]]
  };

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:G`,
      valueInputOption: "USER_ENTERED",
      resource,
    });
  } catch (err) {
    console.error("Failed to append values to Google Sheet:", err);
    throw err;
  }
}

module.exports = {
  appendLeadToSheet,
};
