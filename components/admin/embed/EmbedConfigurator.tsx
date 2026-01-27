"use client";

import { useState } from "react";
import { Check, Copy, ChevronLeft, Layout, MousePointerClick, MessageSquare, ExternalLink, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type EmbedType = "inline" | "floating" | "click" | null;

export default function EmbedConfigurator() {
    const [isOpen, setIsOpen] = useState(false);
    const [embedType, setEmbedType] = useState<EmbedType>(null);

    const reset = () => {
        setEmbedType(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) reset(); }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-primary/20 text-primary hover:bg-primary/5">
                    <Layout className="w-4 h-4" />
                    Insertar Widget
                </Button>
            </DialogTrigger>
            <DialogContent className="!max-w-[95vw] w-full h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
                {!embedType ? (
                    <EmbedSelection onSelect={setEmbedType} />
                ) : (
                    <EmbedSettings type={embedType} onBack={reset} />
                )}
            </DialogContent>
        </Dialog>
    );
}

function EmbedSelection({ onSelect }: { onSelect: (t: EmbedType) => void }) {
    return (
        <div className="flex flex-col h-full bg-muted/10">
            <div className="p-8 border-b bg-background">
                <DialogTitle className="text-3xl font-heading font-bold text-foreground">¿Cómo quieres añadir el widget?</DialogTitle>
                <p className="text-lg text-muted-foreground mt-2">Elige el formato de integración que mejor se adapte a tu sitio web.</p>
            </div>

            <div className="flex-1 p-10 grid grid-cols-1 md:grid-cols-3 gap-8 overflow-y-auto items-center justify-center max-w-7xl mx-auto w-full">
                <SelectionCard
                    title="Incrustar en línea"
                    desc="Carga el widget directamente dentro del contenido de tu página. Ideal para landing pages dedicadas."
                    onClick={() => onSelect('inline')}
                    illustration={
                        <div className="w-full h-48 bg-background border rounded-lg shadow-sm flex flex-col overflow-hidden relative">
                            <div className="h-4 bg-muted border-b flex items-center px-2 gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-200"></div>
                                <div className="w-2 h-2 rounded-full bg-yellow-200"></div>
                                <div className="w-2 h-2 rounded-full bg-green-200"></div>
                            </div>
                            <div className="p-4 space-y-2">
                                <div className="w-3/4 h-2 bg-muted rounded"></div>
                                <div className="w-1/2 h-2 bg-muted rounded"></div>
                                <div className="mt-4 border-2 border-dashed border-primary/20 bg-primary/5 rounded-lg h-20 flex items-center justify-center">
                                    <div className="w-8 h-8 rounded bg-primary/20"></div>
                                </div>
                            </div>
                        </div>
                    }
                />
                <SelectionCard
                    title="Botón flotante"
                    desc="Un botón discreto que sigue al usuario. Al hacer clic, abre el widget en un modal elegante."
                    onClick={() => onSelect('floating')}
                    illustration={
                        <div className="w-full h-48 bg-background border rounded-lg shadow-sm flex flex-col overflow-hidden relative">
                            <div className="h-4 bg-muted border-b flex items-center px-2 gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-200"></div>
                                <div className="w-2 h-2 rounded-full bg-yellow-200"></div>
                            </div>
                            <div className="p-4 space-y-2">
                                <div className="w-full h-2 bg-muted rounded"></div>
                                <div className="w-full h-2 bg-muted rounded"></div>
                                <div className="w-2/3 h-2 bg-muted rounded"></div>
                            </div>
                            <div className="absolute bottom-4 right-4 w-10 h-10 bg-black rounded-full shadow-lg flex items-center justify-center text-white">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                        </div>
                    }

                />
                <SelectionCard
                    title="Click en elemento"
                    desc="Vincula el widget a cualquier botón o enlace existente en tu sitio mediante un atributo data."
                    onClick={() => onSelect('click')}
                    illustration={
                        <div className="w-full h-48 bg-background border rounded-lg shadow-sm flex flex-col overflow-hidden relative items-center justify-center">
                            <div className="px-6 py-2 bg-black text-white rounded-lg shadow-md cursor-pointer hover:scale-105 transition-transform">
                                Analizar Sonrisa
                            </div>
                            <div className="absolute mt-12 ml-12">
                                <MousePointerClick className="w-6 h-6 text-primary fill-primary/20" />
                            </div>
                        </div>
                    }
                />
            </div>
        </div>
    );
}

