import { Button } from "@/components/ui/button";
import { Check, Sparkles, Star } from "lucide-react";
import Link from "next/link";

const tableData = [
  {
    feature: "API generation/month",
    starter: "10",
    developer: "100",
    pro: "Unlimited",
  },
  {
    feature: "Templates",
    starter: "Basic Express.js & Node.js",
    developer: "Express, FastAPI, Django",
    pro: "All + Microservices",
  },
  {
    feature: "API types",
    starter: "REST",
    developer: "REST & GraphQL",
    pro: "REST, GraphQL, Realtime",
  },
  {
    feature: "Database integration",
    starter: "",
    developer: "MongoDB, PostgreSQL",
    pro: "All + Advanced config",
  },
  {
    feature: "Auth (AuthN/Z)",
    starter: "",
    developer: "Included",
    pro: "Advanced policies",
  },
  {
    feature: "Docs",
    starter: "Basic",
    developer: "Swagger/OpenAPI auto‑generated",
    pro: "Custom + Advanced",
  },
  {
    feature: "Deployment",
    starter: "",
    developer: "One‑click to Vercel",
    pro: "Custom domain + pipelines",
  },
  {
    feature: "Support",
    starter: "Community",
    developer: "Email & chat",
    pro: "Priority & SLA",
  },
  {
    feature: "Rate limiting",
    starter: "100 req/day",
    developer: "10K req/day",
    pro: "100K req/day",
  },
  { feature: "Team members", starter: "", developer: "", pro: "Up to 5" },
];

export default function PricingComparator() {
  return (
    <section className="bg-muted py-16 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="w-full overflow-auto lg:overflow-visible">
          <table className="w-[200vw] border-separate border-spacing-x-3 md:w-full dark:[--color-muted:var(--color-zinc-900)]">
            <thead className="bg-muted/95 sticky top-0">
              <tr className="*:py-4 *:text-left *:font-medium">
                <th className="lg:w-2/5"></th>
                <th className="space-y-3">
                  <span className="block">Starter</span>

                  <Button asChild variant="outline">
                    <Link href="/signup">Get Started</Link>
                  </Button>
                </th>
                <th className="space-y-3">
                  <span className="block">Developer</span>
                  <Button asChild>
                    <Link href="/signup">Get Started</Link>
                  </Button>
                </th>
                <th className="space-y-3">
                  <span className="block">Pro</span>
                  <Button asChild variant="outline">
                    <Link href="/signup">Get Started</Link>
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="*:py-4">
                <td className="flex items-center gap-2 font-medium">
                  <Star className="size-4" />
                  <span>Features</span>
                </td>
                <td></td>
                <td className="border-none px-4"></td>
                <td></td>
              </tr>
              {tableData.slice(0, 3).map((row, index) => (
                <tr key={index} className="*:border-b *:py-4">
                  <td className="text-muted-foreground">{row.feature}</td>
                  <td>{(row as any).starter}</td>
                  <td>{(row as any).developer}</td>
                  <td>{(row as any).pro}</td>
                </tr>
              ))}
              <tr className="*:pb-4 *:pt-8">
                <td className="flex items-center gap-2 font-medium">
                  <Sparkles className="size-4" />
                  <span>AI Models</span>
                </td>
                <td></td>
                <td className="bg-muted border-none px-4"></td>
                <td></td>
              </tr>
              {tableData.map((row, index) => (
                <tr key={index} className="*:border-b *:py-4">
                  <td className="text-muted-foreground">{row.feature}</td>
                  <td>{(row as any).starter}</td>
                  <td>{(row as any).developer}</td>
                  <td>{(row as any).pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
