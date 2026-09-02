# Golden Gym Manager

Build a modern, premium, and fully responsive Gym Management Application with a luxurious Black & Gold UI theme (Primary: Metallic Gold #D4AF37, Secondary: Black, Dark Gray, and White). The interface should be clean, spacious, elegant, fast, and feel like a commercial SaaS product. Prioritize UI/UX quality over speed and avoid basic CRUD-style layouts.

This application supports only ONE user role:

• Admin (Gym Owner)

The Admin should have secure authentication and complete access to every feature.

## Dashboard

Design a clean and informative dashboard with the following KPI cards:

• Active Members

• Collected Revenue

• Pending Due

• Expired Members

Each dashboard card should be clickable and automatically open the corresponding filtered page.

Below the KPI cards display:

- Revenue Chart (Daily, Weekly, Monthly, Yearly filters)

- Sales Statistics

- Membership Statistics

- Recent Activities

Recent Activities should include:

- New Member Registered

- Membership Renewed

- Membership Expired

- Payment Received

- Product Sold

- Product Added

- Invoice Generated

## Member Management

- Add Member

- Edit Member

- Move Member to Trash

- Restore Member

- Member Profile

- Membership Status

- Membership History

- Progress Notes

- Body Measurements

- Contact Information

## Membership Management

- Create Membership Plans

- Renew Membership

- Freeze Membership

- Expired Membership

- Membership Renewal Reminder

- Membership History

## Payment Management

- Manual Payment Entry

- Payment History

- Pending Payments

- Collected Revenue

- Generate & Print Invoice

## Product & Inventory Management

Manage gym products including:

- Whey Protein

- Mass Gainer

- Creatine

- Pre-Workout

- BCAA

- Gym T-Shirts

- Shakers

- Water Bottles

- Gloves

- Belts

- Lifting Straps

- Other Gym Accessories

Features:

- Product Categories

- Product Inventory

- Stock Management

- Low Stock Alerts

- Product Sales

- Sales Reports

- Profit Tracking

## Reports

- Revenue Report

- Payment Report

- Membership Report

- Product Sales Report

- Inventory Report

## Notification System

Display a Notification Bell in the top-right corner.

The notification panel should include:

💰 Payment Due

• Priya Sharma — Payment overdue (5 days)

• Rahul Das — Pending payment

⚠ Membership Expiry

• Mihir Joshi — Membership expires tomorrow

• Aman Singh — Membership expired today

🎂 Birthdays

• Sagar Chhetri — Birthday Today

• Riya Sharma — Birthday Tomorrow

📦 Inventory Alerts

• Whey Protein stock is low

• T-Shirts need restocking

• Shakers almost out of stock

📢 System Activities

• New member added

• Membership renewed

• Invoice generated

• Product sold

Each notification should display:

- Icon

- Name

- Short Description

- Date & Time

- Status Color

Include:

- View All Notifications

- Mark All as Read

- Unread Notification Counter

## Safe Delete System

Never permanently delete a member directly.

When Delete is clicked, show a confirmation dialog:

"Do you want to move this member to Trash?"

Options:

- Move to Trash

- Cancel

## Trash

Create a dedicated Trash page.

Display:

- Member Name

- Membership Plan

- Deleted Date

- Deleted By

Actions:

- Restore

- Permanently Delete

Automatically remove trashed records after 30 days.

For permanent deletion, require the Admin to type:

DELETE

before enabling the "Delete Permanently" button.

Display the warning:

"This action is permanent and cannot be undone."

## Additional Features

- Global Search

- Advanced Filters

- Dashboard Statistics

- Beautiful Charts

- Recent Activities

- Local File Uploads

- Backup & Restore

- Application Settings

- Responsive Tables

- Pagination

- Print Invoices

## Technical Requirements

- Clean Architecture

- Reusable Components

- Modular Code

- Proper Validation

- Secure Authentication

- Error Handling

- Production-Ready Code

- Responsive Design

- Optimized Performance

## Important Requirements

- Do NOT use any External API.

- Do NOT use any Third-Party API.

- Do NOT use API Keys or API Tokens.

- Do NOT use Firebase, Supabase, AWS, Azure, Cloud Services, or SaaS platforms.

- Do NOT use any Payment Gateway.

- Do NOT use UPI IDs, UPI QR Codes, Razorpay, Stripe, PayPal, PhonePe, Google Pay, or Paytm.

- Payments are for record-keeping only and entered manually by the Admin.

- Store all data locally using an internal database.

- The application must work completely offline without requiring an internet connection or any external services.

The final result should feel like a premium commercial Gym Management Software with a polished Black & Gold design, smooth animations, professional dashboards, excellent UX, modern statistics, beautiful charts, and production-quality code.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5c4d7447-48aa-439c-a227-632ce12f24ba).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