function SelectionCard({ title, desc, onClick, illustration }: any) {
    return (
        <Card className="cursor-pointer hover:border-primary/50 hover:shadow-xl transition-all group h-full border-2 hover:-translate-y-1 duration-300" onClick={onClick}>
            <CardContent className="p-0 flex flex-col h-full">
                <div className="h-56 bg-muted/30 border-b flex items-center justify-center p-6 group-hover:bg-primary/5 transition-colors">
                    <div className="w-full max-w-[240px] shadow-lg rounded-lg overflow-hidden transition-transform group-hover:scale-105 duration-500">
                        {illustration}
                    </div>
                </div>
                <div className="p-6 space-y-3 flex-1 flex flex-col justify-center text-center">
                    <h3 className="font-heading font-bold text-xl">{title}</h3>
                    <p className="text-muted-foreground text-balance leading-relaxed">{desc}</p>
                </div>
            </CardContent>
        </Card>
    )
}

function EmbedSettings({ type, onBack }: { type: EmbedType, onBack: () => void }) {
    const [theme, setTheme] = useState("auto");
    const [brandColor, setBrandColor] = useState("#2A9D8F");
    const [activeTab, setActiveTab] = useState("preview"); // preview | code

    // Type specific titles
    const titles = {
        inline: "Incrustar en línea",
        floating: "Botón emergente flotante",
        click: "Incrustar mediante clic"
    };

    const generateCode = () => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://smile-forward.app';

        if (type === 'inline') {
            return `<div style="width:100%;height:600px;overflow:hidden;">
  <iframe 
    src="${baseUrl}/widget?theme=${theme}&color=${encodeURIComponent(brandColor)}" 
    width="100%" 
    height="100%" 
    frameborder="0"
  ></iframe>
</div>`;
        }

        if (type === 'floating') {
            return `<!-- Smile Forward Floating Button -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['SmileWidget']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','sf','${baseUrl}/embed.js'));

  sf('init', {
    type: 'floating',
    theme: '${theme}',
    brandColor: '${brandColor}',
    position: 'bottom-right'
  });
</script>`;
        }

        return `<!-- Smile Forward Element Click -->
<script src="${baseUrl}/embed.js" async></script>
<!-- Add button with data-sf-trigger attribute -->
<button data-sf-trigger>Analizar mi Sonrisa</button>

<script>
  window.addEventListener('load', function() {
    if(window.sf) window.sf('init', {
      type: 'modal',
      theme: '${theme}',
      brandColor: '${brandColor}'
    });
  });
</script>`;
    };

    const code = generateCode();

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        toast.success("Código copiado al portapapeles");
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b px-6 py-4 flex items-center justify-between bg-background z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-muted-foreground hover:text-foreground"><ChevronLeft className="w-5 h-5 mr-1" /> Volver</Button>
                    <div className="h-6 w-px bg-border mx-2" />
                    <h2 className="font-heading font-bold text-xl">{titles[type!]}</h2>
                </div>

                <div className="flex items-center gap-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[200px]">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="preview">Vista Previa</TabsTrigger>
                            <TabsTrigger value="code">Código</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Controls */}
                <div className="w-[350px] border-r bg-muted/10 p-6 space-y-8 overflow-y-auto">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label className="text-base font-semibold">Color de la marca</Label>
                            <p className="text-xs text-muted-foreground">Personaliza el color principal para que coincida con tu marca.</p>
                            <div className="flex gap-3 items-center p-3 border rounded-lg bg-background">
                                <div className="w-10 h-10 rounded-full border shadow-sm" style={{ backgroundColor: brandColor }} />
                                <Input value={brandColor} onChange={e => setBrandColor(e.target.value)} className="font-mono uppercase flex-1 border-0 focus-visible:ring-0 px-0 h-auto" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-base font-semibold">Tema</Label>
                            <p className="text-xs text-muted-foreground">Elige si el widget se mostrará en modo claro u oscuro.</p>
                            <Select value={theme} onValueChange={setTheme}>
                                <SelectTrigger className="bg-background h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Automático (Segun sistema)</SelectItem>
                                    <SelectItem value="light">Claro (Light)</SelectItem>
                                    <SelectItem value="dark">Oscuro (Dark)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {type === 'floating' && (
                        <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-200 flex gap-3">
                            <MessageSquare className="w-5 h-5 shrink-0 mt-0.5" />
                            <p className="leading-snug">El botón flotante está diseñado para ser discreto y aparecerá en la esquina inferior derecha por defecto.</p>
                        </div>
                    )}
                </div>

                {/* Main Content Area (Preview or Code) */}
                <div className="flex-1 bg-muted/5 relative overflow-hidden flex flex-col">

                    {/* VISUAL PREVIEW AREA */}
                    <div className={`flex-1 overflow-y-auto p-8 flex items-center justify-center transition-opacity duration-300 ${activeTab === 'preview' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
                        <VisualPreview type={type} brandColor={brandColor} theme={theme} />
                    </div>

                    {/* CODE AREA */}
                    <div className={`flex-1 overflow-hidden flex flex-col p-8 transition-opacity duration-300 ${activeTab === 'code' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <Label>Copiar y pegar este código</Label>
                            <Button onClick={handleCopy} size="sm" className="gap-2">
                                <Copy className="w-4 h-4" /> Copiar
                            </Button>
                        </div>
                        <div className="flex-1 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative">
                            <pre className="p-6 text-sm font-mono text-slate-300 whitespace-pre-wrap overflow-y-auto h-full leading-relaxed">
                                {code}
                            </pre>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

// Mocks the visual appearance of the widget based on type
function VisualPreview({ type, brandColor, theme }: { type: EmbedType, brandColor: string, theme: string }) {

    // Helper to determine text color based on theme
    const isDark = theme === 'dark'; // Simplified logic, 'auto' assumes light for preview
    const bgColor = isDark ? '#1a1a1a' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const borderColor = isDark ? '#333333' : '#e5e7eb';

    // Common Widget Mock Component
    const MockWidget = ({ className }: { className?: string }) => (
        <div className={`w-[380px] bg-[${bgColor}] rounded-xl overflow-hidden shadow-2xl border border-[${borderColor}] flex flex-col font-sans relative ${className} transition-all duration-300`} style={{ borderColor }}>
            {/* Header */}
            <div className="h-14 border-b flex items-center justify-center relative bg-muted/20" style={{ borderColor }}>
                <div className="w-8 h-8 rounded-full opacity-20 mr-2" style={{ backgroundColor: brandColor }}></div>
                <span className="font-bold" style={{ color: textColor }}>Smile Forward</span>
            </div>
            {/* Body */}
            <div className="p-8 flex flex-col items-center flex-1 space-y-6 bg-background" style={{ backgroundColor: bgColor }}>
                <div className="w-full h-48 border-2 border-dashed rounded-xl flex items-center justify-center bg-muted/10 relative group cursor-default" style={{ borderColor: brandColor }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}20` }}>
                        <Layout className="w-6 h-6" style={{ color: brandColor }} />
                    </div>
                </div>
                <div className="w-full space-y-3">
                    <div className="h-10 w-full rounded-lg" style={{ backgroundColor: brandColor }}></div>
                    <div className="h-3 w-2/3 bg-muted mx-auto rounded"></div>
                </div>
            </div>
        </div>
    );

    if (type === 'inline') {
        return (
            <div className="w-full max-w-2xl bg-white shadow-sm border p-8 rounded-xl flex flex-col gap-6">
                <div className="space-y-2">
                    <div className="h-8 w-1/3 bg-slate-100 rounded"></div>
                    <div className="h-4 w-2/3 bg-slate-50 rounded"></div>
                    <div className="h-4 w-1/2 bg-slate-50 rounded"></div>
                </div>
                <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50 flex justify-center">
                    <MockWidget />
                </div>
            </div>
        )
    }

    if (type === 'floating') {
        return (
            <div className="w-full h-full border border-dashed border-slate-300 rounded-xl relative bg-slate-50 overflow-hidden flex flex-col">
                {/* Mock Page Content */}
                <div className="p-8 space-y-8 opacity-40 blur-[1px]">
                    <div className="h-64 bg-slate-200 rounded-xl"></div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="h-32 bg-slate-200 rounded-xl"></div>
                        <div className="h-32 bg-slate-200 rounded-xl"></div>
                        <div className="h-32 bg-slate-200 rounded-xl"></div>
                    </div>
                </div>

                {/* The Floating Button Preview */}
                <div className="absolute bottom-8 right-8">
                    <div
                        className="h-14 px-6 rounded-full shadow-xl flex items-center gap-3 cursor-default hover:scale-105 transition-transform"
                        style={{ backgroundColor: brandColor }}
                    >
                        <MessageSquare className="w-6 h-6 text-white" />
                        <span className="font-bold text-white">Reservar</span>
                    </div>
                </div>

                {/* Tooltip explaining visual */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="bg-black/75 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">Vista previa de posicionamiento</span>
                </div>
            </div>
        )
    }

    if (type === 'click') {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-8">
                <div className="text-center space-y-2">
                    <h3 className="text-lg font-bold">Elemento disparador</h3>
                    <p className="text-sm text-muted-foreground">Prueba visual (No funcional en el editor)</p>
                </div>

                <button
                    className="px-8 py-4 rounded-lg font-bold text-white shadow-lg transform hover:scale-105 transition-all text-lg"
                    style={{ backgroundColor: brandColor }}
                >
                    Analizar mi Sonrisa
                </button>

                <div className="p-4 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded max-w-sm text-sm text-center">
                    Al hacer clic en este botón en tu web real, se abrirá el modal del widget.
                </div>
            </div>
        )
    }

    return null;
}
