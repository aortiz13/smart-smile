export default function WidgetLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-transparent py-4 px-4 sm:px-0">
            <div className="w-full max-w-md bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
                {children}
            </div>
        </div>
    );
}
