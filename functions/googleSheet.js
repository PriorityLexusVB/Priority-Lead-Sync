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
  const client = await auth.getClient();
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

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:G`,
    valueInputOption: "USER_ENTERED",
    resource,
  });
}

module.exports = {
  appendLeadToSheet,
};
