"use client";

import { useState } from "react";
import { Check, Copy, ChevronLeft, Layout, MousePointerClick, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

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
            <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0 overflow-hidden bg-background">
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
            <div className="p-6 border-b bg-background">
                <DialogTitle className="text-2xl font-semibold">¿Cómo quieres añadir el widget a tu sitio?</DialogTitle>
                <p className="text-muted-foreground mt-2">Elige una de las siguientes maneras de integración.</p>
            </div>

            <div className="flex-1 p-8 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto">
                <SelectionCard
                    title="Incrustar en línea"
                    desc="Carga el widget directamente en el contenido de tu página."
                    icon={<Layout className="w-10 h-10 text-muted-foreground/50 group-hover:text-primary transition-colors" />}
                    onClick={() => onSelect('inline')}
                    illustration={<div className="w-full h-32 bg-muted/20 border-2 border-dashed border-muted rounded-lg m-4 flex items-center justify-center"><div className="w-20 h-20 bg-primary/10 rounded pt-2 pl-2"><div className="w-12 h-2 bg-primary/20 rounded mb-2"></div><div className="w-8 h-2 bg-primary/20 rounded"></div></div></div>}
                />
                <SelectionCard
                    title="Botón flotante"
                    desc="Un botón fijo en la esquina de tu sitio que abre el widget en un modal."
                    icon={<MessageSquare className="w-10 h-10 text-muted-foreground/50 group-hover:text-primary transition-colors" />}
                    onClick={() => onSelect('floating')}
                    illustration={<div className="w-full h-32 bg-muted/20 border border-muted rounded-lg m-4 relative"><div className="absolute bottom-2 right-2 w-8 h-8 bg-primary rounded-full shadow-lg"></div></div>}

                />
                <SelectionCard
                    title="Click en elemento"
                    desc="Abre el widget cuando el usuario hace clic en un elemento existente (botón, link)."
                    icon={<MousePointerClick className="w-10 h-10 text-muted-foreground/50 group-hover:text-primary transition-colors" />}
                    onClick={() => onSelect('click')}
                    illustration={<div className="w-full h-32 bg-muted/20 border border-muted rounded-lg m-4 flex items-center justify-center"><div className="px-4 py-1 bg-muted border border-muted-foreground/30 rounded cursor-pointer">Click me</div></div>}
                />
            </div>
        </div>
    );
}

function SelectionCard({ title, desc, icon, onClick, illustration }: any) {
    return (
        <Card className="cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all group" onClick={onClick}>
            <CardContent className="p-0 flex flex-col h-full">
                <div className="h-40 bg-muted/10 border-b flex items-center justify-center p-4">
                    {illustration}
                </div>
                <div className="p-6 space-y-2 flex-1">
                    <h3 className="font-bold text-lg">{title}</h3>
                    <p className="text-sm text-muted-foreground text-balance">{desc}</p>
                </div>
            </CardContent>
        </Card>
    )
}

function EmbedSettings({ type, onBack }: { type: EmbedType, onBack: () => void }) {
    const [theme, setTheme] = useState("auto");
    const [brandColor, setBrandColor] = useState("#2A9D8F");

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
            <div className="border-b p-4 flex items-center gap-4 bg-background">
                <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-1" /> Volver</Button>
                <h2 className="font-bold text-lg">{titles[type!]}</h2>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Controls */}
                <div className="w-1/3 border-r bg-muted/10 p-6 space-y-8 overflow-y-auto">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Color de la marca</Label>
                            <div className="flex gap-2">
                                <div className="w-10 h-10 rounded border" style={{ backgroundColor: brandColor }} />
                                <Input value={brandColor} onChange={e => setBrandColor(e.target.value)} className="font-mono uppercase" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Tema</Label>
                            <Select value={theme} onValueChange={setTheme}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Automático (Sistema)</SelectItem>
                                    <SelectItem value="light">Claro</SelectItem>
                                    <SelectItem value="dark">Oscuro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {type === 'floating' && (
                        <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-200">
                            <p>El botón flotante aparecerá automáticamente en todas las páginas donde instales el código.</p>
                        </div>
                    )}
                </div>

                {/* Preview / Code Area */}
                <div className="flex-1 p-6 bg-background flex flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Código de Incrustación</h3>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>HTML</span>
                            <span>React</span>
                        </div>
                    </div>

                    <div className="relative flex-1 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner group">
                        <pre className="p-6 text-xs md:text-sm font-mono text-slate-300 whitespace-pre-wrap overflow-y-auto h-full">
                            {code}
                        </pre>
                        <Button
                            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all"
                            size="sm"
                            onClick={handleCopy}
                        >
                            <Copy className="w-4 h-4 mr-2" /> Copiar Código
                        </Button>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-4 border border-dashed flex items-center justify-center h-32 text-muted-foreground text-sm">
                        Vista previa visual no disponible en el configurador
                    </div>
                </div>
            </div>
        </div>
    );
}
