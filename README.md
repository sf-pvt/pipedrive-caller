# List Dialer for Pipedrive

A Chrome extension that turns any Pipedrive list into a calling session. Open a list, press
**Start calling**, and a call console docks to the right side of the page. For each row it
shows the record, dials, and lets you log the outcome and a note with one click.

Built by [Serviceform](https://www.serviceform.com) for its own sales team and shared as open
source under the MIT license, so any Pipedrive user can install it or fork it. Works with the
Leads Inbox, deal lists and people lists. Not affiliated with Pipedrive.
Privacy policy: [PRIVACY.md](PRIVACY.md).

**New here? Read [INSTALL.md](INSTALL.md), the step-by-step guide.**

## What it does

- **Reads the list on screen.** The rows loaded on the page, in the order shown. Phone numbers
  come from the list, or from Pipedrive when the list has no phone column.
- **Shows the record before the call.** Company, contact and title, stage, the number (with a
  picker when there are several people or numbers), email, owner, value, address, and a
  screenshot of the company website.
- **Shows the full history.** Every note and every activity on the record, newest first, in a
  side column that can be collapsed.
- **Dials, two ways.** Every record has **Call with Ringover** and **Call with iPhone**.
  Ringover uses Ringover's callback API: your Ringover app or phone rings first, then it dials
  the prospect on your Ringover number. iPhone opens a `tel:` link, which a Mac with "Calls from
  iPhone" places through your phone. Auto mode dials with the button chosen in the settings
  after a countdown; Manual mode waits for you.
- **Logs the outcome.** Answered, No answer, Busy, Gatekeeper, Not interested, plus your note.
  Then it moves to the next row.
- **Books meetings.** Date, time, length and who holds it. On a lead it converts the lead to a
  deal first.
- **Pauses.** The Pause button or the Esc key stops everything at once.

## What it writes to Pipedrive

Everything is written with your own API token, so it is owned by you.

| You press | Pipedrive gets |
|---|---|
| An outcome | One done activity of the matching call type (`call___discussion`, `call___no_answer`, `call___busy`, `call___gatekeeper`), your note in its note field, linked to the lead or deal, the person and the organisation. On leads the label is set too (Contacted - Discussion, No answer, Gatekeeper, Not interested). |
| Meeting booked on a lead | The lead is converted to a deal, into the pipeline stage chosen in the settings (default: the first stage named like "meeting booked"). Then as below. |
| Meeting booked on a deal | A done `first_meeting_booked` activity dated today (this is what the Monday sales report and the SDR commissions count), a `meeting` activity at the chosen time for the calendar, and the deal moved to the First meeting booked stage. |

The label update can be switched off in the settings.

## Settings

Click the extension icon to open them.

| Setting | Meaning |
|---|---|
| Your Pipedrive API token | From Pipedrive > your picture > Personal preferences > API. The page shows whose token it is. Admin tokens may log on behalf of someone else. |
| Dial mode | Auto (dial after the countdown) or Manual (you press Call). Also switchable in the panel. |
| Seconds before dialing | Countdown length in Auto mode. |
| Auto-dial uses | Ringover or iPhone. |
| Ringover API key | Team key from dashboard.ringover.com > Developer > API, with Calls Write and Users Read, Monitoring on. Optional: without it the Ringover button opens a `callto:` link for the desktop app. |
| Your Ringover number | Which of the team's numbers the call is placed from. |
| Country code for local numbers | Ringover needs full international numbers; local ones get this code. |
| iPhone button opens | `tel:`, `facetime-audio:` or `callto:`. |
| Where a booked meeting's deal goes | The pipeline stage for converted leads. |
| Screenshot key | Optional [thum.io](https://www.thum.io) key for faster screenshots. Without it the free tier is used. |
| Test mode | A number that is dialed instead of the real one. The panel turns red. Outcomes still go to the real record. |

## Keyboard

| Key | Does |
|---|---|
| 1 to 5 | Log the outcome |
| 6 | Meeting booked |
| Enter | Dial (or dial again) |
| Right arrow | Next row without logging |
| Esc | Pause |

Keys are ignored while you type in the note box.

## Using it in another Pipedrive account

It works with any Pipedrive account. Three things are account-specific:
- **Call outcome activity types.** It looks for activity types with the keys `call___discussion`,
  `call___no_answer`, `call___busy` and `call___gatekeeper`. If a key does not exist it falls
  back to the standard `call` type.
- **Lead labels.** It sets labels named "Contacted - Discussion", "Contacted - No answer",
  "Contacted - Gatekeeper" and "Contacted - Not interested" when they exist. Missing labels are
  skipped. The whole label update can be switched off.
- **Booking.** The `first_meeting_booked` activity type is used when it exists, and the target
  stage for converted leads is chosen in the settings.

## Limits

- Only the rows loaded on the page are called. Scroll down first to load more.
- Rows without a phone number are skipped.
- Pipedrive cannot tell the extension when a call ends. The state says "Dialed" and the outcome
  buttons are there the whole time; press one when you are done.
- Calls through the iPhone use your own mobile number and plan.
- Some websites block screenshot bots. Those show "no screenshot".

## Files

| File | What |
|---|---|
| `manifest.json` | Extension manifest (Manifest V3) |
| `content.js`, `content.css` | The console on the Pipedrive page |
| `background.js` | Talks to the Pipedrive API and fetches screenshots |
| `options.html`, `options.js` | The settings page |
| `INSTALL.md` | Plain install guide for the team |
| `pipedrive-dialer.zip` | The build to upload to the Chrome Web Store |
| `store-listing.md` | Text and privacy answers for the Web Store listing |
| `PRIVACY.md`, `LICENSE` | Privacy policy and the MIT license |

## Developing

1. Load the folder with `chrome://extensions` > Developer mode > Load unpacked.
2. Change files, then press the reload arrow on the extension and refresh the Pipedrive tab.
3. Rebuild the zip before committing:

```
zip -qr pipedrive-dialer.zip . -x "store-listing.md" "store-screenshot*" ".DS_Store" ".git/*" ".gitignore" "pipedrive-dialer.zip"
```

Bump `version` in `manifest.json` for every Web Store upload.

## Credits

- Made by [Serviceform](https://www.serviceform.com), Helsinki. Serviceform builds AI chat, forms
  and lead tools for websites; this dialer started as an internal tool for its sales team.
- Website screenshots are provided by [thum.io](https://www.thum.io). Their free tier works
  without a key; a paid key removes its limits. Use of thum.io is subject to
  [their terms](https://www.thum.io/terms).
- [Pipedrive](https://www.pipedrive.com) is a trademark of Pipedrive OÜ. This project is an
  independent tool that uses the public Pipedrive API and is not affiliated with, endorsed by,
  or sponsored by Pipedrive.
