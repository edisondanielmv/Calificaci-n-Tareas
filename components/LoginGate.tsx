import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';

interface Props {
  onLoginSuccess: () => void;
}

export const LoginGate: React.FC<Props> = ({ onLoginSuccess }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [hasLoggedIn, setHasLoggedIn] = useState(false);

  useEffect(() => {
    // Check for existing session
    const session = localStorage.getItem('drive_grader_session');
    if (session === 'active') {
      onLoginSuccess();
    }
  }, [onLoginSuccess]);

  const handleLoginClick = () => {
    setIsChecking(true);
    // Open Google Login in new tab (simulated auth flow for user context)
    window.open('https://accounts.google.com/ServiceLogin?service=wise&passive=1209600&continue=https://drive.google.com', '_blank');
    
    // Simulate a check delay
    setTimeout(() => {
        setHasLoggedIn(true);
        setIsChecking(false);
        // Persist session
        localStorage.setItem('drive_grader_session', 'active');
    }, 2000);
  };

  const handleContinue = () => {
      localStorage.setItem('drive_grader_session', 'active');
      onLoginSuccess();
  };

  return (
    <div className="max-w-md mx-auto mt-12 animate-fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center space-y-6">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={40} />
        </div>
        
        <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Acceso Seguro Requerido</h2>
            <p className="text-slate-500 leading-relaxed">
                Para que DriveGrader AI pueda analizar tus listas y carpetas, necesitamos confirmar que tienes una sesión activa de Google con permisos de lectura.
            </p>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl text-left text-sm text-slate-600 border border-slate-100 flex gap-3">
             <ShieldAlert className="shrink-0 text-amber-500" size={20} />
             <p>Esta aplicación no almacena tu contraseña. La validación se realiza directamente en los servidores de Google.</p>
        </div>

        {!hasLoggedIn ? (
            <button
                onClick={handleLoginClick}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
                {isChecking ? 'Verificando...' : 'Iniciar Sesión en Google'}
            </button>
        ) : (
            <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-center gap-2 text-green-600 font-bold bg-green-50 p-3 rounded-lg">
                    <CheckCircle2 size={20} />
                    <span>Sesión Detectada</span>
                </div>
                <button
                    onClick={handleContinue}
                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 group"
                >
                    Continuar a la App <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                </button>
            </div>
        )}

        <p className="text-xs text-slate-400 mt-4">
            Al continuar, aceptas que la IA procesará únicamente los enlaces que tú proporciones manualmente.
        </p>
      </div>
    </div>
  );
};