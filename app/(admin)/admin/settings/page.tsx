import EmbedConfigurator from "@/components/admin/embed/EmbedConfigurator";

export default function SettingsPage() {
    return (
        <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-heading font-bold text-foreground">Configuración</h2>
                <div className="flex items-center gap-3">
                    <EmbedConfigurator />
                </div>
            </div>
        </div>
    );
}

