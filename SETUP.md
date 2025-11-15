# 🚀 SmartAPIForge - Quick Setup Guide

Welcome! This guide will help you set up SmartAPIForge on your local machine in under 10 minutes.

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** >= 18.17.0 ([Download](https://nodejs.org/))
- **pnpm** >= 8.0.0 (Install: `npm install -g pnpm`)
- **Git** >= 2.40.0

## ⚡ Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Shashank4507/smart-forge-api.git
cd smart-forge-api
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp env.example .env.local
```

Now edit `.env.local` and configure the following sections:

---

## 🔐 Required Environment Variables

### 1️⃣ Supabase Configuration (Required)

Supabase provides authentication and database services.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**How to get these:**
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (takes ~2 minutes)
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

---

### 2️⃣ Authentication Secrets (Required)

```env
JWT_SECRET=your_strong_jwt_secret_minimum_32_characters
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://localhost:3000
```

**How to generate:**
```bash
# Generate JWT_SECRET (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate NEXTAUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 3️⃣ Daytona Sandbox Configuration (Required)

Daytona provides cloud sandboxes for running your projects in isolated environments.

```env
DAYTONA_API_KEY=dtn_your_api_key_here
DAYTONA_API_URL=https://app.daytona.io/api
DAYTONA_TARGET=us
DAYTONA_IMAGE=node:22.12.0-bookworm
```

**How to get Daytona API Key:**
1. Go to [app.daytona.io](https://app.daytona.io) and sign up
2. Complete email verification (required for Tier 1: 10 vCPU, 10GB RAM, 30GB storage)
3. Navigate to **Settings** → **API Keys**
4. Click **Create New API Key**
5. Copy the key (starts with `dtn_`) → `DAYTONA_API_KEY`

**Why Daytona?**
- ✅ **Free Tier Available**: 10 vCPU, 10GB RAM, 30GB storage
- ✅ **Instant Sandboxes**: Clone and run repos in seconds
- ✅ **PTY Support**: Built-in terminal access
- ✅ **Preview URLs**: Automatic HTTPS preview links
- ✅ **No Docker Required**: Everything runs in the cloud

---

### 4️⃣ OpenAI Configuration (Required)

OpenAI powers the AI code generation features.

```env
OPENAI_API_KEY=sk-your_openai_api_key_here
```

**How to get:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign in or create an account
3. Navigate to **API Keys** section
4. Click **Create new secret key**
5. Copy the key → `OPENAI_API_KEY`

**Note**: You'll need to add credits to your OpenAI account ($5-10 recommended for testing).

---

### 5️⃣ GitHub OAuth Integration (Optional - For Repository Features)

Enables users to connect their GitHub accounts and clone repositories.

```env
GITHUB_ID=your_github_oauth_client_id
GITHUB_SECRET=your_github_oauth_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
GITHUB_TOKEN_ENCRYPTION_KEY=your_64_character_hex_key
```

**How to setup GitHub OAuth:**

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in:
   - **Application name**: SmartAPIForge Local
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback`
4. Click **Register application**
5. Copy **Client ID** → `GITHUB_ID`
6. Click **Generate a new client secret**
7. Copy the secret → `GITHUB_SECRET`

**Generate encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 6️⃣ Inngest Configuration (Optional - For Background Jobs)

Inngest handles background job processing for API generation.

```env
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
```

**How to get:**
1. Go to [inngest.com](https://inngest.com) and create a free account
2. Create a new app
3. Go to **Settings** → **Keys**
4. Copy:
   - **Event Key** → `INNGEST_EVENT_KEY`
   - **Signing Key** → `INNGEST_SIGNING_KEY`

**Note**: For local development, you can start without Inngest and use the dev server later.

---

## 🎯 Complete `.env.local` Example

Here's what your final `.env.local` should look like:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xyzproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Authentication
JWT_SECRET=XOjxDeXJVFRsYX7VF0zHOdWYipi3plHsUTWHrGcGIN+pe0P...
NEXTAUTH_SECRET=2c3abd80e52b0e8dc875154f29fd12f4015de045b3e1a6a...
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Daytona Sandbox Configuration
DAYTONA_API_KEY=dtn_de27f7c7a47eec05810e21e6cf5e8ef1a8d...
DAYTONA_API_URL=https://app.daytona.io/api
DAYTONA_TARGET=us
DAYTONA_IMAGE=node:22.12.0-bookworm

# OpenAI
OPENAI_API_KEY=sk-proj-P1ZDBl1elPdjylotwCjoxoC5rn3EM4rxpqEG...

# GitHub OAuth (Optional)
GITHUB_ID=Ov23liMOGgT8IbWJOQxU
GITHUB_SECRET=a531e4438e1043f1d836a626889f2db7b564245e
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
GITHUB_TOKEN_ENCRYPTION_KEY=397af9951c67a28efdfc2f00b336803e8b8fc2a6b84f1...

# Inngest (Optional)
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
```

---

## 🏃 Running the Application

### Start Development Server

```bash
# Start Next.js application
pnpm dev
```

The app will be available at **http://localhost:3000**

### Start Inngest Dev Server (Optional - in separate terminal)

```bash
# If using Inngest for background jobs
pnpm dev:inngest
```

Inngest dashboard will be at **http://localhost:8288**

---

## ✅ Verify Your Setup

### Test Checklist

After starting the app, verify:

- [ ] **Homepage loads** at http://localhost:3000
- [ ] **Sign up** works (Supabase auth)
- [ ] **Dashboard** is accessible after login
- [ ] **GitHub connect** button appears (if configured)
- [ ] **Console has no errors**

### Quick Test Commands

```bash
# Check if all dependencies are installed
pnpm list --depth=0

# Verify environment variables are loaded
pnpm dev

# Check TypeScript types
pnpm tsc --noEmit
```

---

## 🐛 Troubleshooting

### Common Issues

#### ❌ "Module not found" errors
```bash
rm -rf node_modules .next
pnpm install
```

#### ❌ Supabase connection failed
- Verify your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check if the Supabase project is active
- Test connection: `curl https://your-project.supabase.co/rest/v1/`

#### ❌ Daytona API errors
- Verify your `DAYTONA_API_KEY` is correct
- Check if you've completed email verification
- Test API key: 
  ```bash
  curl -H "Authorization: Bearer YOUR_API_KEY" https://app.daytona.io/api/v1/profile
  ```

#### ❌ OpenAI API errors
- Verify your `OPENAI_API_KEY`
- Ensure you have sufficient credits
- Check usage at [platform.openai.com/usage](https://platform.openai.com/usage)

#### ❌ Port 3000 already in use
```bash
# Kill the process on port 3000
# On macOS/Linux:
lsof -ti:3000 | xargs kill -9

# On Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## 📚 Next Steps

Now that your environment is set up:

1. **Read the Documentation**: Check [ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand the system
2. **Try Creating an API**: Use the dashboard to generate your first API
3. **Explore Features**: Connect GitHub, clone repos, use the terminal
4. **Join Community**: Report issues or contribute on [GitHub](https://github.com/Shashank4507/smart-forge-api)

---

## 🆘 Need Help?

- 📖 **Documentation**: [README.md](README.md)
- 🐛 **Issues**: [GitHub Issues](https://github.com/Shashank4507/smart-forge-api/issues)
- 💬 **Community**: Join our [Discord](https://discord.gg/smartapiforge)
- 📧 **Email**: support@smartapiforge.dev

---

## 🎉 You're All Set!

Your SmartAPIForge development environment is ready. Happy coding! 🚀

**Made with ❤️ by developers, for developers**
