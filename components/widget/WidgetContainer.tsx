"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { Loader2, UploadCloud, Lock, CheckCircle2, Video, PlayCircle, Sparkles, ScanFace, FileSearch, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { validateImageStrict, analyzeImageAndGeneratePrompts, generateSmileVariation } from "@/app/services/gemini";
import { uploadScan } from "@/app/services/storage";
import { VariationType } from "@/types/gemini";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

// Combined step for auto-flow
type Step = "UPLOAD" | "PROCESSING" | "LOCKED_RESULT" | "LEAD_FORM" | "RESULT";

// Status steps for the progress UI
type ProcessStatus = 'validating' | 'scanning' | 'analyzing' | 'designing' | 'complete';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export default function WidgetContainer() {
    const [step, setStep] = useState<Step>("UPLOAD");
    const [image, setImage] = useState<File | null>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
    const [userId, setUserId] = useState<string>("anon");

    // Process Status State
    const [processStatus, setProcessStatus] = useState<ProcessStatus>('validating');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Scanning Animation Variants
    const scanVariants = {
        initial: { top: "0%" },
        animate: {
            top: "100%",
            transition: {
                repeat: Infinity,
                repeatType: "mirror" as const,
                duration: 1.5,
                ease: "linear" as const
            }
        }
    };

    // Image Compression
    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    const MAX_WIDTH = 1500;
                    const MAX_HEIGHT = 1500;
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                    } else {
                        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL("image/jpeg", 0.8));
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    };

    const handleUpload = async (file: File) => {
        setImage(file);
        setStep("PROCESSING");
        setProcessStatus('validating');

        try {
            const base64 = await compressImage(file);

            // 1. Strict Validation
            const validationResponse = await validateImageStrict(base64);
            if (!validationResponse.success) {
                throw new Error(validationResponse.error || "Error de validación");
            }
            if (!validationResponse.data?.isValid) {
                throw new Error(validationResponse.data?.reason || "Imagen no válida");
            }
            setProcessStatus('scanning');

            // 2. Upload to Storage
            const compressedBlob = await (await fetch(base64)).blob();
            const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
            const formData = new FormData();
            formData.append('file', compressedFile);

            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            const currentUserId = user?.id || 'anon_' + crypto.randomUUID();
            setUserId(currentUserId);
            formData.append('userId', currentUserId);

            await uploadScan(formData); // Non-blocking fail-safe
            setProcessStatus('analyzing');

            // 3. Analyze Image
            const analysisResponse = await analyzeImageAndGeneratePrompts(base64);
            if (!analysisResponse.success) throw new Error(analysisResponse.error || "Error analizando imagen");

            const analysisResult = analysisResponse.data;
            if (!analysisResult) throw new Error("No se pudo obtener el análisis.");

            setProcessStatus('designing');

            // 4. Auto-Generate Smile
            const naturalVariation = analysisResult.variations.find((v: any) => v.type === VariationType.ORIGINAL_BG);
            if (!naturalVariation) throw new Error("No se encontró plan de restauración natural.");

            const prompt = `
                Perform a ${naturalVariation.prompt_data.Composition} of ${naturalVariation.prompt_data.Subject} ${naturalVariation.prompt_data.Action} in a ${naturalVariation.prompt_data.Location}.
                Style: ${naturalVariation.prompt_data.Style}. 
                IMPORTANT INSTRUCTIONS: ${naturalVariation.prompt_data.Editing_Instructions}.
                ${naturalVariation.prompt_data.Refining_Details || ''}
            `;

            const imageUrl = await generateSmileVariation(base64, prompt, "9:16", currentUserId);

            setGeneratedImage(imageUrl);
            setProcessStatus('complete');

            // Allow a brief moment for the 'complete' state to show before transitioning
            await new Promise(r => setTimeout(r, 800));
            setStep("LOCKED_RESULT");

        } catch (err: any) {
            console.error("WidgetContainer Error:", err);
            toast.error(err.message || "Ocurrió un error.");
            setStep("UPLOAD");
            setImage(null);
        }
    };

    const handleLeadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const data = Object.fromEntries(formData);
        try {
            const supabase = createClient();
            const { error } = await supabase.from('leads').insert({
                name: data.name,
                email: data.email,
                phone: data.phone,
                // survey_data could be enriched here if we kept analysisResult in state, 
                // but for MVP flow simplicity we might skip or store minimalist data
                status: 'pending'
            });
            if (error) throw error;
            toast.success("¡Información enviada con éxito!");
            setStep("RESULT");
        } catch (err) {
            toast.error("Error guardando datos. Intenta de nuevo.");
        }
    };

    const handleVideoRequest = () => {
        setIsVideoDialogOpen(false);
        toast.info("Solicitud enviada.", { description: "Te contactaremos pronto." });
    };

    // Status List Component
    const StatusItem = ({ active, completed, label, icon: Icon }: any) => (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${active ? 'bg-primary/10 border-primary/20' : 'bg-transparent border-transparent'} ${completed ? 'text-muted-foreground' : 'text-foreground'}`}
        >
            <div className={`p-2 rounded-full ${completed ? 'bg-green-500/20 text-green-500' : active ? 'bg-primary/20 text-primary animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                {completed ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            </div>
            <span className={`text-sm font-medium ${active ? 'font-bold' : ''}`}>{label}</span>
            {active && <Loader2 className="w-3 h-3 ml-auto animate-spin text-primary" />}
        </motion.div>
    );

    return (
        <div className="relative h-[calc(100vh-100px)] min-h-[500px] w-full bg-card text-card-foreground flex flex-col font-sans overflow-hidden rounded-xl border-0 md:border shadow-sm">
            {/* Header */}
            <div className="flex-none p-4 border-b flex justify-between items-center bg-muted/20 backdrop-blur-sm z-20">
                <h1 className="text-lg font-heading font-bold text-primary tracking-tight">Smile AI</h1>
                <div className="flex items-center gap-2 px-2 py-1 bg-background/50 rounded-full border shadow-sm">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono font-bold">ONLINE</span>
                </div>
            </div>

            {/* Main Content Area - Scrollable if needed but mostly constrained */}
            <main className="flex-1 relative overflow-y-auto overflow-x-hidden p-4 md:p-6 scrollbar-hide">
                <AnimatePresence mode="wait">
                    {/* UPLOAD STEP */}
                    {step === "UPLOAD" && (
                        <motion.div
                            key="upload"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="h-full flex flex-col justify-center items-center text-center space-y-6"
                        >
                            <div
                                className="group relative w-full aspect-[4/3] max-w-xs md:max-w-sm border-2 border-dashed border-input rounded-2xl hover:border-primary/50 hover:bg-secondary/30 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-background/50"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="p-4 bg-background shadow-lg rounded-full mb-4 group-hover:scale-110 transition-transform duration-500 border border-primary/10">
                                    <UploadCloud className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground">Sube tu Selfie</h3>
                                <p className="text-xs text-muted-foreground px-6 mt-1">Arrastra o haz clic</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                                />
                            </div>
                            <div className="flex gap-4 text-[10px] text-muted-foreground bg-muted/30 px-4 py-2 rounded-full border border-border/50">
                                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Privado</span>
                                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Rápido</span>
                                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> IA Avanzada</span>
                            </div>
                        </motion.div>
                    )}

                    {/* PROCESSING (Unified Automation Step) */}
                    {step === "PROCESSING" && (
                        <motion.div
                            key="processing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-full flex flex-col md:flex-row gap-6 items-center md:items-start justify-center p-2"
                        >
                            {/* Left: Visual Scanner */}
                            <div className="relative w-full max-w-[280px] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border border-primary/20 bg-black flex-shrink-0">
                                {image ? (
                                    <img src={URL.createObjectURL(image)} alt="Analyzing" className="w-full h-full object-cover opacity-60" />
                                ) : (
                                    <div className="w-full h-full bg-muted" />
                                )}
                                <motion.div
                                    variants={scanVariants}
                                    initial="initial"
                                    animate="animate"
                                    className="absolute left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_20px_4px_rgba(34,211,238,0.6)] z-10"
                                />
                                <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
                                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-mono text-cyan-200">REC_MODE: ON</span>
                                </div>
                            </div>

                            {/* Right: Progress List */}
                            <div className="w-full max-w-xs space-y-2 pt-4">
                                <h3 className="text-xl font-heading font-bold mb-4">Procesando...</h3>
                                <StatusItem
                                    label="Validación Biométrica"
                                    icon={ScanFace}
                                    active={processStatus === 'validating'}
                                    completed={['scanning', 'analyzing', 'designing', 'complete'].includes(processStatus)}
                                />
                                <StatusItem
                                    label="Escaneo Facial 3D"
                                    icon={FileSearch}
                                    active={processStatus === 'scanning'}
                                    completed={['analyzing', 'designing', 'complete'].includes(processStatus)}
                                />
                                <StatusItem
                                    label="Análisis Morfológico"
                                    icon={Sparkles}
                                    active={processStatus === 'analyzing'}
                                    completed={['designing', 'complete'].includes(processStatus)}
                                />
                                <StatusItem
                                    label="Diseño Generativo"
                                    icon={Wand2}
                                    active={processStatus === 'designing'}
                                    completed={['complete'].includes(processStatus)}
                                />
                            </div>
                        </motion.div>
                    )}

                    {/* LOCKED RESULT */}
                    {step === "LOCKED_RESULT" && (
                        <motion.div
                            key="locked"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="h-full flex flex-col items-center justify-center space-y-6"
                        >
                            <div className="relative w-full max-w-[280px] aspect-[9/16] bg-muted rounded-2xl overflow-hidden border border-border/50 shadow-2xl group">
                                {generatedImage ? (
                                    <>
                                        <img src={generatedImage} alt="Generated" className="w-full h-full object-cover blur-md scale-105 saturate-150 opacity-90 transition-all duration-700" />
                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                                    </>
                                ) : null}
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
                                    <div className="p-4 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                                        <Lock className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-2xl drop-shadow-lg">¡Listo!</h3>
                                        <p className="text-sm text-white/80 font-medium mt-1">Tu nueva sonrisa está generada.</p>
                                    </div>
                                </div>
                            </div>
                            <Button
                                onClick={() => setStep("LEAD_FORM")}
                                className="w-full max-w-xs text-lg h-12 font-bold rounded-xl shadow-lg animate-bounce-subtle"
                                size="lg"
                            >
                                Desbloquear Ahora
                            </Button>
                        </motion.div>
                    )}

                    {/* LEAD FORM */}
                    {step === "LEAD_FORM" && (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="h-full flex flex-col items-center justify-center"
                        >
                            <div className="w-full max-w-sm space-y-6">
                                <div className="text-center space-y-1">
                                    <h2 className="text-2xl font-heading font-bold">Último Paso</h2>
                                    <p className="text-sm text-muted-foreground">Ingresa tus datos para ver el resultado.</p>
                                </div>
                                <form className="space-y-4" onSubmit={handleLeadSubmit}>
                                    <div className="grid gap-4">
                                        <Input id="name" name="name" placeholder="Nombre completo" required className="h-11" />
                                        <Input id="email" name="email" type="email" placeholder="Correo electrónico" required className="h-11" />
                                        <Input id="phone" name="phone" type="tel" placeholder="Teléfono" required className="h-11" />
                                    </div>
                                    <div className="flex items-start space-x-3">
                                        <Checkbox id="terms" required className="mt-1" />
                                        <Label htmlFor="terms" className="text-xs text-muted-foreground font-normal">
                                            Acepto la política de privacidad y el uso de mi imagen.
                                        </Label>
                                    </div>
                                    <Button type="submit" className="w-full h-12 text-base font-bold rounded-xl shadow-md">
                                        Ver Resultado
                                    </Button>
                                </form>
                            </div>
                        </motion.div>
                    )}

                    {/* RESULT */}
                    {step === "RESULT" && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="h-full flex flex-col items-center gap-4"
                        >
                            <div className="relative w-full max-w-[320px] md:max-w-md aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border border-primary/20 bg-black">
                                {generatedImage && image ? (
                                    <BeforeAfterSlider
                                        beforeImage={URL.createObjectURL(image)}
                                        afterImage={generatedImage}
                                        className="h-full w-full"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full text-destructive">Error</div>
                                )}
                                <div className="absolute bottom-4 right-4 z-20 pointer-events-none">
                                    <span className="bg-white/90 text-primary px-3 py-1 rounded-full text-[10px] font-bold shadow-sm backdrop-blur">
                                        AI GENERATED
                                    </span>
                                </div>
                            </div>

                            <div className="w-full max-w-md flex gap-2">
                                <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="flex-1 gap-2 border-primary/20 hover:bg-primary/5">
                                            <Video className="w-4 h-4 text-primary" /> Generar Video
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Video Generativo (Beta)</DialogTitle>
                                            <DialogDescription>Crea un video hablando con tu nueva sonrisa.</DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4 text-center text-sm text-muted-foreground">Próximamente disponible.</div>
                                        <DialogFooter><Button onClick={handleVideoRequest}>Notificarme</Button></DialogFooter>
                                    </DialogContent>
                                </Dialog>
                                <Button className="flex-1 gap-2 font-bold" onClick={() => window.location.reload()}>
                                    <Sparkles className="w-4 h-4" /> Probar Otra vez
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
