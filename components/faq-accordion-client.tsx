'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export interface FAQItem {
  id: string
  question: string
  answer: string
}

interface FAQAccordionClientProps {
  items: FAQItem[]
}

export function FAQAccordionClient({ items }: FAQAccordionClientProps) {
  return (
    <Accordion
      type="single"
      collapsible
      className="bg-card ring-muted w-full rounded-2xl border px-8 py-3 shadow-sm ring-4 dark:ring-0">
      {items.map((item) => (
        <AccordionItem
          key={item.id}
          value={item.id}
          className="border-dashed">
          <AccordionTrigger className="cursor-pointer text-sm sm:text-base hover:no-underline text-left font-medium">
            {item.question}
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {item.answer}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
