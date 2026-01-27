"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkServerHealth } from "@/app/actions/health";
import { toast } from "sonner";

export function DebugBanner() {
    const [isLoading, setIsLoading] = useState(false);
    const [healthStatus, setHealthStatus] = useState<null | { status: string, timestamp: string, envCheck: any }>(null);

    const checks = [
        {
            name: "API_KEY (Gemini/Google)",
            value: process.env.API_KEY || "AIza...", // Masked in client usually, but checks simple presence if leaked to client bundle (bad) or checks via server action
            isSecret: true,
        },
        {
            name: "NEXT_PUBLIC_SUPABASE_URL",
            value: process.env.NEXT_PUBLIC_SUPABASE_URL,
            isSecret: false,
        },
    ];

    const runDiagnostics = async () => {
        setIsLoading(true);
        try {
            const result = await checkServerHealth();
            setHealthStatus(result);
            if (result.status === 'ok') {
                toast.success("Server Connectivity: OK");
            } else {
                toast.error("Server Health Check Failed");
            }
        } catch (error: any) {
            console.error("Health Check Failed:", error);
            toast.error(`Connectivity Error: ${error.message}`);
            setHealthStatus({ status: 'error', timestamp: new Date().toISOString(), envCheck: {} });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-zinc-900 border-b border-zinc-700 text-zinc-300 font-mono text-xs p-2">
            <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-yellow-500 font-bold">
                        <AlertTriangle className="w-4 h-4" />
                        <span>DEBUG MODE</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded">
                        <span className="opacity-75">Env Vars:</span>
                        {process.env.NEXT_PUBLIC_SUPABASE_URL ?
                            <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Loaded</span> :
                            <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Missing</span>
                        }
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-2 bg-blue-900/20 border-blue-800 text-blue-300 hover:bg-blue-900/40"
                        onClick={runDiagnostics}
                        disabled={isLoading}
                    >
                        {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                        {isLoading ? "Testing..." : "Test Server Health"}
                    </Button>
                </div>

                {healthStatus && (
                    <div className="flex items-center gap-4 animate-in fade-in">
                        <div className={`px-2 py-1 rounded ${healthStatus.status === 'ok' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                            Server: {healthStatus.status === 'ok' ? 'ONLINE' : 'ERROR'}
                        </div>
                        {healthStatus.envCheck && (
                            <div className="flex gap-2">
                                <span title="Server API Key Status">🔑 {healthStatus.envCheck.apiKey ? '✅' : '❌'}</span>
                                <span title="Server Supabase Status">⚡ {healthStatus.envCheck.supabaseUrl ? '✅' : '❌'}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
