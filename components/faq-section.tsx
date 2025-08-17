'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import Link from 'next/link'

export default function FAQSection() {
    const faqItems = [
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

    return (
        <section className="py-16 md:py-32" id="faq">
            <div className="mx-auto max-w-5xl px-4 md:px-6">
                <div className="mx-auto max-w-xl text-center">
                    <h2 className="text-balance text-3xl font-bold md:text-4xl lg:text-5xl">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-muted-foreground mt-4 text-balance">
                        Get answers to common questions about SmartAPIForge's AI-powered API generation platform.
                    </p>
                </div>

                <div className="mx-auto mt-12 max-w-xl">
                    <Accordion
                        type="single"
                        collapsible
                        className="bg-card ring-muted w-full rounded-2xl border px-8 py-3 shadow-sm ring-4 dark:ring-0">
                        {faqItems.map((item) => (
                            <AccordionItem
                                key={item.id}
                                value={item.id}
                                className="border-dashed">
                                <AccordionTrigger className="cursor-pointer text-base hover:no-underline text-left">
                                    {item.question}
                                </AccordionTrigger>
                                <AccordionContent>
                                    <p className="text-base text-gray-600 dark:text-gray-300">
                                        {item.answer}
                                    </p>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>

                    <p className="text-muted-foreground mt-6 px-8 text-center">
                        Still have questions? Contact our{' '}
                        <Link
                            href="/contact"
                            className="text-primary font-medium hover:underline">
                            support team
                        </Link>{' '}
                        or check out our{' '}
                        <Link
                            href="/docs"
                            className="text-primary font-medium hover:underline">
                            documentation
                        </Link>.
                    </p>
                </div>
            </div>
        </section>
    )
}
