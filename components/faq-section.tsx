import { FAQAccordionClient, type FAQItem } from '@/components/faq-accordion-client'

// FAQ items with SEO-optimized questions and answers
const faqItems: FAQItem[] = [
  {
    id: 'item-1',
    question: 'How does SmartAPIForge generate APIs from natural language?',
    answer: 'SmartAPIForge uses advanced AI models to understand your natural language descriptions and automatically generate complete REST APIs. Simply describe what you need (e.g., "Create a user management API with CRUD operations"), and our system generates the code, endpoints, and documentation instantly.',
  },
  {
    id: 'item-2',
    question: 'What programming languages and frameworks are supported?',
    answer: 'We support multiple backend frameworks including Express.js, FastAPI, Django, Flask, Spring Boot, and NestJS. For databases, we support MongoDB, PostgreSQL, MySQL, and Redis. Frontend integration is available for React, Vue, and Angular with auto-generated client SDKs.',
  },
  {
    id: 'item-3',
    question: 'Can I customize the generated code and add my own business logic?',
    answer: 'Absolutely! All generated code is fully customizable. You can modify endpoints, add custom middleware, implement complex business logic, and integrate with existing systems. The generated code follows best practices and includes comprehensive comments for easy modification.',
  },
  {
    id: 'item-4',
    question: 'How does deployment work with SmartAPIForge?',
    answer: 'We offer one-click deployment to popular platforms like Vercel, Heroku, AWS, and Digital Ocean. You can also download the complete project as a zip file or push directly to GitHub. Enterprise plans include custom deployment pipelines and CI/CD integration.',
  },
  {
    id: 'item-5',
    question: 'What security features are included in generated APIs?',
    answer: 'All generated APIs include essential security features like JWT authentication, rate limiting, input validation, CORS configuration, and SQL injection prevention. Advanced security features like OAuth2, API key management, and role-based access control are available in paid plans.',
  },
  {
    id: 'item-6',
    question: 'Is there a limit to how many APIs I can generate?',
    answer: 'The free plan allows up to 10 API generations per month. Developer plan includes 100 generations, while Pro plan offers unlimited API creation. All plans include unlimited testing and modifications to your existing APIs.',
  },
  {
    id: 'item-7',
    question: 'How accurate is the AI-generated code?',
    answer: 'Our AI models are trained on thousands of production-ready APIs and follow industry best practices. The generated code includes proper error handling, validation, and documentation. We continuously improve our models based on user feedback and real-world usage patterns.',
  },
  {
    id: 'item-8',
    question: 'Can I integrate SmartAPIForge with my existing development workflow?',
    answer: 'Yes! We provide GitHub integration, VS Code extension, and CLI tools. You can sync generated APIs with your repositories, use our API in CI/CD pipelines, and integrate with popular development tools. Enterprise customers get custom integrations and API access.',
  }
]

// Generate FAQ structured data for Google rich snippets
function generateFAQSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export default function FAQSection() {
  return (
    <section className="py-16 md:py-32" id="faq">
      {/* FAQ Schema for Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateFAQSchema()),
        }}
      />
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground mt-3 sm:mt-4 text-base sm:text-lg text-balance leading-relaxed">
            Get answers to common questions about SmartAPIForge&apos;s AI-powered API generation platform.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl lg:max-w-4xl">
          <FAQAccordionClient items={faqItems} />
        </div>
      </div>
    </section>
  )
}
