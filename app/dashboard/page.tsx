import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardContent } from "@/components/dashboard-content"

export default function DashboardPage() {
  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/anime-1.jpeg')"
      }}
    >
      <DashboardHeader />
      <DashboardContent />
    </div>
  )
}