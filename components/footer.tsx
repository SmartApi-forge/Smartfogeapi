import Link from 'next/link'

export default function FooterSection() {
    return (
        <footer className="border-t border-border bg-background">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="py-6">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <p className="text-sm text-muted-foreground">
                            © {new Date().getFullYear()} SmartAPIForge. All rights reserved.
                        </p>
                        <Link
                            href="/terms"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Terms & Conditions
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    )
}
