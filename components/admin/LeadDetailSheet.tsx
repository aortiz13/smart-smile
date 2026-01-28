"use client";

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, Calendar, User, ImageIcon, MonitorPlay, MessageCircle } from "lucide-react";
import Image from "next/image";
import { BeforeAfterSlider } from "@/components/widget/BeforeAfterSlider";
import { Button } from "@/components/ui/button";

interface LeadDetailSheetProps {
    lead: any | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LeadDetailSheet({ lead, open, onOpenChange }: LeadDetailSheetProps) {
    if (!lead) return null;

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("es-CL", {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const styles: Record<string, string> = {
            pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
            contacted: "bg-blue-100 text-blue-800 border-blue-200",
            converted: "bg-green-100 text-green-800 border-green-200",
            rejected: "bg-red-100 text-red-800 border-red-200"
        };

        const labels: Record<string, string> = {
            pending: "Pendiente",
            contacted: "Contactado",
            converted: "Convertido",
            rejected: "Rechazado"
        };

        return (
            <Badge variant="outline" className={`${styles[status] || styles.pending} text-xs font-semibold px-3 py-1`}>
                {labels[status] || status}
            </Badge>
        );
    };

    // Find linked generation (prioritize image)
    const generation = lead.generations?.find((g: any) => g.type === 'image');

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                        <User className="text-primary w-6 h-6" strokeWidth={1.5} />
                        {lead.name}
                    </SheetTitle>
                    <SheetDescription>
                        Detalles completos de la solicitud y generación.
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-6">
                    {/* Status & Date */}
                    <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg">
                        <StatusBadge status={lead.status} />
                        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3" strokeWidth={1.5} />
                            {new Date(lead.created_at).toLocaleDateString()}
                        </span>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2">Información de Contacto</h3>
                        <div className="grid gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-full text-primary">
                                    <Mail className="w-4 h-4" strokeWidth={1.5} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground">Correo Electrónico</p>
                                    <a href={`mailto:${lead.email}`} className="text-sm font-medium hover:underline text-foreground">
                                        {lead.email}
                                    </a>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-full text-primary">
                                    <Phone className="w-4 h-4" strokeWidth={1.5} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground">Teléfono</p>
                                    <a href={`tel:${lead.phone}`} className="text-sm font-medium hover:underline text-foreground">
                                        {lead.phone}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Result Generation */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b pb-2 flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" strokeWidth={1.5} />
                            Resultado Generado
                        </h3>

                        {generation ? (
                            <div className="rounded-xl overflow-hidden border border-border shadow-sm">
                                <div className="aspect-[9/16] relative bg-black">
                                    {/* Try to use BeforeAfter if input exists, else just output */}
                                    {generation.input_path && generation.input_path !== 'unknown' ? (
                                        <BeforeAfterSlider
                                            beforeImage={generation.input_path}
                                            afterImage={generation.output_path}
                                        />
                                    ) : (
                                        <img
                                            src={generation.output_path}
                                            alt="Generated Smile"
                                            className="w-full h-full object-contain"
                                        />
                                    )}
                                </div>
                                <div className="p-3 bg-secondary/20 text-xs text-center text-muted-foreground">
                                    Generado el {formatDate(generation.created_at)}
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 border border-dashed rounded-xl text-center text-muted-foreground bg-muted/10">
                                <MonitorPlay className="w-8 h-8 mx-auto mb-2 opacity-20" strokeWidth={1.5} />
                                <p>No hay generación de imagen asociada a este lead.</p>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4">
                        <Button className="flex-1" variant="default">
                            <MessageCircle className="w-4 h-4 mr-2" strokeWidth={1.5} /> Contactar por WhatsApp
                        </Button>
                        <Button className="flex-1" variant="outline">Marcar Contactado</Button>
                    </div>

                </div>
            </SheetContent>
        </Sheet>
    );
}
