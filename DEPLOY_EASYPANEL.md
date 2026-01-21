# Deploying Smile Forward to Easypanel

This guide explains how to deploy the **Smile Forward** application to your Easypanel server.

## Prerequisites
- An Easypanel server installed and running.
- This repository pushed to GitHub.
- Google Cloud API Credentials (for AI features).

## Step 1: Create the Project in Easypanel
1. Log in to your Easypanel dashboard.
2. Create a new **Project** (e.g., "Smile Forward").

## Step 2: Add the Application
1. Click **+ Service** -> **App**.
2. **Source**: Select "GitHub".
3. **Repository**: `aortiz13/smart-smile` (Make sure you have connected your GitHub account or added the repo URL).
4. **Branch**: `main` (or `master`).
5. **Build Type**: Select **Dockerfile** (Since we included a unified Dockerfile).
   - *Alternative*: You can try `Nixpacks` for auto-detection, but Dockerfile is more controlled.

## Step 3: Configure Environment Variables
Go to the **Environment** tab of your service and add the following keys. 
*(Copy values from your local `.env.local`)*

```env
# URL for your production app (if needed)
NEXT_PUBLIC_APP_URL=https://your-easypanel-domain.com

# Supabase Credentials (Connecting to your Supabase instance)
# If self-hosting Supabase on Easypanel, use the internal service URLs.
# If using Supabase Cloud, use the cloud URLs.
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google AI Credentials (Create a separate service for Edge Functions or run them here?)
# NOTE: The current setup uses Supabase Edge Functions for backend logic.
# Next.js is purely Frontend + Widget + Admin UI.
# The Docker container ONLY hosts the Next.js app.
```

## Step 4: Deploying Supabase Edge Functions
The Next.js app communicates with Supabase Edge Functions. These are usually hosted on Supabase itself.
If you are self-hosting Supabase on Easypanel, you need to deploy the functions to that instance or run them as a separate service.

**Option A: Using Supabase Cloud**
Run this locally to deploy functions to the cloud:
```bash
npx supabase functions deploy analyze-face --no-verify-jwt
npx supabase functions deploy generate-smile --no-verify-jwt
```
(Make sure to set secrets in Supabase dashboard for `GOOGLE_API_KEY`).

**Option B: Hosting Backend Logic in Next.js (Optimization)**
Currently, the logic is in `supabase/functions`. To make deployment easier on a single Easypanel container, we kept `analyze-face` separate.
Ensure your `NEXT_PUBLIC_SUPABASE_URL` points to where these functions are running.

## Step 5: Build & Deploy
Click **Deploy** in Easypanel.
Check the logs to ensure the build completes (it will run `npm run build` inside the Docker container).

## Verification
Once deployed, open the domain provided by Easypanel.
- Navigate to `/widget` to see the widget.
- Navigate to `/admin/dashboard` to see the admin panel.
