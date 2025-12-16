import React, { useState } from 'react';
import { Student, Assignment, AppStep } from './types';
import { StudentList } from './components/StudentList';
import { GraderView } from './components/GraderView';
import { LoginGate } from './components/LoginGate';
import { GraduationCap } from 'lucide-react';

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const renderStep = () => {
    switch (step) {
      case AppStep.LOGIN:
        return <LoginGate onLoginSuccess={() => setStep(AppStep.SETUP)} />;
      case AppStep.SETUP:
        return (
          <StudentList 
            setStudents={setStudents}
            setAssignments={setAssignments}
            onNext={() => setStep(AppStep.RESULTS)} 
          />
        );
      case AppStep.RESULTS:
        return (
          <GraderView 
            students={students} 
            assignments={assignments}
            onBack={() => {
              setStudents([]);
              setAssignments([]);
              setStep(AppStep.SETUP);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <GraduationCap size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              DriveGrader AI
            </h1>
          </div>
          
          {step !== AppStep.LOGIN && (
            <div className="flex items-center gap-2">
               <div className="flex gap-1">
                  <div className={`h-2 w-8 rounded-full ${step === AppStep.SETUP ? 'bg-blue-600' : 'bg-slate-200'}`} />
                  <div className={`h-2 w-8 rounded-full ${step === AppStep.RESULTS ? 'bg-green-500' : 'bg-slate-200'}`} />
               </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {!process.env.API_KEY && (
           <div className="mb-6 p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200">
             <strong>Advertencia:</strong> No se detectó la API Key en el entorno (process.env.API_KEY). 
             La aplicación podría no funcionar correctamente si no está configurada.
           </div>
        )}
        
        {renderStep()}
      </main>
    </div>
  );
}