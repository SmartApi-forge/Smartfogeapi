// Re-export from the new modular header structure
// The header has been refactored to use a hybrid Server/Client Component architecture
// - Server Component: Main header layout, Logo, static navigation structure
// - Client Components: MobileMenuClient, MegaMenuClient, HeaderActionsClient (for interactivity)
export { HeroHeader } from './header/index';
