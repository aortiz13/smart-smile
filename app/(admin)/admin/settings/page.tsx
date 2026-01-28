import EmbedConfigurator from "@/components/admin/embed/EmbedConfigurator";
import { DollarSign, AlertTriangle, Type } from "lucide-react";

export default function SettingsPage() {
    return (
        <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-heading font-bold text-foreground">Configuración</h2>
                <div className="flex items-center gap-3">
                    <EmbedConfigurator />
                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90">
                        Guardar Cambios
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Cost Control */}
                <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-primary" strokeWidth={1.5} /> Control de Costes (Video)
                    </h3>
                    <p className="text-sm text-muted-foreground">Activa o desactiva la funcionalidad de generación de video para controlar el gasto de API.</p>

                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                        <span className="font-medium">Habilitar Generación de Video</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" strokeWidth={1.5} /> Cada video generado cuesta aprox. $X USD.
                    </div>
                </div>

                {/* Text Configuration */}
                <div className="bg-card p-6 rounded-xl border border-border space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Type className="w-5 h-5 text-primary" strokeWidth={1.5} /> Textos del Widget
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium">Título Principal</label>
                            <input defaultValue="Smile Forward" className="w-full mt-1 p-2 border border-input rounded bg-background" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Subtítulo (Call to Action)</label>
                            <input defaultValue="Sube una foto de tu rostro para revelar tu nueva sonrisa." className="w-full mt-1 p-2 border border-input rounded bg-background" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Mensaje de Éxito</label>
                            <input defaultValue="¡Increíble! Hemos enviado una copia a tu correo." className="w-full mt-1 p-2 border border-input rounded bg-background" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
