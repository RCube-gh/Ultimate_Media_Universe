import { SettingsForm } from "@/components/SettingsForm";

export default function SettingsPage() {
    return (
        <div className="min-h-screen bg-black text-white p-6 lg:p-12">
            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Header */}
                <div className="space-y-2 border-b border-white/10 pb-6">
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-zinc-400">Manage your player preferences and app configuration.</p>
                </div>

                {/* Form Component */}
                <SettingsForm />
            </div>
        </div>
    );
}
