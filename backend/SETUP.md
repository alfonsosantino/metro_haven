# Metro Haven booking backend — one-time setup (about 10 minutes, free)

The website is static (GitHub Pages), so bookings are stored in a **Google Sheet**
and handled by a small **Google Apps Script** that runs free on your Google account.
Guest details stay private in your Sheet. Only booked/blocked *dates* are public.

## 1. Create the Sheet + script
1. Go to https://sheets.new and name the sheet **Metro Haven Bookings**.
2. Menu **Extensions → Apps Script**.
3. Delete everything in `Code.gs`, then paste the full contents of `backend/Code.gs` from this repo. Click **Save**.
4. In the function dropdown at the top choose **setup** and click **Run**.
   Google will ask you to authorize the script (it's your own script, accessing your own Sheet) → allow it.
   A tab named **Bookings** with column headers appears in your Sheet.

## 2. Set your admin password
1. In Apps Script, click the gear **Project Settings** → scroll to **Script properties** → **Add script property**.
2. Property `ADMIN_KEY` → value: a long password only you know (this is what you type on /admin).
3. (Optional) Property `OWNER_EMAIL` → your email, to get an email for every new booking inquiry.
4. Save.

## 3. Deploy as a web app
1. Click **Deploy → New deployment** → gear icon → **Web app**.
2. Execute as: **Me**. Who has access: **Anyone**.
3. Click **Deploy** and copy the **Web app URL** (ends with `/exec`).

## 4. Connect the website
1. Open `js/config.js` and paste the URL between the quotes:
   `API_URL: "https://script.google.com/macros/s/XXXX/exec"`
2. Push to GitHub. Done — the calendar shows **Live availability** and the **Book Now** button sends requests to your dashboard.

## Updating the script later
If `Code.gs` changes: paste the new code, then **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**.
The URL stays the same.

## How it works
- **Book Now** (calendar page) → adds a row with status `pending`.
- **/admin** → Accept (`confirmed`, dates get blocked on the public calendar), Decline, Cancel, Mark paid,
  block dates (for Airbnb bookings, maintenance, etc.), add manual bookings, export CSV.
- Statuses that block the calendar: `confirmed` and `blocked`.
- You can also view/edit rows directly in the Google Sheet.
