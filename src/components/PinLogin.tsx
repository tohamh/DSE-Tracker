import { useState, FormEvent } from "react";
import { Lock, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

interface PinLoginProps {
  onSuccess: () => void;
  defaultPin: string;
}

export default function PinLogin({ onSuccess, defaultPin }: PinLoginProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pin === defaultPin) {
      onSuccess();
    } else {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-teal-500/20 mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">DSE Record</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Enter your PIN to access your records</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              className={cn(
                "w-full bg-slate-100 dark:bg-slate-800 border-2 rounded-xl px-4 py-4 text-center text-2xl font-bold focus:outline-none transition-all",
                error 
                  ? "border-red-500 animate-shake" 
                  : "border-transparent focus:border-teal-500 text-slate-800 dark:text-white"
              )}
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-xs font-bold text-center mt-2 uppercase tracking-wider">Invalid PIN. Please try again.</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-teal-500 hover:bg-teal-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-teal-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            Unlock Access
            <ChevronRight size={20} />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Secure local-only access. Your data never leaves your device.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
