import type React from "react";
import {
  OpenAI,
  Anthropic,
  Mistral,
  HuggingFace,
  Cohere,
} from "@/components/logos";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function IntegrationsSection() {
  return (
    <section>
      <div className="bg-muted dark:bg-background py-24 md:py-32">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-md px-6 [mask-image:radial-gradient(ellipse_100%_100%_at_50%_0%,#000_70%,transparent_100%)]">
            <div className="bg-background dark:bg-muted/50 rounded-xl border px-6 pb-12 pt-3 shadow-xl">
              <Integration
                icon={<OpenAI />}
                name="OpenAI"
                description="Generate APIs using GPT-4 and other OpenAI models for intelligent code creation."
              />
              <Integration
                icon={<Anthropic />}
                name="Anthropic"
                description="Leverage Claude's advanced reasoning for complex API logic and documentation."
              />
              <Integration
                icon={<Mistral />}
                name="Mistral AI"
                description="Fast and efficient API generation with Mistral's optimized language models."
              />
              <Integration
                icon={<HuggingFace />}
                name="Hugging Face"
                description="Access thousands of open-source models for specialized API generation tasks."
              />
              <Integration
                icon={<Cohere />}
                name="Cohere"
                description="Enterprise-grade API generation with Cohere's powerful language models."
              />
            </div>
          </div>
          <div className="mx-auto mt-6 max-w-lg space-y-6 text-center">
            <h2 className="text-balance text-3xl font-semibold md:text-4xl lg:text-5xl">
              Integrate with your favorite LLMs
            </h2>
            <p className="text-muted-foreground">
              Connect seamlessly with leading AI models to power your API
              generation workflow.
            </p>

            <Button variant="outline" size="sm" asChild>
              <Link href="#">Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const Integration = ({
  icon,
  name,
  description,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
}) => {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-dashed py-3 last:border-b-0">
      <div className="bg-muted border-foreground/5 flex size-12 items-center justify-center rounded-lg border">
        {icon}
      </div>
      <div className="space-y-0.5 min-w-0">
        <h3 className="text-sm font-medium">{name}</h3>
        <p className="text-muted-foreground line-clamp-1 text-sm">
          {description}
        </p>
      </div>
      <div className="flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-full hover:bg-muted/50 transition-colors"
          aria-label="Add integration"
        >
          <Plus className="size-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
};
