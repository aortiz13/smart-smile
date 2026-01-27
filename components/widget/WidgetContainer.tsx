"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { Loader2, UploadCloud, Lock, CheckCircle2, Video, PlayCircle, Sparkles, ScanFace, FileSearch, Wand2, Share2 } from "lucide-react";
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
type Step = "UPLOAD" | "PROCESSING" | "LOCKED_RESULT" | "LEAD_FORM" | "RESULT" | "SURVEY" | "VERIFICATION";

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
    const [leadId, setLeadId] = useState<string | null>(null);

    // Process Status State
    const [processStatus, setProcessStatus] = useState<ProcessStatus>('validating');
    const [uploadedScanUrl, setUploadedScanUrl] = useState<string | null>(null);

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

            const uploadRes = await uploadScan(formData);
            if (uploadRes.success && uploadRes.data) {
                setUploadedScanUrl(uploadRes.data);
            } else {
                console.warn("Fallo subida de imagen original:", uploadRes.error);
            }

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
            const leadId = crypto.randomUUID(); // Client-side ID generation

            // 1. Insert Lead
            const { error: leadError } = await supabase.from('leads').insert({
                id: leadId,
                name: data.name,
                email: data.email,
                phone: data.phone,
                status: 'pending'
            });

            if (leadError) throw leadError;

            // 2. Insert Generation Record (Linked to Lead)
            if (generatedImage) {
                const { error: genError } = await supabase.from('generations').insert({
                    lead_id: leadId,
                    type: 'image',
                    status: 'completed',
                    input_path: uploadedScanUrl || 'unknown',
                    output_path: generatedImage,
                    metadata: { source: 'widget_v1' }
                });
                if (genError) console.error("Error saving generation:", genError);
            }

            toast.success("¡Información enviada con éxito!");
            setLeadId(leadId); // Persist ID for next step
            setStep("RESULT");
        } catch (err) {
            console.error(err);
            toast.error("Error guardando datos. Intenta de nuevo.");
        }
    };

    const handleVideoRequest = () => {
        setIsVideoDialogOpen(false);
        toast.info("Solicitud enviada.", { description: "Te contactaremos pronto." });
    };

    const handleSurveySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leadId) return;

        const formData = new FormData(e.target as HTMLFormElement);
        const surveyData = {
            ageRange: formData.get('ageRange'),
            improvementGoal: formData.get('improvementGoal'),
            timeframe: formData.get('timeframe'),
            clinicPreference: formData.get('clinicPreference')
        };

        try {
            const supabase = createClient();
            const { error } = await supabase
                .from('leads')
                .update({ survey_data: surveyData })
                .eq('id', leadId);

            if (error) throw error;

            toast.success("Gracias por tus respuestas");
            setStep("VERIFICATION");
        } catch (err) {
            console.error(err);
            toast.error("Error al guardar respuestas.");
        }
    };

    // Status List Component
    const StatusItem = ({ active, completed, label, icon: Icon }: any) => (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${active ? 'bg-primary/10 border-primary/20' : 'bg-transparent border-transparent'} ${completed ? 'text-muted-foreground' : 'text-foreground'}`}
        >
            <div className={`p-2 rounded-full flex-shrink-0 ${completed ? 'bg-green-500/20 text-green-500' : active ? 'bg-primary/20 text-primary animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                {completed ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            </div>
            <span className={`text-sm font-medium ${active ? 'font-bold' : ''} break-words line-clamp-2`}>{label}</span>
            {active && <Loader2 className="w-3 h-3 ml-auto animate-spin text-primary flex-shrink-0" />}
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
                            <div className="w-full max-w-md md:max-w-lg space-y-2 pt-4 px-4">
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

                    {/* LOCKED RESULT (Watermarked Preview) */}
                    {step === "LOCKED_RESULT" && (
                        <motion.div
                            key="locked"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="h-full flex flex-col items-center justify-center space-y-6"
                        >
                            <div className="relative w-full max-w-[420px] aspect-[9/16] bg-muted rounded-2xl overflow-hidden border border-border/50 shadow-2xl group">
                                {generatedImage ? (
                                    <>
                                        {/* Blurred/Darkened Image - Actually we show it clear but with watermark per user request "preview... with watermark" */}
                                        <img src={generatedImage} alt="Preview" className="w-full h-full object-cover transition-all duration-700" />

                                        {/* Watermark Overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center p-6 z-10 pointer-events-none opacity-80">
                                            <img
                                                src="https://dentalcorbella.com/wp-content/uploads/2023/07/logo-white-trans2.png"
                                                alt="Watermark"
                                                className="w-full opacity-60 drop-shadow-md rotate-[-20deg]"
                                            />
                                        </div>
                                    </>
                                ) : null}
                            </div>

                            <div className="text-center px-4">
                                <h3 className="font-bold text-xl mb-2">¿Te gusta tu nueva sonrisa?</h3>
                                <p className="text-sm text-muted-foreground mb-4">Recibe esta imagen en <strong>Full HD</strong> y sin marca de agua directamente en tu WhatsApp.</p>

                                <Button
                                    onClick={() => setStep("LEAD_FORM")}
                                    className="w-full max-w-xs text-base h-12 font-bold rounded-xl shadow-lg bg-green-600 hover:bg-green-700 text-white animate-pulse"
                                    size="lg"
                                >
                                    <span className="mr-2">📲</span> Recibir en WhatsApp
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* LEAD FORM */}
                    {step === "LEAD_FORM" && (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="h-full flex flex-col items-center justify-center p-4 overflow-y-auto"
                        >
                            <div className="w-full max-w-sm space-y-6">
                                <div className="text-center space-y-1">
                                    <h2 className="text-2xl font-heading font-bold">¡Casi listo!</h2>
                                    <p className="text-sm text-muted-foreground">Envíanos tus datos para recibir tu diseño.</p>
                                </div>
                                <form className="space-y-4" onSubmit={handleLeadSubmit}>
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">Nombre Completo</Label>
                                            <Input id="name" name="name" placeholder="Ej: Juan Pérez" required className="h-11" />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="email">Correo Electrónico</Label>
                                            <Input id="email" name="email" type="email" placeholder="juan@ejemplo.com" required className="h-11" />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="phone">WhatsApp (con código de país)</Label>
                                            <Input
                                                id="phone"
                                                name="phone"
                                                type="tel"
                                                placeholder="+34 600 000 000"
                                                required
                                                className="h-11 font-mono"
                                            />
                                            <p className="text-[10px] text-muted-foreground">Importante: Incluye el prefijo (ej: +34 para España).</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start space-x-3 bg-muted/30 p-3 rounded-lg">
                                        <Checkbox id="terms" required className="mt-1" />
                                        <Label htmlFor="terms" className="text-xs text-muted-foreground font-normal leading-tight">
                                            Acepto recibir mi diseño por WhatsApp y la política de privacidad de Dental Corbella.
                                        </Label>
                                    </div>

                                    <Button type="submit" className="w-full h-12 text-base font-bold rounded-xl shadow-md">
                                        Enviar y Recibir Diseño 🚀
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setStep("LOCKED_RESULT")} className="w-full">
                                        Volver
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
                            <div className="relative w-full max-w-[420px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border border-primary/20 bg-black">
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

                            <div className="w-full max-w-[420px] flex gap-2">
                                <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="flex-1 gap-2 border-primary/20 hover:bg-primary/5 h-12 text-base font-bold"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setStep("SURVEY");
                                            }}
                                        >
                                            <Video className="w-5 h-5 text-primary" /> Generar Video (Beta)
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
                            </div>
                        </motion.div>
                    )}

                    {/* SURVEY STEP */}
                    {step === "SURVEY" && (
                        <motion.div
                            key="survey"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="h-full flex flex-col items-center justify-center p-4 overflow-y-auto"
                        >
                            <div className="w-full max-w-sm space-y-6">
                                <div className="text-center space-y-1">
                                    <h2 className="text-2xl font-heading font-bold">Personaliza tu Video</h2>
                                    <p className="text-sm text-muted-foreground">3 preguntas rápidas para adaptar el resultado.</p>
                                </div>
                                <form className="space-y-4" onSubmit={handleSurveySubmit}>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Rango de Edad</Label>
                                            <select name="ageRange" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" required>
                                                <option value="">Selecciona una opción</option>
                                                <option value="18-30">Joven (18 - 30 años)</option>
                                                <option value="30-55">Mediana Edad (30 - 55 años)</option>
                                                <option value="55+">Senior (55 años en adelante)</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>¿Qué te gustaría mejorar?</Label>
                                            <select name="improvementGoal" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" required>
                                                <option value="">Selecciona una opción</option>
                                                <option value="alignment">Alineación</option>
                                                <option value="veneers">Carillas</option>
                                                <option value="implants">Implantes</option>
                                                <option value="full_smile">Sonrisa Completa</option>
                                                <option value="whitening">Blanqueamiento</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Plazo deseado</Label>
                                            <select name="timeframe" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" required>
                                                <option value="">Selecciona una opción</option>
                                                <option value="now">Ahora mismo</option>
                                                <option value="1-3_months">1 - 3 meses</option>
                                                <option value="later">Más adelante</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Clínica de preferencia</Label>
                                            <select name="clinicPreference" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" required>
                                                <option value="">Selecciona una opción</option>
                                                <option value="Goya">Goya</option>
                                                <option value="Majadahonda">Majadahonda</option>
                                                <option value="Las Rozas">Las Rozas</option>
                                            </select>
                                        </div>
                                    </div>

                                    <Button type="submit" className="w-full h-12 text-base font-bold rounded-xl shadow-md mt-6">
                                        Continuar
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setStep("RESULT")} className="w-full">
                                        Cancelar
                                    </Button>
                                </form>
                            </div>
                        </motion.div>
                    )}

                    {/* VERIFICATION STEP */}
                    {step === "VERIFICATION" && (
                        <motion.div
                            key="verification"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="h-full flex flex-col items-center justify-center p-6 space-y-8"
                        >
                            <div className="bg-primary/5 p-4 rounded-full">
                                <Video className="w-12 h-12 text-primary" />
                            </div>

                            <div className="text-center space-y-4 max-w-sm">
                                <h2 className="text-2xl font-heading font-bold">Solicitud de Vídeo</h2>
                                <p className="text-sm text-balance text-muted-foreground leading-relaxed">
                                    Para mantener la calidad del servicio, los vídeos <strong>Smile Forward</strong> se generan de forma personalizada y se entregan solo a solicitudes verificadas.
                                </p>
                                <p className="text-sm text-balance text-muted-foreground leading-relaxed">
                                    Para verificar su solicitud, envíenos un WhatsApp haciendo clic en el siguiente botón.
                                </p>
                            </div>

                            <Button
                                className="w-full max-w-xs h-14 text-lg font-bold rounded-2xl shadow-xl bg-green-600 hover:bg-green-700 text-white gap-2"
                                onClick={() => {
                                    window.open(`https://wa.me/34600000000?text=${encodeURIComponent("Hola, me gustaría verificar mi solicitud de vídeo Smile Forward.")}`, '_blank');
                                }}
                            >
                                <Share2 className="w-6 h-6" />
                                Verificar solicitud
                            </Button>

                            <Button variant="ghost" size="sm" onClick={() => setStep("RESULT")}>
                                Volver al resultado
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div >
    );
}
