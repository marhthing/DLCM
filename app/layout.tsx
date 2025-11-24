
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Deeper Life Bible Church - Pontypridd Region',
  description: 'Watch live services from Deeper Life Bible Church, Pontypridd Region and track your attendance online.',
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
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="https://deeperlifeclapham.org/wp-content/uploads/2024/02/Deeper-life-logo-final-outlines-.png" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
