# Chrome Web Store listing (copy into the developer console)

Name: List Dialer for Pipedrive
Summary (132 chars max): Call through any Pipedrive list: see the record, dial, log the outcome, book meetings.
Category: Productivity / Workflow & Planning
Language: English
Visibility: Unlisted (only people with the link can install)

## Description
List Dialer for Pipedrive is an independent, open-source tool made by Serviceform
(https://www.serviceform.com). It is not affiliated with, endorsed by, or sponsored by Pipedrive.
Website screenshots are provided by thum.io (https://www.thum.io). Source code:
https://github.com/sf-pvt/pipedrive-caller

A bar on top of any Pipedrive list view (Leads Inbox, Deals, People).
Press Start calling. For each row it shows the record with its website, dials the number
(through FaceTime on a Mac, or a softphone), and lets you log the outcome and a note in one
click. Meeting booked converts the lead to a deal and logs the booking. Pause at any time.

Made for Serviceform's sales team. It uses your own Pipedrive API token, entered in the
extension settings, and writes activities under your name.

## Privacy practices (the console asks for these)
Single purpose: help a sales rep call through a list of Pipedrive contacts and log the calls.
Permission justifications:
- storage: keeps the user's own Pipedrive API token and settings on their device.
- host permission *.pipedrive.com: shows the call bar on Pipedrive list pages.
- host permission api.pipedrive.com: reads the record and writes the call activity with the user's token.
- host permission image.thum.io: fetches a screenshot of the prospect's website.
Data use: the extension sends the prospect's website domain to thum.io for a screenshot, and
sends the user's own API requests to Pipedrive. No data is sent anywhere else or sold.
Remote code: none.

## Privacy policy URL
https://github.com/sf-pvt/pipedrive-caller/blob/main/PRIVACY.md

## Assets
- Icon: icons/icon128.png
- Screenshot: store-screenshot-1280x800.png
