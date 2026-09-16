# How to install the dialer (step by step)

Takes about 5 minutes. You need Google Chrome on a Mac, and an iPhone if you want to call
through your phone.

**The short version:** download the zip, unzip it, add the folder to Chrome as an unpacked
extension, paste your own Pipedrive API token in its settings, open a Pipedrive list, press
Start calling. The details are below.

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
   At Serviceform that is this link: https://serviceform.pipedrive.com/settings/api
2. Copy the long code under **Your personal API token**. If there is none, click Generate.
3. Click the dialer icon next to Chrome's address bar. The settings page opens.
4. Paste the code into **Your Pipedrive API token** and click **Save**.
5. The page must say "This token belongs to <your name>". If it says the token failed, copy it
   again, there is often a space at the end.

Nobody else needs this code. Do not send it to anyone.

## 4. Let your Mac call through your iPhone (one time)

On the iPhone:
1. Settings > Apps > Phone (older phones: Settings > Phone).
2. Calls on Other Devices > switch on **Allow Calls on Other Devices**.
3. In the list, switch on your Mac.

On the Mac:
1. Open FaceTime.
2. FaceTime menu > Settings > General.
3. Tick **Calls from iPhone**.

Both devices must use the same Apple ID and be on the same Wi-Fi.

## 5. Make your first calls

1. Open a list in Pipedrive, for example the Leads Inbox (at Serviceform:
   https://serviceform.pipedrive.com/leads/inbox). Pick a filter so the list shows the people
   you want to call.
2. The dialer appears on the right side of the page.
3. Press **Start calling**.
4. The first record shows up. After the countdown the call starts. Your iPhone rings out,
   or your Mac shows "Open FaceTime?" the first time: tick "Always allow" and click Open.
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
- Calls do not start: check step 4. Test by opening FaceTime on the Mac and dialing any
  number by hand.
- Ask Jarkko if you are stuck (Serviceform team). Others: open an issue on GitHub.
