# Google Sheets setup (Stage C)

You need a **service account** so the script (and n8n) can write to a sheet
without a human login. ~10 minutes, one-time.

## 1. Create a Google Cloud project
1. Go to https://console.cloud.google.com
2. Top bar → project dropdown → **New Project** → name it `catalog-auditor` → Create.

## 2. Enable the APIs
In the project, open **APIs & Services → Library** and enable both:
- **Google Sheets API**
- **Google Drive API**

## 3. Create a service account + key
1. **APIs & Services → Credentials → Create Credentials → Service account**.
2. Name it (e.g. `auditor-bot`) → Create and Continue → Done.
3. Click the new service account → **Keys** tab → **Add Key → Create new key → JSON**.
4. A `.json` file downloads. **Move it into this project folder and rename it to
   `google_creds.json`.** (It's already git-ignored — never commit it.)

## 4. Create the destination Sheet and share it
1. Create a blank sheet at https://sheets.google.com
2. Copy the **Sheet ID** from the URL:
   `docs.google.com/spreadsheets/d/`**`THIS_LONG_ID`**`/edit`
3. Open `google_creds.json`, copy the `client_email` value
   (looks like `auditor-bot@catalog-auditor.iam.gserviceaccount.com`).
4. In the Sheet, click **Share**, paste that email, give it **Editor** access, Send.
   > This step is the one people forget. Without it you'll get a 403.

## 5. Tell the script
In your `.env`:
```
GOOGLE_SHEET_ID=THE_LONG_ID_FROM_STEP_4
GOOGLE_CREDS_PATH=./google_creds.json
```

## 6. Run it for real
```bash
node scripts/audit.js --mock --sheets        # mock rewrites, real sheet write
```
The sheet's first tab (`Sheet1`) fills with: `product_id, title, total_score,
flag, new_title, new_description, seo_keywords`.

If the tab isn't named `Sheet1`, pass it or rename the tab.

## Troubleshooting
- **403 PERMISSION_DENIED** → you didn't share the sheet with the service-account email (step 4.4).
- **404** → wrong `GOOGLE_SHEET_ID`.
- **`Unable to parse range: Sheet1!A1`** → your tab has a different name; rename it to `Sheet1`.
- **DRY-RUN still showing** → `GOOGLE_SHEET_ID` missing in `.env`, or `google_creds.json` not found.

---

## In n8n (the no-code path)
Instead of the script, use the native **Google Sheets** node:
- Credential type: **Service Account** → paste the JSON contents.
- Operation: **Append or Update Row(s)**, Document = your Sheet ID, Sheet = `Sheet1`.
- Map the 7 columns from the incoming items.
