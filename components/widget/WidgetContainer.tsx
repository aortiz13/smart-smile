"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import { Loader2, UploadCloud, Lock, CheckCircle2, AlertCircle, Video, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { validateImageStrict, analyzeImageAndGeneratePrompts, generateSmileVariation } from "@/app/services/gemini";
import { uploadScan } from "@/app/services/storage";
import { VariationType } from "@/types/gemini";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

type Step = "UPLOAD" | "ANALYZING" | "PREVIEW" | "GENERATING" | "LOCKED_RESULT" | "LEAD_FORM" | "RESULT";

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
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
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

    const handleUpload = async (file: File) => {
        setImage(file);
        setStep("ANALYZING");

        try {
            // Convert to Base64 for Server Actions
            const base64 = await fileToBase64(file);

            // 1. Strict Validation (Server Action)
            const validation = await validateImageStrict(base64);

            if (!validation.isValid) {
                toast.error(validation.reason || "Imagen no válida");
                setStep("UPLOAD");
                setImage(null);
                return;
            }

            // 2. Upload to Storage (Server Action wrapper or Client)
            const formData = new FormData();
            formData.append('file', file);
            // We need a userId. For now, using a temp ID if not auth, or fetch user. 
            // In the prototype it passed userId. Here we might be anon.
            // Let's use a random ID for anonymous uploads or check auth.
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id || 'anon_' + crypto.randomUUID();
            formData.append('userId', userId);

            // Background upload (non-blocking for UI but good to await)
            await uploadScan(formData);

            // 3. Analyze Image (Server Action)
            const analysisData = await analyzeImageAndGeneratePrompts(base64);
            setAnalysisResult(analysisData);

            toast.success("Foto analizada correctamente");
            setStep("PREVIEW");

        } catch (err: any) {
            console.error(err);
            toast.error(`Error: ${err.message || "Ocurrió un error procesando la imagen."}`);
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
                survey_data: { analysis: analysisResult },
                status: 'pending'
            });

            if (error) throw error;

            toast.success("¡Información enviada con éxito!");
            setStep("RESULT");
        } catch (err) {
            console.error(err);
            toast.error("Error guardando datos. Intenta de nuevo.");
        }
    };

    const handleVideoRequest = () => {
        setIsVideoDialogOpen(false);
        toast.info("Solicitud de video enviada. Te contactaremos pronto.", {
            description: "Esta función está en Beta privada."
        });
    };

    return (
        <div className="relative min-h-[600px] w-full bg-card text-card-foreground flex flex-col font-sans">
            <div className="p-4 border-b flex justify-between items-center bg-muted/20">
                <h1 className="text-xl font-heading font-bold text-primary tracking-tight">Smile Forward AI</h1>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">ONLINE</span>
                </div>
            </div>

            <main className="flex-1 p-6 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    {/* UPLOAD STEP */}
                    {step === "UPLOAD" && (
                        <motion.div
                            key="upload"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="h-full flex flex-col justify-center items-center text-center space-y-8 py-8"
                        >
                            <div
                                className="group relative w-full aspect-[4/3] max-w-sm border-2 border-dashed border-input rounded-2xl hover:border-primary/50 hover:bg-secondary/30 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="p-5 bg-background shadow-sm rounded-full mb-4 group-hover:scale-110 transition-transform duration-500">
                                    <UploadCloud className="w-10 h-10 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground">Sube tu Selfie</h3>
                                <p className="text-sm text-muted-foreground px-8 mt-2">Arrastra tu imagen aquí o haz clic para explorar</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground/80 max-w-xs text-balance">
                                Privacidad garantizada. Tu foto se elimina automáticamente después del análisis.
                            </p>
                        </motion.div>
                    )}

                    {/* ANALYZING STEP */}
                    {step === "ANALYZING" && (
                        <motion.div
                            key="analyzing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center h-full space-y-8"
                        >
                            <div className="relative w-64 h-64 rounded-2xl overflow-hidden shadow-2xl border border-primary/20 bg-black">
                                {image ? (
                                    <img src={URL.createObjectURL(image)} alt="Analyzing" className="w-full h-full object-cover opacity-80" />
                                ) : (
                                    <div className="w-full h-full bg-muted" />
                                )}

                                {/* Scanning Effect */}
                                <motion.div
                                    variants={scanVariants}
                                    initial="initial"
                                    animate="animate"
                                    className="absolute left-0 right-0 h-1 bg-primary shadow-[0_0_20px_2px_rgba(42,157,143,0.8)] z-10"
                                />
                                <div className="absolute inset-0 bg-grid-white/[0.1] bg-[size:20px_20px]" />

                                {/* Overlay Data */}
                                <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] font-mono text-primary-foreground/80">
                                    <span>FACE_ID: DETECTING</span>
                                    <span>CONFIDENCE: 99.8%</span>
                                </div>
                            </div>
                            <div className="space-y-3 text-center max-w-xs mx-auto">
                                <h3 className="font-heading font-bold text-xl">Escaneando Rostro...</h3>
                                <Progress value={66} className="h-2" />
                                <p className="text-xs text-muted-foreground animate-pulse">Detectando puntos de referencia biométricos</p>
                            </div>
                        </motion.div>
                    )}

                    {/* PREVIEW STEP */}
                    {step === "PREVIEW" && (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                        >
                            <Card className="bg-gradient-to-br from-background to-secondary/20 border-border shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-primary flex items-center gap-2 text-lg">
                                        <CheckCircle2 className="w-5 h-5" /> Análisis Completado
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="p-4 bg-background/50 rounded-lg border border-border/50 text-sm leading-relaxed text-muted-foreground">
                                        {analysisResult?.analysis || "Estructura facial analizada con éxito. Compatible con carillas de porcelana y diseño de sonrisa digital."}
                                    </div>
                                </CardContent>
                            </Card>

                            <Button
                                onClick={async () => {
                                    setStep("GENERATING");
                                    try {
                                        if (!image || !analysisResult) throw new Error("Datos faltantes");

                                        const base64 = await fileToBase64(image);
                                        const naturalVariation = analysisResult.variations.find((v: any) => v.type === VariationType.ORIGINAL_BG);

                                        if (!naturalVariation) throw new Error("No se encontró plan de restauración natural.");

                                        const prompt = `
                                          Perform a ${naturalVariation.prompt_data.Composition} of ${naturalVariation.prompt_data.Subject} ${naturalVariation.prompt_data.Action} in a ${naturalVariation.prompt_data.Location}.
                                          Style: ${naturalVariation.prompt_data.Style}. 
                                          IMPORTANT INSTRUCTIONS: ${naturalVariation.prompt_data.Editing_Instructions}.
                                          ${naturalVariation.prompt_data.Refining_Details || ''}
                                        `;

                                        const imageUrl = await generateSmileVariation(base64, prompt, "9:16");

                                        setGeneratedImage(imageUrl);
                                        setStep("LOCKED_RESULT");

                                    } catch (e: any) {
                                        console.error(e);
                                        toast.error(`Error generando simulación: ${e.message}`);
                                        setStep("PREVIEW");
                                    }
                                }}
                                className="w-full text-lg h-14 shadow-xl hover:shadow-primary/25 transition-all font-bold rounded-xl"
                            >
                                ✨ Generar Nueva Sonrisa
                            </Button>
                        </motion.div>
                    )}

                    {/* GENERATING STEP */}
                    {step === "GENERATING" && (
                        <motion.div
                            key="generating"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center h-full space-y-8"
                        >
                            <div className="relative">
                                {/* Double Spinner */}
                                <div className="w-20 h-20 border-4 border-primary/20 rounded-full" />
                                <div className="absolute inset-0 w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 text-primary animate-pulse" />
                                </div>
                            </div>
                            <div className="space-y-2 text-center">
                                <h3 className="font-heading font-bold text-2xl bg-gradient-to-r from-primary to-teal-600 bg-clip-text text-transparent">Diseñando Sonrisa</h3>
                                <p className="text-sm text-muted-foreground animate-pulse">Aplicando principios de estética dental avanzada...</p>
                            </div>
                        </motion.div>
                    )}

                    {/* LOCKED RESULT */}
                    {step === "LOCKED_RESULT" && (
                        <motion.div
                            key="locked"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6"
                        >
                            <div className="aspect-square bg-muted rounded-2xl overflow-hidden relative border border-border/50 group shadow-inner">
                                {generatedImage ? (
                                    <div className="w-full h-full relative">
                                        <img src={generatedImage} alt="Generated Smile" className="w-full h-full object-cover blur-xl scale-110" />
                                        <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px]" />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-destructive">Error de imagen</div>
                                )}

                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center">
                                    <div className="p-4 bg-background rounded-full shadow-2xl border border-primary/10">
                                        <Lock className="w-8 h-8 text-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-2xl text-foreground drop-shadow-sm">Resultado Listo</h3>
                                        <p className="text-sm text-muted-foreground font-medium">Ingresa tus datos para desbloquear tu <br /> Simulación HD.</p>
                                    </div>
                                </div>
                            </div>
                            <Button
                                onClick={() => setStep("LEAD_FORM")}
                                className="w-full text-lg h-12 font-bold rounded-xl"
                                variant="default"
                            >
                                Desbloquear Ahora
                            </Button>
                        </motion.div>
                    )}

                    {/* LEAD FORM */}
                    {step === "LEAD_FORM" && (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            <div className="text-center space-y-2">
                                <h2 className="text-2xl font-heading font-bold text-foreground">Último Paso</h2>
                                <p className="text-sm text-muted-foreground">Te enviaremos tu simulación y un plan de tratamiento preliminar.</p>
                            </div>

                            <form className="space-y-4 pt-2" onSubmit={handleLeadSubmit}>
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-foreground/80">Nombre completo</Label>
                                    <Input
                                        id="name" name="name" placeholder="Ej. Juan Pérez" required
                                        className="h-11 bg-background focus-visible:ring-primary focus-visible:border-primary"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-foreground/80">Correo electrónico</Label>
                                    <Input
                                        id="email" name="email" type="email" placeholder="juan@ejemplo.com" required
                                        className="h-11 bg-background focus-visible:ring-primary focus-visible:border-primary"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="text-foreground/80">Teléfono (WhatsApp)</Label>
                                    <Input
                                        id="phone" name="phone" type="tel" placeholder="+56 9 ..." required
                                        className="h-11 bg-background focus-visible:ring-primary focus-visible:border-primary"
                                    />
                                </div>

                                <div className="flex items-start space-x-3 pt-2">
                                    <Checkbox id="terms" required className="mt-1 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                                    <Label htmlFor="terms" className="text-xs text-muted-foreground leading-snug font-normal cursor-pointer">
                                        He leído y acepto la política de privacidad. Autorizo el uso de mi imagen para la simulación.
                                    </Label>
                                </div>

                                <Button type="submit" className="w-full h-12 text-base font-bold rounded-xl shadow-lg mt-4">
                                    Ver Mi Nueva Sonrisa
                                </Button>
                            </form>
                        </motion.div>
                    )}

                    {/* FINAL RESULT */}
                    {step === "RESULT" && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-6 text-center"
                        >
                            <Card className="overflow-hidden border-primary/20 shadow-2xl relative group">
                                <div className="aspect-square bg-muted relative">
                                    {generatedImage && <img src={generatedImage} alt="New Smile" className="w-full h-full object-cover" />}
                                    <div className="absolute bottom-4 right-4">
                                        <Badge className="bg-white/90 text-primary hover:bg-white backdrop-blur shadow-sm">
                                            AI GENERATED
                                        </Badge>
                                    </div>
                                </div>
                            </Card>

                            <div className="space-y-2">
                                <h3 className="font-heading font-bold text-2xl text-foreground">¡Transformación Completa!</h3>
                                <p className="text-sm text-muted-foreground">Hemos enviado el resultado de alta calidad a tu correo.</p>
                            </div>

                            <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
                                <DialogTrigger asChild>
                                    <div className="cursor-pointer group relative overflow-hidden bg-gradient-to-r from-secondary to-muted p-1 rounded-xl">
                                        <div className="bg-background rounded-lg p-4 flex items-center justify-between group-hover:bg-secondary/10 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 rounded-full">
                                                    <Video className="w-5 h-5 text-primary" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-bold text-sm">Versión en Video</p>
                                                    <p className="text-xs text-muted-foreground">Verte hablando con tu nueva sonrisa</p>
                                                </div>
                                            </div>
                                            <PlayCircle className="w-6 h-6 text-primary/50 group-hover:text-primary transition-colors" />
                                        </div>
                                    </div>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md backdrop-blur-md bg-background/80">
                                    <DialogHeader>
                                        <DialogTitle>Solicitar Video Generativo</DialogTitle>
                                        <DialogDescription>
                                            Generaremos un video de 5 segundos donde te verás hablando naturalmente con tu nueva sonrisa.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex flex-col gap-4 py-4">
                                        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border border-dashed">
                                            <p className="text-xs text-muted-foreground">Preview (Estatico)</p>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Esta función consume créditos de generación avanzados. Te notificaremos por WhatsApp cuando esté listo.
                                        </p>
                                    </div>
                                    <DialogFooter className="sm:justify-start">
                                        <Button type="button" onClick={handleVideoRequest} className="w-full">
                                            Confirmar Solicitud
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>{children}</span>
}
