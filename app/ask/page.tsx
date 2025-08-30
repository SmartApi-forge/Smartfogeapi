"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  Search,
  MessageSquare,
  User, 
  Settings, 
  Plus, 
  Paperclip,
  Send,
  Sun,
  Moon,
  Laptop,
  Home,
  Code,
  FileText,
  BookOpen,
  PanelLeft
} from 'lucide-react'
import { ThemeSwitch } from "@/components/ui/theme-switch"
import { AiInput } from "@/components/ui/ai-input"
import ThreeDOrb from "@/components/three-d-orb"

// API-specific example prompts for SmartAPIForge
const examplePrompts = [
  {
    id: 1,
    title: "User authentication API",
    description: "JWT tokens, OAuth, role-based access",
    icon: <User className="w-4 h-4" />
  },
  {
    id: 2,
    title: "E-commerce API",
    description: "Products, orders, payments, inventory",
    icon: <Code className="w-4 h-4" />
  },
  {
    id: 3,
    title: "Blog API",
    description: "Posts, comments, categories, tags",
    icon: <FileText className="w-4 h-4" />
  },
  {
    id: 4,
    title: "Task management API",
    description: "Projects, tasks, teams, deadlines",
    icon: <MessageSquare className="w-4 h-4" />
  },
  {
    id: 5,
    title: "Social media API",
    description: "Posts, likes, follows, messaging",
    icon: <User className="w-4 h-4" />
  },
  {
    id: 6,
    title: "Analytics dashboard",
    description: "Metrics, reports, data visualization",
    icon: <Code className="w-4 h-4" />
  }
]

// Chat history data to match ChatGPT interface
const chatHistory = [
  {
    id: 1,
    title: "E-commerce API with payments",
    timestamp: "2 hours ago"
  },
  {
    id: 2,
    title: "User authentication system",
    timestamp: "1 day ago"
  },
  {
    id: 3,
    title: "Blog API with comments",
    timestamp: "2 days ago"
  },
  {
    id: 4,
    title: "Task management endpoints",
    timestamp: "3 days ago"
  },
  {
    id: 5,
    title: "Analytics dashboard API",
    timestamp: "1 week ago"
  }
]

