import Link from "next/link";
import WidgetContainer from "@/components/widget/WidgetContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/mode-toggle";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-background text-foreground selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-8">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <span className="text-primary text-2xl">✨</span> Smile Forward
          </h1>
          <div className="flex gap-4">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="sm">Admin Panel</Button>
            </Link>
            <Link href="/widget">
              <Button variant="outline" size="sm">Standalone Widget</Button>
            </Link>
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-8 md:p-24 gap-16">
        {/* Intro Section */}
        <section className="text-center max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <Badge variant="secondary" className="mb-4">AI-Powered Dentistry</Badge>
          <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-br from-primary via-teal-500 to-cyan-600 bg-clip-text text-transparent pb-2">
            Perfect Smiles <br /> Start Here
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience the future of dental aesthetics. Our advanced AI analyzes your facial structure to design your ideal smile in seconds.
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <Button size="lg" className="rounded-full px-8">Get Started</Button>
            <Button size="lg" variant="outline" className="rounded-full px-8">Learn More</Button>
          </div>
        </section>

        {/* Demo Widget Section */}
        <section className="w-full max-w-4xl relative group">
          {/* Background Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-cyan-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 animate-pulse"></div>

          <Card className="relative border-border/50 shadow-2xl overflow-hidden bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
            <div className="absolute inset-0 bg-grid-zinc-900/[0.02] bg-[bottom_1px_center] dark:bg-grid-zinc-400/[0.05]" style={{ maskImage: 'linear-gradient(to bottom, transparent, black)' }}></div>

            <div className="relative p-6 bg-muted/30 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                <span className="ml-2 text-xs font-mono text-muted-foreground uppercase tracking-widest pl-2 border-l">Live Demo</span>
              </div>
            </div>

            {/* Widget Component */}
            <div className="p-0 bg-background/50">
              <WidgetContainer />
            </div>
          </Card>
        </section>

        {/* Features Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl mt-12">
          <Card className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 border-input/50 transition-all hover:shadow-lg hover:-translate-y-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                ⚡️ Instant Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Advanced computer vision checks your facial structure, landmarks, and smile characteristics in seconds.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 border-input/50 transition-all hover:shadow-lg hover:-translate-y-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                🪄 AI Simulation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                See your future smile generated by state-of-the-art Generative AI models tailored to your refined aesthetic.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 border-input/50 transition-all hover:shadow-lg hover:-translate-y-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                📅 Seamless Booking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                Connect directly with verified dental professionals to turn your digital simulation into reality.
              </CardDescription>
            </CardContent>
          </Card>
        </section>
      </main>

    </div>
  );
}
