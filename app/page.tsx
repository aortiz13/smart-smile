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
      {/* Header - Dental Corbella Premium Style */}
      <header className="fixed top-0 z-50 w-full bg-black/40 backdrop-blur-md border-b border-white/10 transition-all duration-300">
        {/* Top Bar for Phone */}
        <div className="hidden md:block w-full border-b border-white/5 bg-black/20">
          <div className="container flex justify-end items-center h-8 px-8 gap-4 text-[11px] tracking-widest font-sans text-white/90">
            <span className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity cursor-pointer">
              <Smartphone className="w-3 h-3" strokeWidth={1.5} /> 91 111 7575
            </span>
          </div>
        </div>

        {/* Main Navbar */}
        <div className="container flex h-20 items-center justify-between px-8">
          {/* Logo */}
          <h1 className="text-2xl font-serif tracking-tight flex items-center gap-2 text-white">
            Smile Forward
          </h1>

          {/* Desktop Nav Items (Visual imitation of Corbella) */}
          <nav className="hidden lg:flex items-center gap-6 text-[11px] font-sans font-medium tracking-[0.15em] text-white/90">
            {['NOSOTROS', 'TRATAMIENTOS', 'SOLUCIONES', 'CASOS', 'BLOG', 'CONTACTO'].map((item) => (
              <a key={item} href="#" className="hover:text-teal-400 transition-colors relative group">
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-teal-400 transition-all group-hover:w-full"></span>
              </a>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <Link href="/widget">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-white/80 text-white bg-transparent hover:bg-white hover:text-black hover:border-white font-sans tracking-widest text-[10px] uppercase h-9 px-6 transition-all duration-300"
              >
                HAZ TU CONSULTA
              </Button>
            </Link>

            <div className="hidden md:flex gap-3 text-white/80">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full w-8 h-8">
                <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} />
              </Button>
              <ModeToggle />
            </div>
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

          <p className="text-lg md:text-xl font-sans font-light text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
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