export default function Dashboard() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState({ name: 'Shashank', email: 'shashank@example.com' })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [logoHovered, setLogoHovered] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Handle responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) {
        setSidebarCollapsed(true)
        setMobileMenuOpen(false)
      }
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      const authToken = localStorage.getItem("authToken")
      if (!authToken) {
        router.push("/?auth=login")
        return
      }
      setIsAuthenticated(true)
    }
    checkAuth()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    router.push("/")
  }



  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background dark:bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex relative">
      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      {/* Sidebar - Responsive ChatGPT Style */}
      <aside 
        className={`
          fixed left-0 top-0 h-full bg-card border-r border-border flex flex-col z-40 transition-all duration-200
          ${isMobile ? (
            mobileMenuOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full'
          ) : (
            sidebarCollapsed ? 'w-12' : 'w-64'
          )}
        `}
      >
        {/* Header */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 relative group">
              <button
                onClick={() => {
                  if (isMobile) {
                    setMobileMenuOpen(!mobileMenuOpen)
                  } else {
                    setSidebarCollapsed(!sidebarCollapsed)
                  }
                }}
                onMouseEnter={() => setLogoHovered(true)}
                onMouseLeave={() => setLogoHovered(false)}
                className="w-6 h-6 bg-blue-600 hover:bg-blue-700 rounded-sm flex items-center justify-center transition-all duration-200 relative"
                title={isMobile ? "Toggle menu" : (sidebarCollapsed ? "Open sidebar" : "Collapse sidebar")}
              >
                {(sidebarCollapsed && logoHovered && !isMobile) ? (
                  <PanelLeft className="w-4 h-4 text-white" />
                ) : (
                  <span className="text-xs font-bold text-white">SF</span>
                )}
                {/* Tooltip for collapsed state - only on desktop */}
                {!isMobile && sidebarCollapsed && !logoHovered && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    Open sidebar
                  </div>
                )}
              </button>
              {(!sidebarCollapsed || (isMobile && mobileMenuOpen)) && (
                <>
                  <span className="font-semibold text-sm">Smart Forge</span>
                  {!isMobile && (
                    <button
                      onClick={() => setSidebarCollapsed(true)}
                      className="p-1 hover:bg-accent rounded-md transition-colors ml-auto"
                      title="Collapse sidebar"
                    >
                      <PanelLeft className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </>
              )}
            </div>
            {(!sidebarCollapsed || (isMobile && mobileMenuOpen)) && (
              <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
                <Plus className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          
          {(!sidebarCollapsed || (isMobile && mobileMenuOpen)) ? (
            <button className="w-full p-2.5 text-left text-sm bg-muted/60 rounded-lg hover:bg-muted dark:hover:bg-foreground/10 transition-colors flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              New chat
            </button>
          ) : (
            <button className="w-6 h-6 mx-auto bg-muted/60 rounded-lg hover:bg-muted dark:hover:bg-foreground/10 transition-colors flex items-center justify-center" title="New chat">
              <MessageSquare className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Navigation */}
        <nav className="px-3 pb-3">
          <div className="space-y-1">
            <button className={`flex items-center ${(!sidebarCollapsed || (isMobile && mobileMenuOpen)) ? 'gap-3 w-full px-3' : 'justify-center w-6 mx-auto'} py-2 text-sm rounded-lg hover:bg-muted dark:hover:bg-foreground/10 text-foreground transition-colors`} title={(sidebarCollapsed && !isMobile) ? "Search chats" : ""}>
              <Search className="w-4 h-4" />
              {(!sidebarCollapsed || (isMobile && mobileMenuOpen)) && <span>Search chats</span>}
            </button>
            <button className={`flex items-center ${(!sidebarCollapsed || (isMobile && mobileMenuOpen)) ? 'gap-3 w-full px-3' : 'justify-center w-6 mx-auto'} py-2 text-sm rounded-lg hover:bg-muted dark:hover:bg-foreground/10 text-foreground transition-colors`} title={(sidebarCollapsed && !isMobile) ? "Library" : ""}>
              <BookOpen className="w-4 h-4" />
              {(!sidebarCollapsed || (isMobile && mobileMenuOpen)) && <span>Library</span>}
            </button>
          </div>
        </nav>
        
        {/* Chat History Section */}
        {(!sidebarCollapsed || (isMobile && mobileMenuOpen)) && (
          <div className="flex-1 px-3 overflow-y-auto">
            <div className="text-xs text-muted-foreground mb-2 px-3">Chats</div>
            <div className="space-y-1">
              {chatHistory.map((chat, idx) => (
                <button
                  key={chat.id}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors group ${idx === 0 ? 'bg-muted' : 'hover:bg-muted dark:hover:bg-foreground/8'}`}
                  onClick={() => isMobile && setMobileMenuOpen(false)}
                >
                  <div className="text-sm text-foreground truncate">{chat.title}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Collapsed state spacer */}
        {(sidebarCollapsed && !isMobile) && <div className="flex-1"></div>}
        
        {/* Bottom User Section */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-white">S</span>
            </div>
            {(!sidebarCollapsed || (isMobile && mobileMenuOpen)) && (
              <>
                <span className="text-sm font-medium flex-1">{user.name}</span>
                <ThemeSwitch
                  modes={["light", "dark", "system"]}
                  icons={[
                    <Sun key="sun-icon" size={14} />,
                    <Moon key="moon-icon" size={14} />,
                    <Laptop key="laptop-icon" size={14} />,
                  ]}
                  showInactiveIcons="all"
                  variant="circle-blur"
                  start="bottom-left"
                  animationVariant="circle-blur"
                />
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`
        flex-1 flex flex-col transition-all duration-200
        ${isMobile ? 'ml-0' : (sidebarCollapsed ? 'ml-12' : 'ml-64')}
      `}>
        {/* Mobile Menu Button */}
        {isMobile && (
          <div className="fixed top-4 left-4 z-50 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 bg-card border border-border rounded-lg shadow-lg hover:bg-muted dark:hover:bg-foreground/10 transition-colors"
              aria-label="Toggle menu"
            >
              <PanelLeft className="w-5 h-5 text-foreground" />
            </button>
          </div>
        )}
        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-8 pt-20">
          <div className="w-full max-w-3xl mx-auto text-center">
            {/* Greeting with Spline 3D Scene */}
            <div className="mb-8">
              <div className="w-32 h-32 mx-auto mb-6">
                <ThreeDOrb />
              </div>
              <h1 className="text-4xl font-medium text-foreground mb-2">
                Good Evening, <span className="text-foreground">{user.name}</span>
              </h1>
              <p className="text-xl text-muted-foreground">
                What <span className="text-blue-600 font-medium">API</span> can I help you build?
              </p>
            </div>
            
            {/* AI Input */}
            <div className="mb-8">
              <AiInput isAuthenticated={isAuthenticated} />
            </div>
            
            {/* Template Section - Clean pill-style layout */}
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-wrap justify-center gap-2 px-4">
                {examplePrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    className="group inline-flex items-center gap-2 px-4 py-2.5 bg-card/60 hover:bg-card border border-border/50 hover:border-border rounded-full text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 hover:shadow-sm hover:scale-[1.02] backdrop-blur-sm"
                    title={prompt.description}
                  >
                    <div className="p-1 bg-blue-600/10 group-hover:bg-blue-600/20 rounded-md transition-colors">
                      <div className="text-blue-600 group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300">
                        {prompt.icon}
                      </div>
                    </div>
                    <span className="whitespace-nowrap">{prompt.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom Stats/Info */}
        <div className="flex items-center justify-center gap-8 p-4 border-t border-border">
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">12</div>
            <div className="text-xs text-muted-foreground">APIs Generated</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">8</div>
            <div className="text-xs text-muted-foreground">Deployed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">&lt; 40s</div>
            <div className="text-xs text-muted-foreground">Avg Generation</div>
          </div>
        </div>
      </main>
    </div>
  )
}
