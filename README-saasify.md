# 🚀 SaaSifyx - AI-Powered SaaS Ideas Platform

An intelligent platform that helps developers validate, analyze, and build their SaaS projects with AI-powered insights and automated task generation.

![Project Status](https://img.shields.io/badge/Status-75%25%20Complete-green)
![AI Integration](https://img.shields.io/badge/AI-Gemini%20Powered-blue)
![Frontend](https://img.shields.io/badge/Frontend-Next.js%2015-black)
![Backend](https://img.shields.io/badge/Backend-Supabase-green)

## ✨ Key Features

### 🤖 **AI-Powered Analysis**
- **6-Pillar Scoring System**: Comprehensive SaaS idea evaluation
- **Intelligent Task Generation**: Automated development roadmaps
- **Smart Caching**: Optimized AI usage with persistent storage
- **Dynamic Content**: Project-specific explanations and insights

### 🎯 **Project Management**
- **Interactive Dashboard**: Beautiful, responsive project overview
- **Task Management**: AI-generated tasks with categories and priorities
- **User Flow Editor**: Visual project flow diagrams
- **Progress Tracking**: Real-time project development monitoring
- **Tabbed Navigation**: Seamless navigation between User Flow, Tickets Board, and Memory Bank
- **Memory Bank**: AI-powered code snippets and development insights
- **Kanban Board**: Drag-and-drop task management with priority indicators

### 🔐 **Authentication & Security**
- **Supabase Auth**: Email/password and OAuth integration
- **Row Level Security**: Secure data access policies
- **Session Management**: Automatic session handling and protection

### 🎨 **Modern UI/UX**
- **Dark Theme**: Sleek, professional design
- **Responsive Design**: Perfect on all devices
- **3D Animations**: Engaging visual effects with Framer Motion
- **Component Library**: shadcn/ui with custom enhancements

## 🛠 Tech Stack

### **Frontend**
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Modern component library
- **Framer Motion** - Smooth animations
- **Reactbits** - Advanced animation components

### **Backend**
- **Supabase** - Database, authentication, and real-time features
- **PostgreSQL** - Robust relational database
- **Row Level Security** - Fine-grained access control

### **AI Integration**
- **Gemini AI** - Primary AI provider for analysis and generation
- **Smart Caching** - Optimized API usage and cost management

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Gemini API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/saasifyx.git
cd saasifyx
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# AI APIs
GEMINI_API_KEY=your_gemini_api_key
```

4. **Set up database**
```bash
# Run the SQL migration in your Supabase dashboard
cat scripts/add-tasks-columns.sql
```

5. **Start development server**
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 📊 Current Implementation Status

### ✅ **Completed Features (75%)**
- **Authentication System**: Complete with OAuth and session management
- **AI Analysis**: 6-pillar SaaS idea evaluation with Gemini AI
- **Task Generation**: Intelligent development roadmaps with caching
- **Project Management**: Full CRUD operations and data persistence
- **User Interface**: Modern, responsive design with animations
- **Database Integration**: Supabase with optimized schema

### 🚧 **In Progress**
- **Advanced Task Management**: Drag-and-drop functionality
- **Team Collaboration**: Multi-user project sharing
- **Payment Integration**: Stripe subscription management

### 📋 **Planned Features**
- **Code Generation**: Cursor AI integration
- **Real-time Collaboration**: Live updates and comments
- **Advanced Analytics**: Usage insights and reporting
- **Mobile App**: React Native companion app

## 🤖 AI Features

### **Project Analysis**
- Evaluates SaaS ideas across 6 business pillars
- Provides detailed scoring and improvement suggestions
- Generates technical requirements and feature recommendations

### **Task Generation**
- Creates comprehensive development roadmaps
- Categorizes tasks by type (Setup, Frontend, Backend, etc.)
- Includes time estimates and dependency mapping
- Generates project-specific explanations

### **Smart Caching**
- Stores AI-generated content in Supabase
- Reduces API costs by 85-90%
- Instant loading of cached content
- User-controlled regeneration

## 🗂️ Project Navigation

### **Tab-Based Project Management**
Each project includes four main tabs accessible via `/studio/ai-insights/[projectId]/`:

1. **User Flow** (`/user-flow`) - Interactive diagram editor for mapping user journeys
2. **Tickets Board** (`/tickets`) - Kanban-style task management with drag-and-drop
3. **Overview** (`/`) - Project dashboard with metrics and progress tracking
4. **Memory Bank** (`/memory-bank`) - AI-powered code snippets and development insights

### **Dynamic Content Generation**
- **AI-Generated Explanations**: Each tab includes contextual "About" sections
- **Smart Caching**: Explanations are cached locally to avoid repeated API calls
- **Gemini Integration**: Uses Gemini AI for dynamic content generation

## 📁 Project Structure

```
├── app/                      # Next.js App Router
│   ├── auth/                 # Authentication pages
│   ├── studio/               # Main dashboard
│   │   ├── ai-insights/      # Project analysis
│   │   │   └── [projectId]/  # Dynamic project routes
│   │   │       ├── page.tsx  # Redirect to user-flow
│   │   │       ├── user-flow/# User Flow tab
│   │   │       ├── tickets/  # Tickets Board tab
│   │   │       └── memory-bank/ # Memory Bank tab
│   │   └── projects/         # Legacy project management
│   └── pricing/              # Pricing page
├── components/               # React components
│   ├── ui/                   # shadcn/ui components
│   ├── studio/               # Dashboard components
│   └── landing/              # Landing page components
├── lib/                      # Utilities and services
│   ├── services/             # Business logic
│   │   ├── gemini-service.ts # AI integration
│   │   └── supabase-service.ts # Database operations
│   └── supabase/             # Supabase client
└── docs/                     # Documentation
```

## 🔧 Configuration

### **Database Setup**
Run the following SQL in your Supabase dashboard:

```sql
-- Add AI task storage columns
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS generated_tasks JSONB,
ADD COLUMN IF NOT EXISTS tasks_explanation TEXT,
ADD COLUMN IF NOT EXISTS tasks_generated_at TIMESTAMPTZ;
```

### **Environment Variables**
- `GEMINI_API_KEY`: Get from [Google AI Studio](https://aistudio.google.com/)
- `SUPABASE_URL` & `SUPABASE_ANON_KEY`: From your Supabase dashboard
- `SUPABASE_SERVICE_KEY`: Service role key for server operations

## 📚 Documentation

- **[Implementation Status](implementation-status.md)** - Detailed progress tracking
- **[AI Features](ai-features.md)** - Comprehensive AI documentation
- **[Project Structure](project-structure.md)** - Architecture overview
- **[Database Schema](database-schema.md)** - Database design
- **[UI Components](docs/)** - Component documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Gemini AI** for powerful language model capabilities
- **Supabase** for excellent backend-as-a-service
- **shadcn/ui** for beautiful component library
- **Reactbits** for advanced animation components

---

**Built with ❤️ by the SaaSifyx team**

## Project Management Features

### Dashboard Projects

The dashboard includes a modern project management interface that allows you to:

- Create new projects with a proper dialog interface
- Rename, duplicate, and delete projects
- Filter projects by tags
- View project progress and status
- Navigate to user flow, tasks, and AI insights for each project

### Database Integration

The project uses Supabase for database storage and authentication:

- Projects are stored in a PostgreSQL database with row-level security (RLS) policies
- Each user can only access their own projects
- Changes to projects are saved in real-time

### Applying Database Migrations

To set up the required database tables and policies:

1. Make sure you have the Supabase CLI installed
2. Run the migration script:

```bash
# Set your Supabase project ID
export SUPABASE_PROJECT_ID=your_project_id

# Apply all migrations
node scripts/apply-migrations.js
```

Alternatively, you can pass the project ID directly:

```bash
node scripts/apply-migrations.js your_project_id
```

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```
