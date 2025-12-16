import { redirect } from 'next/navigation'

export default function DocsPage() {
  // Redirect to introduction page
  redirect('/docs/getting-started/introduction')
}
