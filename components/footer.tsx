import { Logo } from '@/components/logo'
import Link from 'next/link'

const footerSections = [
    {
        title: 'Product',
        links: [
            { title: 'Features', href: '/#features', scroll: true },
            { title: 'Pricing', href: '/#pricing', scroll: true },
            { title: 'Start Building', href: '/ask', scroll: false },
        ],
    },
    {
        title: 'Resources',
        links: [
            { title: 'Documentation', href: '/docs', scroll: false },
            { title: 'Getting Started', href: '/docs/getting-started/introduction', scroll: false },
            { title: 'Quick Start', href: '/docs/getting-started/quick-start', scroll: false },
        ],
    },
    {
        title: 'Legal',
        links: [
            { title: 'Terms & Conditions', href: '/terms', scroll: false },
            { title: 'Privacy Policy', href: '/privacy', scroll: false },
        ],
    },
]

export default function FooterSection() {
    return (
        <footer className="border-t border-border bg-background">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Main Footer Content */}
                <div className="py-12 lg:py-16">
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                        {/* Brand Section */}
                        <div className="lg:col-span-4">
                            <Link href="/" aria-label="SmartAPIForge Home" className="inline-block">
                                <Logo />
                            </Link>
                            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
                                AI-powered platform for building production-ready, full-stack web applications with natural language.
                            </p>
                            {/* GitHub Link */}
                            <div className="mt-6">
                                <Link
                                    href="https://github.com/SmartApi-forge"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="GitHub"
                                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <svg
                                        className="size-5"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                    >
                                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                                    </svg>
                                    <span>View on GitHub</span>
                                </Link>
                            </div>
                        </div>

                        {/* Links Sections */}
                        <div className="lg:col-span-8">
                            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                                {footerSections.map((section) => (
                                    <div key={section.title}>
                                        <h3 className="text-sm font-semibold text-foreground mb-4">
                                            {section.title}
                                        </h3>
                                        <ul className="space-y-3">
                                            {section.links.map((link) => (
                                                <li key={link.title}>
                                                    <Link
                                                        href={link.href}
                                                        scroll={link.scroll !== false}
                                                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                                    >
                                                        {link.title}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-border py-6">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <p className="text-sm text-muted-foreground">
                            © {new Date().getFullYear()} SmartAPIForge. All rights reserved.
                        </p>
                        <div className="flex items-center gap-6">
                            <Link
                                href="/terms"
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Terms
                            </Link>
                            <Link
                                href="/privacy"
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Privacy
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}
