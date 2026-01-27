"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LeadDetailModal } from "@/components/admin/LeadDetailModal";

export default function LeadsPage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLead, setSelectedLead] = useState<any | null>(null);

    const fetchLeads = useCallback(async () => {
        try {
            const supabase = createClient();

            const { data, error } = await supabase
                .from('leads')
                .select('*, generations(*)') // Fetch linked generations
                .order('created_at', { ascending: false });

            if (error) {
                toast.error(`Error cargando leads: ${error.message}`);
                throw error;
            }
            setLeads(data || []);
        } catch (err: any) {
            console.error("Leads Fetch Error:", err);
            toast.error("No se pudieron cargar los leads. Revisa la consola.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    const statusLabels: Record<string, string> = {
        pending: "Pendiente",
        contacted: "Contactado",
        converted: "Convertido",
        rejected: "Rechazado"
    };

    return (
        <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-heading font-bold text-foreground">Gestión de Leads</h2>
                <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">
                    Exportar CSV
                </button>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center text-muted-foreground">
                        <Loader2 className="animate-spin mr-2" /> Cargando datos...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-secondary/20 border-b border-border">
                                <tr>
                                    <th className="px-6 py-3">Fecha</th>
                                    <th className="px-6 py-3">Nombre</th>
                                    <th className="px-6 py-3">Email</th>
                                    <th className="px-6 py-3">Teléfono</th>
                                    <th className="px-6 py-3">Estado</th>
                                    <th className="px-6 py-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leads.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-muted-foreground">No hay leads registrados aún.</td>
                                    </tr>
                                ) : (
                                    leads.map((lead) => (
                                        <tr key={lead.id} className="bg-card border-b border-border hover:bg-muted/10 transition-colors">
                                            <td className="px-6 py-4">{new Date(lead.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 font-medium text-foreground">{lead.name}</td>
                                            <td className="px-6 py-4">{lead.email}</td>
                                            <td className="px-6 py-4">{lead.phone}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${lead.status === 'converted' ? 'bg-green-100 text-green-700' :
                                                        lead.status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {statusLabels[lead.status] || lead.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => setSelectedLead(lead)}
                                                    className="text-primary hover:underline font-medium"
                                                >
                                                    Ver Detalle
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <LeadDetailModal
                lead={selectedLead}
                open={!!selectedLead}
                onOpenChange={(open) => !open && setSelectedLead(null)}
                onLeadUpdated={() => {
                    fetchLeads(); // Refresh table when status changes
                    // No direct state mutation needed as fetchLeads handles it
                }}
            />
        </div>
    );
}
