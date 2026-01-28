"use client";

import Link from "next/link";
import { LayoutDashboard, Users, Settings, LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast.error("Error al cerrar sesión");
        } else {
            router.push("/login");
            router.refresh();
        }
    };

    return (
        <div className="min-h-screen bg-muted/20 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-card border-r border-border flex flex-col">
                <div className="p-6 border-b border-border">
                    <h1 className="font-heading text-xl font-bold text-primary">Smile Forward</h1>
                    <p className="text-xs text-muted-foreground">Admin Console</p>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <Link href="/admin/dashboard" className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 text-foreground transition-colors">
                        <LayoutDashboard size={20} strokeWidth={1.5} />
                        <span>Dashboard</span>
                    </Link>
                    <Link href="/admin/leads" className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 text-foreground transition-colors">
                        <Users size={20} strokeWidth={1.5} />
                        <span>Leads</span>
                    </Link>
                    <Link href="/admin/settings" className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 text-foreground transition-colors">
                        <Settings size={20} strokeWidth={1.5} />
                        <span>Configuración</span>
                    </Link>
                </nav>

                <div className="p-4 border-t border-border">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-destructive/10 text-destructive w-full transition-colors font-medium"
                    >
                        <LogOut size={20} strokeWidth={1.5} />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
