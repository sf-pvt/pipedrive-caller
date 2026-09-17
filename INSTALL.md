# How to install the dialer (step by step)

Takes about 5 minutes. You need Google Chrome on a Mac, and either a Ringover account or an
iPhone.

**The short version:** download the zip, unzip it, add the folder to Chrome as an unpacked
extension, paste your own Pipedrive API token in its settings, choose Ringover or your iPhone
as the calling app, open a Pipedrive list, press Start calling. The details are below.

## 1. Download the extension

1. Open this link: https://github.com/sf-pvt/pipedrive-caller/raw/main/pipedrive-dialer.zip
2. The file `pipedrive-dialer.zip` lands in your Downloads folder.
3. Double-click it. A folder called `pipedrive-dialer` appears next to it.
4. Move that folder somewhere it can stay, for example your Documents folder. Chrome needs it
   to stay there. Do not delete it later.

## 2. Add it to Chrome

1. Copy this address, paste it into Chrome's address bar and press Enter: `chrome://extensions`
2. Top right of that page: switch on **Developer mode**.
3. Top left: click **Load unpacked**.
4. Pick the `pipedrive-dialer` folder from step 1 and click **Select**.
5. You now see "Pipedrive list dialer" in the list. Leave it switched on.
6. Click the puzzle-piece icon next to Chrome's address bar and pin "Pipedrive list dialer",
   so its icon is always visible.

## 3. Connect it to your Pipedrive

1. Open Pipedrive > your picture (top right) > Personal preferences > API.
   The address is `https://<your company>.pipedrive.com/settings/api`.
2. Copy the long code under **Your personal API token**. If there is none, click Generate.
3. Click the dialer icon next to Chrome's address bar. The settings page opens.
4. Paste the code into **Your Pipedrive API token** and click **Save**.
5. The page must say "This token belongs to <your name>". If it says the token failed, copy it
   again, there is often a space at the end.

Nobody else needs this code. Do not send it to anyone.

## 4. Choose how calls are placed (one time)

The extension does not make the call itself. It hands the number to a calling app on your Mac.
Pick one of these two.

### Option A: Ringover (recommended if you have a Ringover number)

1. Install the Ringover desktop app: open https://dashboard.ringover.com/apps and click
   **Mac store** (or search "Ringover" in the Mac App Store).
2. Open the app and log in with your Ringover account. Leave it running.
3. Click the dialer icon in Chrome > settings > **How to dial** > choose
   **callto: (Ringover desktop app or other softphone)** > Save.
4. Test: open a list, press Start calling. The Ringover app rings out on your Ringover number.

Calls go out on your Ringover number and cost nothing extra on your mobile plan.

### Option B: your iPhone through FaceTime

Only works with an iPhone and a Mac on the same Apple ID. Calls use your own mobile plan.

On the iPhone:
1. Settings > Apps > Phone (older phones: Settings > Phone).
2. Calls on Other Devices > switch on **Allow Calls on Other Devices**.
3. In the list, switch on your Mac.

On the Mac:
1. Open FaceTime.
2. FaceTime menu > Settings > General.
3. Tick **Calls from iPhone**.

If **Calls on Other Devices** is missing on the iPhone, or the Mac is not in its list, check
these in order:
- iPhone: Settings > FaceTime is switched on and signed in with your Apple ID.
- iPhone: Settings > General > AirPlay & Continuity (older: Handoff) > **Handoff** is on.
- Mac: System Settings > General > AirDrop & Handoff > **Allow Handoff** is on.
- Both devices: same Apple ID in iCloud, Wi-Fi and Bluetooth on, same Wi-Fi network.
- Quit and reopen FaceTime on the Mac, then look at the iPhone list again.
- Still missing: your SIM or carrier does not allow it (common with some business and prepaid
  lines). Use Option A instead.

## 5. Make your first calls

1. Open a list in Pipedrive, for example Leads > Leads Inbox. Pick a filter so the list shows
   the people you want to call.
2. The dialer appears on the right side of the page.
3. Press **Start calling**.
4. The first record shows up. After the countdown the call starts in Ringover, or on your
   iPhone. The first time, Chrome asks "Open Ringover?" or "Open FaceTime?": tick "Always
   allow" and click Open.
5. When the call is over, write a short note and press the outcome:
   Answered, No answer, Busy, Gatekeeper, Not interested, or Meeting booked.
6. It moves to the next record by itself.

Useful buttons:
- **Pause** stops everything. So does the Esc key.
- **Auto / Manual**: Auto dials after the countdown, Manual waits until you press Call.
- **Next** skips a record without logging anything.
- The number next to the phone (for example "3 numbers") shows other people at the company.
- **History** on the right shows everything logged before on this record.

## When there is a new version

1. Download the zip again from the same link and unzip it.
2. Delete the old `pipedrive-dialer` folder and put the new one in the same place.
3. Open `chrome://extensions` and press the round reload arrow on the extension.
4. Refresh the Pipedrive tab. Your token and settings stay.

## Something is wrong?

- No dialer on the page: refresh the page. Make sure you are on a list view (rows), not a
  single record.
- "Start calling" opens the settings instead: your token is missing or wrong, see step 3.
- Calls do not start: check step 4. Make sure the Ringover app is open and logged in, or
  test FaceTime by dialing any number by hand on the Mac.
- Stuck? Open an issue on GitHub: https://github.com/sf-pvt/pipedrive-caller/issues
