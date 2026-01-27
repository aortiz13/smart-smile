'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an observability service
        console.error(error)
    }, [error])

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center bg-background rounded-xl border shadow-sm">
            <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
            </div>
            <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight">Something went wrong!</h2>
                <p className="text-muted-foreground max-w-md">
                    {error.message || "An unexpected error occurred while processing your request."}
                </p>
                {error.digest && <p className="text-xs font-mono text-muted-foreground">Error ID: {error.digest}</p>}
            </div>
            <div className="flex gap-2 mt-4">
                <Button onClick={() => reset()}>Try again</Button>
                <Button variant="outline" onClick={() => window.location.reload()}>Reload Page</Button>
            </div>
        </div>
    )
}
