"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

type Step = "UPLOAD" | "ANALYZING" | "PREVIEW" | "GENERATING" | "LOCKED_RESULT" | "LEAD_FORM" | "RESULT";

export default function WidgetContainer() {
    const [step, setStep] = useState<Step>("UPLOAD");
    const [image, setImage] = useState<File | null>(null);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    const handleUpload = async (file: File) => {
        setImage(file);
        setStep("ANALYZING");

        try {
            const supabase = createClient();

            // 1. Upload to Storage
            const ext = file.name.split('.').pop();
            const filename = `${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(filename, file);

            if (uploadError) throw uploadError;

            // 2. Call Analyze Face
            const { data: analysisData, error: analysisError } = await supabase.functions
                .invoke('analyze-face', {
                    body: { image_path: filename }
                });

            if (analysisError) throw analysisError;

            setAnalysisResult(analysisData);

            // Transition based on validity
            if (analysisData.valid) {
                setStep("PREVIEW");
            } else {
                alert(`Error: ${analysisData.reason || "Imagen no válida"}`);
                setStep("UPLOAD");
                setImage(null);
            }

        } catch (err) {
            console.error(err);
            alert("Ocurrió un error procesando la imagen. Revisa la consola.");
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
            }); // We need anonymous insert policy enabled

            if (error) throw error;

            setStep("RESULT");
        } catch (err) {
            console.error(err);
            alert("Error guardando datos. Intenta de nuevo.");
        }
    };

    return (
        <div className="relative min-h-[500px] bg-background text-foreground flex flex-col">
            <header className="p-4 border-b border-border flex justify-between items-center bg-secondary/20">
                <h1 className="font-heading text-lg font-bold text-primary">Smile Forward</h1>
                <span className="text-xs text-muted-foreground">Powered by AI</span>
            </header>

            <main className="flex-1 p-6 relative">
                <AnimatePresence mode="wait">
                    {step === "UPLOAD" && (
                        <motion.div
                            key="upload"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="h-full flex flex-col justify-center items-center text-center space-y-4"
                        >
                            <div className="p-8 border-2 border-dashed border-input rounded-xl hover:border-primary cursor-pointer transition-colors w-full"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
                                }}
                            >
                                <p className="text-muted-foreground">Arrastra tu foto aquí o haz clic</p>
                                <input type="file" hidden onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                            </div>
                            <p className="text-sm text-balance">Sube una foto frontal para descubrir tu nueva sonrisa.</p>
                        </motion.div>
                    )}

                    {step === "ANALYZING" && (
                        <motion.div
                            key="analyzing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center h-full space-y-4"
                        >
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-primary font-medium animate-pulse">Analizando facciones...</p>
                        </motion.div>
                    )}

                    {step === "PREVIEW" && (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-4 text-center"
                        >
                            <div className="bg-muted/50 p-4 rounded-lg text-sm text-left space-y-2">
                                <h3 className="font-bold text-primary">Análisis Clínico Completado</h3>
                                <p className="text-muted-foreground">{analysisResult?.analysis || "Facciones detectadas correctamente."}</p>
                            </div>

                            <button
                                onClick={async () => {
                                    setStep("GENERATING");
                                    try {
                                        const supabase = createClient();
                                        if (!image) throw new Error("No image found");

                                        // Re-upload to ensure we have a fresh path (simple fix for now)
                                        const ext = image.name.split('.').pop();
                                        const filename = `regen-${crypto.randomUUID()}.${ext}`;
                                        await supabase.storage.from('uploads').upload(filename, image);

                                        const { data, error } = await supabase.functions.invoke('generate-smile', {
                                            body: {
                                                image_path: filename,
                                                prompt_options: {}
                                            }
                                        });

                                        if (error) throw error;
                                        setGeneratedImage(data.public_url);
                                        setStep("LOCKED_RESULT");

                                    } catch (e) {
                                        console.error(e);
                                        alert("Error generando sonrisa. Asegúrate de que las Edge Functions estén activas.");
                                        setStep("PREVIEW");
                                    }
                                }}
                                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                Generar Mi Nueva Sonrisa
                            </button>
                        </motion.div>
                    )}

                    {/* GENERATING STEP */}
                    {step === "GENERATING" && (
                        <motion.div
                            key="generating"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center h-full space-y-4"
                        >
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-primary font-medium animate-pulse">Diseñando tu nueva sonrisa...</p>
                        </motion.div>
                    )}

                    {/* LOCKED RESULT (Blurred) */}
                    {step === "LOCKED_RESULT" && (
                        <motion.div
                            key="locked"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-4 text-center relative"
                        >
                            <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
                                {generatedImage ? (
                                    <img src={generatedImage} alt="Generated Smile" className="w-full h-full object-cover blur-md scale-105" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">Error cargando imagen</div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <span className="text-white font-bold text-xl drop-shadow-md">🔒 Vista Previa Bloqueada</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setStep("LEAD_FORM")}
                                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors"
                            >
                                Desbloquear Resultado HD
                            </button>
                        </motion.div>
                    )}

                    {/* LEAD FORM */}
                    {step === "LEAD_FORM" && (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <h2 className="text-xl font-heading font-bold text-center text-primary">Casi listo</h2>
                            <p className="text-sm text-center text-muted-foreground">Ingresa tus datos para recibir tu sonrisa en alta definición.</p>

                            <form className="space-y-3" onSubmit={handleLeadSubmit}>
                                <input name="name" placeholder="Nombre completo" required className="w-full p-3 rounded border border-input bg-background" />
                                <input name="email" type="email" placeholder="Correo electrónico" required className="w-full p-3 rounded border border-input bg-background" />
                                <input name="phone" type="tel" placeholder="Teléfono" required className="w-full p-3 rounded border border-input bg-background" />
                                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <input type="checkbox" required className="mt-1" />
                                    <span>Acepto la política de privacidad y el procesamiento de mi imagen.</span>
                                </label>
                                <button type="submit" className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold">
                                    Ver Mi Sonrisa
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* FINAL RESULT */}
                    {step === "RESULT" && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-4 text-center"
                        >
                            <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
                                {generatedImage && <img src={generatedImage} alt="New Smile" className="w-full h-full object-cover" />}
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-bold text-primary">¡Increíble!</h3>
                                <p className="text-xs text-muted-foreground">Hemos enviado una copia a tu correo.</p>
                            </div>

                            <div className="bg-secondary/30 p-4 rounded-lg">
                                <p className="text-sm font-bold mb-2">¿Quieres verte en movimiento?</p>
                                <button
                                    onClick={() => alert("¡Pronto! Generación de Video en desarrollo.")}
                                    className="w-full bg-accent text-white py-2 rounded font-medium text-sm"
                                >
                                    Generar Video (Beta)
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
