"use client";

import Link from "next/link";
import WidgetContainer from "@/components/widget/WidgetContainer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";
import { useEffect, useState } from "react";
import { Sparkles, LayoutDashboard, AppWindow, Smartphone } from "lucide-react";

export default function Home() {
  const [lang, setLang] = useState("es"); // Default to Spanish as requested

  useEffect(() => {
    // Simple browser language detection
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'en') {
      setLang('en');
    }
  }, []);

  const t = {
    es: {
      badge: "Odontología Avanzada",
      title: "¿Y si pudieras conocer hoy a tu mejor versión?",
      subtitle: "Adelántate al tiempo con Smile Forward, una experiencia única que te ofrece Dental Corbella.",
      cta: "Empezar",
      learnMore: "Saber más",
      admin: "Panel Admin",
      widget: "Widget"
    },
    en: {
      badge: "Advanced Dentistry",
      title: "What if you could meet your best version today?",
      subtitle: "Get ahead of time with Smile Forward, a unique experience offered by Dental Corbella.",
      cta: "Get Started",
      learnMore: "Learn More",
      admin: "Admin Panel",
      widget: "Widget"
    }
  }[lang as 'es' | 'en'] || { // Fallback
    badge: "Odontología Avanzada",
    title: "¿Y si pudieras conocer hoy a tu mejor versión?",
    subtitle: "Adelántate al tiempo con Smile Forward, una experiencia única que te ofrece Dental Corbella.",
    cta: "Empezar",
    learnMore: "Saber más",
    admin: "Panel Admin",
    widget: "Widget"
  };

  return (
    <div className="flex flex-col min-h-screen font-sans bg-white dark:bg-zinc-950 text-foreground selection:bg-teal-100 selection:text-teal-900 transition-colors duration-500">
      {/* Header - Minimal & Premium */}
      {/* Header - Minimal & Premium (Dark Glass) */}
      <header className="fixed top-0 z-50 w-full bg-black/40 backdrop-blur-md border-b border-white/10 transition-all duration-300">
        <div className="container flex h-20 items-center justify-between px-8">
          <h1 className="text-2xl font-serif tracking-tight flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-teal-500" strokeWidth={1} /> Smile Forward
          </h1>
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="hidden md:block">
              <Button variant="ghost" size="sm" className="rounded-full font-sans tracking-wide uppercase text-xs text-white/80 hover:text-white hover:bg-white/10 gap-2">
                <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} /> {t.admin}
              </Button>
            </Link>
            <Link href="/widget" className="hidden md:block">
              <Button variant="ghost" size="sm" className="rounded-full font-sans tracking-wide uppercase text-xs text-white/80 hover:text-white hover:bg-white/10 gap-2">
                <AppWindow className="w-4 h-4" strokeWidth={1.5} /> {t.widget}
              </Button>
            </Link>
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start pt-16 md:pt-24 px-6 md:px-8 gap-16 pb-24">
        {/* Intro Section */}
        <section className="text-center max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-sans font-medium text-zinc-500 uppercase tracking-widest shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            {t.badge}
          </div>

          <h2 className="text-5xl md:text-7xl lg:text-8xl font-serif font-light tracking-tight text-black dark:text-white leading-[1.1] md:leading-[1.05]">
            {t.title}
          </h2>

          <p className="text-[23px] font-sans font-light text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            {t.subtitle}
          </p>
        </section>

        {/* Floating Widget Container */}
        <section className="w-full max-w-6xl relative z-10">
          {/* Subtle premium glow behind widget */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-teal-500/10 via-purple-500/5 to-transparent blur-3xl rounded-full opacity-60 pointer-events-none"></div>

          <Card className="relative border border-zinc-100 dark:border-zinc-800 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden bg-white dark:bg-zinc-900 rounded-[2rem]">
            <div className="p-0">
              <WidgetContainer />
            </div>
          </Card>
        </section>
      </main>

    </div>
  );
}
