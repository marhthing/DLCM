'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function Footer() {
  const pathname = usePathname()
  const [branchName, setBranchName] = useState<string | null>(null)
  
  useEffect(() => {
    // Check for user branch (regular users)
    const churchUser = localStorage.getItem('churchUser')
    if (churchUser) {
      try {
        const parsed = JSON.parse(churchUser)
        if (parsed.branch) {
          setBranchName(parsed.branch)
          return
        }
      } catch {}
    }
    
    // Check for admin branch
    const adminBranch = localStorage.getItem('adminBranch')
    if (adminBranch) {
      setBranchName(adminBranch)
      return
    }
    
    setBranchName(null)
  }, [pathname])
  
  // Don't show branch on login pages where user hasn't selected one yet
  const isLoginPage = pathname === '/' || pathname === '/admin/login'
  const showBranch = !isLoginPage && branchName
  
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 py-3 z-50">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-400">
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} Deeper Life Bible Church{showBranch ? ` - ${branchName} Branch` : ''}
          </p>
          <p className="text-center sm:text-right text-xs">
            All rights reserved
          </p>
        </div>
      </div>
    </footer>
  )
}
