"use client";

import { useState, useRef, useEffect } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { Loader2, UploadCloud, Lock, Check, Video, PlayCircle, Sparkles, ScanFace, FileSearch, Wand2, Share2, MessageCircle, Send, Smartphone } from "lucide-react";
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
    const [isVerified, setIsVerified] = useState(false);
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

            const genResult = await generateSmileVariation(base64, prompt, "9:16", currentUserId);

            if (!genResult.success || !genResult.data) {
                throw new Error(genResult.error || "Fallo en la generación de sonrisa");
            }

            setGeneratedImage(genResult.data);
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
                {completed ? <Check className="w-4 h-4" strokeWidth={1.5} /> : <Icon className="w-4 h-4" strokeWidth={1.5} />}
            </div>
            <span className={`text-sm font-medium ${active ? 'font-bold' : ''} break-words line-clamp-2`}>{label}</span>
            {active && <Loader2 className="w-3 h-3 ml-auto animate-spin text-primary flex-shrink-0" />}
        </motion.div>
    );

    return (
        <div className="relative h-auto md:h-[calc(100vh-100px)] min-h-[600px] w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col font-sans overflow-hidden rounded-[2rem]">
            {/* Header - Minimal with Serif Font */}
            <div className="flex-none p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md z-20">
                <h1 className="text-xl md:text-2xl font-serif text-black dark:text-white tracking-tight">Smile Forward</h1>
                {/* Subtle Status Indicator */}
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-50 dark:bg-zinc-800 rounded-full border border-zinc-100 dark:border-zinc-700">
                    <span className="relative flex h-2 w-2">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-sans tracking-widest uppercase">Online</span>
                </div>
            </div>

            {/* Main Content Area - Scrollable if needed but mostly constrained */}
            <main className="flex-1 relative overflow-y-auto overflow-x-hidden p-6 md:p-10 scrollbar-hide flex flex-col">
                {!isVerified ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-serif text-black dark:text-white">Verificación de Seguridad</h2>
                            <p className="text-sm text-zinc-500">Por favor completa el captcha para continuar.</p>
                        </div>
                        <Turnstile
                            siteKey="0x4AAAAAAACUl6BXJSwE0jdk1"
                            onSuccess={(token) => setIsVerified(true)}
                            options={{
                                size: 'normal',
                                theme: 'auto',
                            }}
                        />
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {/* UPLOAD STEP */}
                        {step === "UPLOAD" && (
                            <motion.div
                                key="upload"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="h-full flex flex-col justify-center items-center text-center space-y-8"
                            >
                                <div
                                    className="group relative w-full aspect-[4/3] max-w-[280px] md:max-w-sm border border-dashed border-zinc-300 dark:border-zinc-700 rounded-[2rem] hover:border-teal-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/50"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="p-6 bg-white dark:bg-zinc-800 shadow-sm rounded-full mb-6 group-hover:scale-110 transition-transform duration-500">
                                        <UploadCloud className="w-8 h-8 text-zinc-400 group-hover:text-teal-600 transition-colors" strokeWidth={1} />
                                    </div>
                                    <h3 className="text-xl font-serif text-black dark:text-white mb-2">Sube tu Selfie</h3>
                                    <p className="text-sm text-zinc-500 max-w-[200px]">Arrastra tu foto aquí o haz clic para explorar</p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                                    />
                                </div>
                                <div className="flex flex-wrap justify-center gap-6 text-xs text-zinc-400 font-sans tracking-wide uppercase">
                                    <span className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" strokeWidth={1.5} /> 100% Privado</span>
                                    <span className="flex items-center gap-2"><Check className="w-4 h-4 text-teal-500" strokeWidth={1.5} /> Resultados en segundos</span>
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
                                className="h-full flex flex-col md:flex-row gap-10 items-center justify-center py-8 md:py-0"
                            >
                                {/* Left: Visual Scanner - Minimal */}
                                <div className="relative w-full max-w-[240px] md:max-w-[280px] aspect-[3/4] rounded-[2rem] overflow-hidden shadow-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-900 flex-shrink-0">
                                    {image ? (
                                        <img src={URL.createObjectURL(image)} alt="Analyzing" className="w-full h-full object-cover opacity-80" />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-800" />
                                    )}
                                    <motion.div
                                        variants={scanVariants}
                                        initial="initial"
                                        animate="animate"
                                        className="absolute left-0 right-0 h-[1px] bg-white/50 shadow-[0_0_20px_2px_rgba(255,255,255,0.5)] z-10"
                                    />
                                </div>

                                {/* Right: Progress List - Clean Typography */}
                                <div className="w-full max-w-sm space-y-4 px-4 md:px-0">
                                    <h3 className="text-2xl font-serif text-black dark:text-white mb-6 text-center md:text-left">Analizando...</h3>
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
                                className="h-full flex flex-col items-center justify-center space-y-8 py-8 md:py-0"
                            >
                                <div className="relative w-full max-w-[320px] md:max-w-[380px] aspect-[9/16] bg-zinc-100 dark:bg-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl group">
                                    {generatedImage ? (
                                        <>
                                            <img src={generatedImage} alt="Preview" className="w-full h-full object-cover" />
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

                                <div className="text-center space-y-6 max-w-sm px-4 md:px-0">
                                    <div>
                                        <h3 className="font-serif text-2xl text-black dark:text-white mb-2">Tu sonrisa, rediseñada.</h3>
                                        <p className="text-sm text-zinc-500 leading-relaxed">Recibe la imagen en alta calidad y descubre cómo lograr este resultado.</p>
                                    </div>

                                    <Button
                                        onClick={() => setStep("LEAD_FORM")}
                                        className="w-full h-14 rounded-full bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-base font-sans font-medium tracking-wide shadow-lg gap-2"
                                        size="lg"
                                    >
                                        <MessageCircle className="w-5 h-5" strokeWidth={1.5} /> Continuar en WhatsApp
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* LEAD FORM - Clean & Minimal */}
                        {step === "LEAD_FORM" && (
                            <motion.div
                                key="form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="h-full flex flex-col items-center justify-center p-4 overflow-y-auto"
                            >
                                <div className="w-full max-w-sm space-y-8 py-8 md:py-0">
                                    <div className="text-center space-y-2">
                                        <h2 className="text-3xl font-serif text-black dark:text-white">Casi listo</h2>
                                        <p className="text-sm text-zinc-500">Completa tus datos para recibir tu diseño.</p>
                                    </div>
                                    <form className="space-y-5" onSubmit={handleLeadSubmit}>
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="name" className="text-xs uppercase tracking-wider text-zinc-400 pl-4">Nombre Completo</Label>
                                                <Input id="name" name="name" placeholder="Tu nombre" required className="h-12 border-zinc-200 bg-zinc-50 rounded-full px-6 focus:ring-0 focus:border-black transition-all" />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="email" className="text-xs uppercase tracking-wider text-zinc-400 pl-4">Correo Electrónico</Label>
                                                <Input id="email" name="email" type="email" placeholder="tu@email.com" required className="h-12 border-zinc-200 bg-zinc-50 rounded-full px-6 focus:ring-0 focus:border-black transition-all" />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="phone" className="text-xs uppercase tracking-wider text-zinc-400 pl-4">WhatsApp</Label>
                                                <Input
                                                    id="phone"
                                                    name="phone"
                                                    type="tel"
                                                    placeholder="+34"
                                                    required
                                                    className="h-12 border-zinc-200 bg-zinc-50 rounded-full px-6 focus:ring-0 focus:border-black transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-start space-x-3 px-2">
                                            <Checkbox id="terms" required className="mt-1 rounded-full border-zinc-300 data-[state=checked]:bg-black data-[state=checked]:text-white" />
                                            <Label htmlFor="terms" className="text-xs text-zinc-400 font-normal leading-tight">
                                                Acepto recibir mi diseño y la política de privacidad.
                                            </Label>
                                        </div>

                                        <Button type="submit" className="w-full h-14 rounded-full bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-base font-sans font-medium tracking-wide shadow-md mt-4">
                                            Ver mi Resultado
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setStep("LOCKED_RESULT")} className="w-full rounded-full text-zinc-400 hover:text-black hover:bg-transparent">
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
                                className="h-full flex flex-col items-center gap-6 pt-4 pb-8"
                            >
                                <div className="relative w-full max-w-[320px] aspect-[9/16] rounded-[2rem] overflow-hidden shadow-2xl border border-zinc-100 bg-zinc-900">
                                    {generatedImage && image ? (
                                        <BeforeAfterSlider
                                            beforeImage={URL.createObjectURL(image)}
                                            afterImage={generatedImage}
                                            className="h-full w-full"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center w-full h-full text-zinc-400">Error</div>
                                    )}
                                </div>

                                <div className="w-full max-w-[320px] px-4 md:px-0">
                                    <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full h-12 rounded-full border-zinc-200 text-zinc-600 hover:border-black hover:text-black transition-all font-sans"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setStep("SURVEY");
                                                }}
                                            >
                                                <Video className="w-4 h-4 mr-2" strokeWidth={1.5} /> Generar Video Simulación
                                            </Button>
                                        </DialogTrigger>
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
                                <div className="w-full max-w-sm space-y-6 py-8 md:py-0">
                                    <div className="text-center space-y-2">
                                        <h2 className="text-2xl font-serif text-black dark:text-white">Personalizar</h2>
                                        <p className="text-sm text-zinc-500">Ayúdanos a mejorar tu simulación.</p>
                                    </div>
                                    <form className="space-y-5" onSubmit={handleSurveySubmit}>
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs uppercase tracking-wider text-zinc-400 pl-4">Rango de Edad</Label>
                                                <select name="ageRange" className="flex h-12 w-full items-center justify-between rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:opacity-50 appearance-none" required>
                                                    <option value="">Selecciona una opción</option>
                                                    <option value="18-30">Joven (18 - 30 años)</option>
                                                    <option value="30-55">Mediana Edad (30 - 55 años)</option>
                                                    <option value="55+">Senior (55 años en adelante)</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs uppercase tracking-wider text-zinc-400 pl-4">Objetivo</Label>
                                                <select name="improvementGoal" className="flex h-12 w-full items-center justify-between rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:opacity-50 appearance-none" required>
                                                    <option value="">Selecciona una opción</option>
                                                    <option value="alignment">Alineación</option>
                                                    <option value="veneers">Carillas</option>
                                                    <option value="implants">Implantes</option>
                                                    <option value="full_smile">Sonrisa Completa</option>
                                                    <option value="whitening">Blanqueamiento</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs uppercase tracking-wider text-zinc-400 pl-4">Plazo</Label>
                                                <select name="timeframe" className="flex h-12 w-full items-center justify-between rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:opacity-50 appearance-none" required>
                                                    <option value="">Selecciona una opción</option>
                                                    <option value="now">Ahora mismo</option>
                                                    <option value="1-3_months">1 - 3 meses</option>
                                                    <option value="later">Más adelante</option>
                                                </select>
                                            </div>
                                        </div>

                                        <Button type="submit" className="w-full h-14 rounded-full bg-black text-white hover:bg-zinc-800 text-base font-sans font-medium tracking-wide shadow-md mt-4">
                                            Continuar
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setStep("RESULT")} className="w-full rounded-full text-zinc-400 hover:text-black hover:bg-transparent">
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
                                className="h-full flex flex-col items-center justify-center p-6 space-y-8 py-10 md:py-0"
                            >
                                <div className="bg-zinc-50 p-6 rounded-full">
                                    <Video className="w-10 h-10 text-zinc-800" strokeWidth={1} />
                                </div>

                                <div className="text-center space-y-4 max-w-sm">
                                    <h2 className="text-2xl font-serif text-black dark:text-white">Vídeo Personalizado</h2>
                                    <p className="text-sm text-zinc-500 leading-relaxed">
                                        Para asegurar la calidad, generamos cada vídeo bajo demanda. Verifica tu solicitud en WhatsApp para comenzar.
                                    </p>
                                </div>

                                <Button
                                    className="w-full max-w-xs h-14 rounded-full bg-[#25D366] hover:bg-[#128C7E] text-white text-base font-bold shadow-lg flex items-center justify-center gap-3"
                                    onClick={() => {
                                        window.open(`https://wa.me/34600000000?text=${encodeURIComponent("Hola, me gustaría verificar mi solicitud de vídeo Smile Forward.")}`, '_blank');
                                    }}
                                >
                                    <Share2 className="w-5 h-5" strokeWidth={1.5} />
                                    Verificar en WhatsApp
                                </Button>

                                <Button variant="ghost" size="sm" onClick={() => setStep("RESULT")} className="text-zinc-400 hover:text-black">
                                    Volver
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </main>
        </div >
    );
}
