
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import Footer from '@/components/footer'
import ServiceWorkerRegister from '@/components/service-worker-register'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Deeper Life Bible Church - Pontypridd Region',
  description: 'Watch live services from Deeper Life Bible Church, Pontypridd Region and track your attendance online.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Deeper Life Bible Church - Pontypridd Region',
    description: 'Watch live services from Deeper Life Bible Church, Pontypridd Region and track your attendance online.',
    type: 'website',
    images: ['https://deeperlifeclapham.org/wp-content/uploads/2024/02/Deeper-life-logo-final-outlines-.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <link rel="icon" type="image/png" href="https://deeperlifeclapham.org/wp-content/uploads/2024/02/Deeper-life-logo-final-outlines-.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DLBC Pontypridd" />
        <meta name="theme-color" content="#3b82f6" />
        <link rel="apple-touch-icon" href="https://deeperlifeclapham.org/wp-content/uploads/2024/02/Deeper-life-logo-final-outlines-.png" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ServiceWorkerRegister />
        <Providers>
          <div className="pb-16">
            {children}
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
