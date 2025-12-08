
export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 py-3 z-50">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-400">
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} Deeper Life Bible Church - Pontypridd Branch
          </p>
          <p className="text-center sm:text-right text-xs">
            All rights reserved
          </p>
        </div>
      </div>
    </footer>
  )
}
