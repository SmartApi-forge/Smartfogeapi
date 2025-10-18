"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";

const plans = [
  {
    title: "Starter",
    price: "$0",
    billed: "Forever free",
    isMostPopular: false,
    features: [
      "Generate up to 10 APIs/month",
      "Basic Express.js & Node.js templates",
      "REST API endpoints only",
      "Community Discord support",
      "Basic API documentation",
      "Rate limiting: 100 requests/day",
    ],
  },
  {
    title: "Developer",
    price: "$19",
    billed: "Per month",
    isMostPopular: true,
    features: [
      "Generate up to 100 APIs/month",
      "Full-stack templates (Express, FastAPI, Django)",
      "REST & GraphQL support",
      "Database integration (MongoDB, PostgreSQL)",
      "Authentication & authorization",
      "Swagger/OpenAPI docs auto-generated",
      "One-click deployment to Vercel",
      "Email & chat support",
      "Rate limiting: 10K requests/day",
    ],
  },
  {
    title: "Pro",
    price: "$49",
    billed: "Per month",
    isMostPopular: false,
    features: [
      "Unlimited API generation",
      "Advanced AI models (GPT-4, Claude)",
      "Microservices architecture support",
      "Custom business logic generation",
      "Real-time features (WebSockets, SSE)",
      "Advanced security middleware",
      "Performance optimization",
      "Custom domain deployment",
      "Priority support & SLA",
      "Rate limiting: 100K requests/day",
      "Team collaboration (up to 5 members)",
    ],
  },
];

export default function PricingSection() {
  return (
    <section className="py-16 md:py-32" id="pricing">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h1 className="text-center text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground leading-tight">
            Pricing that Scales with You
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Choose the perfect plan for your API development needs. From
            individual developers to enterprise teams.
          </p>
          <div>
            <Button asChild variant="link" className="px-0">
              <Link href="/pricing-comparator">View detailed comparison</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:mt-20 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.title}
              className={`bg-muted flex flex-col border-none shadow-none ${
                plan.isMostPopular ? "relative border-2 border-primary" : ""
              }`}
            >
              {plan.isMostPopular && (
                <span className="absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/20">
                  Most popular
                </span>
              )}

              <CardHeader>
                <CardTitle className="font-semibold text-lg sm:text-xl text-foreground">
                  {plan.title}
                </CardTitle>
                <span className="my-3 block text-2xl sm:text-3xl font-semibold text-foreground">
                  {plan.price}
                </span>
                <CardDescription className="text-sm sm:text-base text-muted-foreground">
                  {plan.billed}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 flex-1">
                <hr className="border-dashed border-border" />

                <ul className="list-outside space-y-3 text-sm sm:text-base">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="size-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground leading-relaxed">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="mt-auto">
                <Button
                  asChild
                  variant={plan.isMostPopular ? "default" : "outline"}
                  className="w-full"
                >
                  <Link href="/signup">Get Started</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
