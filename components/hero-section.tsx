import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Sparkles, Zap, Code, ArrowRight } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center space-y-8">
          {/* Main Headline */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              AI-Powered API Generation
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground leading-tight">
              Transform Your Ideas into <span className="text-primary">APIs Instantly</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Harness the power of AI for effortless API creation. No coding required. Just describe what you need, and
              watch SmartAPIForge build, test, and deploy your APIs automatically.
            </p>
          </div>

          {/* AI Input Section */}
          <div className="max-w-4xl mx-auto">
            <Card className="p-8 bg-card/80 backdrop-blur-sm border-2 border-primary/20 shadow-2xl">
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                    <Code className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Describe Your API</h3>
                    <p className="text-muted-foreground text-sm">Tell us what you want to build in plain English</p>
                  </div>
                </div>

                <Textarea
                  placeholder="Example: Create an API to manage a book inventory with add, update, view, and delete operations. Include fields for title, author, ISBN, price, and quantity in stock."
                  className="min-h-[120px] text-base resize-none border-2 border-border focus:border-primary transition-colors"
                />

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" className="flex-1 h-12 text-base font-semibold">
                    <Zap className="w-5 h-5 mr-2" />
                    Generate API
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <Button variant="outline" size="lg" className="h-12 text-base bg-transparent">
                    View Example
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-16">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">AI-Powered Generation</h3>
              <p className="text-muted-foreground text-sm">
                Advanced language models understand your requirements and generate production-ready code
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg">Instant Deployment</h3>
              <p className="text-muted-foreground text-sm">
                Automatically deploy to cloud platforms with built-in testing and documentation
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <Code className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">No Code Required</h3>
              <p className="text-muted-foreground text-sm">
                Perfect for non-developers and experts alike - just describe what you need
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
