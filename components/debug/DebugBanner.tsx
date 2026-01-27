import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export function DebugBanner() {
    const checks = [
        {
            name: "API_KEY (Gemini/Google)",
            value: process.env.API_KEY,
            isSecret: true,
        },
        {
            name: "NEXT_PUBLIC_SUPABASE_URL",
            value: process.env.NEXT_PUBLIC_SUPABASE_URL,
            isSecret: false,
        },
        {
            name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
            value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            isSecret: true,
        },
    ];

    const hasErrors = checks.some((c) => !c.value);

    if (!hasErrors) {
        // Optional: Hide if everything is OK, or show green briefly. 
        // User asked to see problems, but knowing it's OK is also useful.
        return (
            <div className="bg-green-600 text-white p-2 text-xs font-mono flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>System Status: All systems operational. Env Vars Loaded.</span>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-destructive text-destructive-foreground p-4 border-b-4 border-red-900 font-mono text-sm">
            <div className="container mx-auto">
                <div className="flex items-center gap-2 mb-2 font-bold text-lg">
                    <AlertTriangle className="w-6 h-6" />
                    <span>SYSTEM CONFIGURATION ERROR</span>
                </div>
                <p className="mb-4">The following environment variables are missing or invalid:</p>
                <div className="grid gap-2 max-w-2xl bg-black/20 p-4 rounded">
                    {checks.map((check) => (
                        <div key={check.name} className="flex items-center justify-between border-b border-white/10 pb-2 last:border-0">
                            <span className="font-semibold">{check.name}:</span>
                            <div className="flex items-center gap-2">
                                {check.value ? (
                                    <span className="text-green-300 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        {check.isSecret ? "Set (Hidden)" : check.value.substring(0, 20) + "..."}
                                    </span>
                                ) : (
                                    <span className="text-red-300 font-bold flex items-center gap-1">
                                        <XCircle className="w-3 h-3" /> MISSING
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <p className="mt-4 text-xs opacity-80">
                    Ensure these are set in your Easypanel "Environment" AND "Build" tabs, or in .env.local for local dev.
                </p>
            </div>
        </div>
    );
}
