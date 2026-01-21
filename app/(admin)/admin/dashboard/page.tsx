export default function DashboardPage() {
    return (
        <div className="p-8 space-y-8">
            <h2 className="text-3xl font-heading font-bold text-foreground">Dashboard</h2>

            {/* Example Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Total Leads</h3>
                    <p className="text-4xl font-bold text-primary mt-2">124</p>
                    <p className="text-xs text-emerald-500 mt-1">↑ 12% vs mes anterior</p>
                </div>
                <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Generaciones de Smile</h3>
                    <p className="text-4xl font-bold text-primary mt-2">86</p>
                    <p className="text-xs text-muted-foreground mt-1">69% de conversión</p>
                </div>
                <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">Solicitudes de Video</h3>
                    <p className="text-4xl font-bold text-primary mt-2">18</p>
                    <p className="text-xs text-amber-500 mt-1">Requiere aprobación</p>
                </div>
            </div>

            {/* Recent Activity Placeholder */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border">
                    <h3 className="font-bold">Actividad Reciente</h3>
                </div>
                <div className="p-6 text-center text-muted-foreground text-sm">
                    <p>Conectando con Supabase para mostrar datos en tiempo real...</p>
                </div>
            </div>
        </div>
    );
}
