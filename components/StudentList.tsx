import React, { useState } from 'react';
import { Student, Assignment } from '../types';
import { parseStudentList, scanRootFolder } from '../services/gemini';
import { Users, Loader2, FolderOpen, ArrowRight, Link as LinkIcon, AlertCircle, CheckCircle2, Layers, ExternalLink, Key } from 'lucide-react';

interface Props {
  setStudents: (s: Student[]) => void;
  setAssignments: (a: Assignment[]) => void;
  onNext: () => void;
}

export const StudentList: React.FC<Props> = ({ setStudents, setAssignments, onNext }) => {
  // Student State
  const [studentInput, setStudentInput] = useState('');
  
  // Assignment State
  const [assignmentInput, setAssignmentInput] = useState(''); // Drive Link Only

  // Process State
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [previewAssignments, setPreviewAssignments] = useState<Assignment[]>([]);
  const [tempStudents, setTempStudents] = useState<Student[]>([]);

  const handleAnalyze = async () => {
      if (!studentInput.trim()) { setError("Por favor, ingresa el enlace de la lista de estudiantes."); return; }
      if (!assignmentInput.trim()) { setError("Por favor, ingresa el enlace de la carpeta de Google Drive."); return; }

      setLoading(true);
      setError(null);
      setPreviewAssignments([]);
      setStatus("Iniciando análisis...");

      try {
          // 1. Process Students (if not already done)
          let parsedStudents = tempStudents;
          if (parsedStudents.length === 0) {
             setStatus("Procesando nómina de estudiantes...");
             parsedStudents = await parseStudentList(studentInput);
             setTempStudents(parsedStudents);
          }

          // 2. Process Files via Direct Drive API
          setStatus("Conectando con Google Drive...");
          
          const results = await scanRootFolder(assignmentInput);
          
          if (results.length === 0) {
              throw new Error("La carpeta parece estar vacía o no se encontraron tareas válidas.");
          }
          
          setPreviewAssignments(results);
          
          const totalSubmissions = results.reduce((acc, curr) => acc + curr.submittedStudents.length, 0);
          setStatus(`¡Éxito! Se encontraron ${results.length} tareas y ${totalSubmissions} entregas.`);

      } catch(e: any) {
          console.error(e);
          setError(e.message || "Error al procesar. Verifica que el enlace sea público y correcto.");
      } finally {
          setLoading(false);
      }
  };

  const handleConfirm = () => {
      setStudents(tempStudents);
      setAssignments(previewAssignments);
      onNext();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-2 mb-6">
        <h2 className="text-3xl font-bold text-slate-900">Importación de Datos</h2>
        <p className="text-slate-500 max-w-lg mx-auto">
          Conecta tus hojas de cálculo y carpetas de Google Drive para iniciar la calificación automática.
        </p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 space-y-8">
        
        {/* --- 1. ESTUDIANTES --- */}
        <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded">
                  <Users size={16} />
                </div>
                1. Lista de Estudiantes (Sheets/Excel Online)
            </label>
            <div className="relative group">
                <LinkIcon className="absolute left-3 top-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" size={16} />
                <input
                type="text"
                disabled={previewAssignments.length > 0}
                className="w-full pl-10 p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-300"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={studentInput}
                onChange={(e) => setStudentInput(e.target.value)}
                />
            </div>
        </div>

        <div className="border-t border-slate-100"></div>

        {/* --- 2. TAREAS --- */}
        <div className="space-y-4">
           <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded">
                  <FolderOpen size={16} />
                </div>
                2. Carpeta Principal de Drive
            </label>
          </div>

          <div className="relative animate-fade-in">
             <div className="relative group">
                <LinkIcon className="absolute left-3 top-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" size={16} />
                <input
                type="text"
                disabled={previewAssignments.length > 0}
                className="w-full pl-10 p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all placeholder:text-slate-300"
                placeholder="https://drive.google.com/drive/folders/..."
                value={assignmentInput}
                onChange={(e) => setAssignmentInput(e.target.value)}
                />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 ml-1 flex items-center gap-1">
                <Layers size={10} />
                Analiza carpetas "Tarea 1", "Tarea 2" o entregas directas.
            </p>
          </div>
        </div>

        {/* --- ERROR MESSAGE --- */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl animate-fade-in flex flex-col gap-3">
             <div className="flex items-start gap-3">
                 <AlertCircle className="shrink-0 mt-0.5 text-red-600" size={18} />
                 <div className="text-xs">
                     <p className="text-red-700 font-bold mb-1">Error de Conexión ({error.includes('403') ? '403' : '400'})</p>
                     <p className="text-red-600">{error}</p>
                 </div>
             </div>
             
             {/* API Key specific help */}
             {(error.includes("400") || error.includes("403") || error.includes("API Key") || error.includes("Drive API")) && (
                <div className="ml-8 mt-1 p-3 bg-white rounded-lg border border-red-100 text-xs text-slate-600">
                    <strong className="flex items-center gap-2 text-slate-800 mb-2">
                        <Key size={14} className="text-orange-500"/>
                        Solución: Conectar la Clave Correcta
                    </strong>
                    <p className="mb-2">
                        Habilitar la API en "Prueba APP" no sirve si la app usa una clave antigua. Sigue estos pasos:
                    </p>
                    <ol className="list-decimal ml-4 space-y-2">
                        <li>
                            Ve al proyecto <strong>"Prueba APP"</strong> en <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Cloud Console > Credenciales</a>.
                        </li>
                        <li>
                            Copia la <strong>API Key</strong> que aparece allí (asegúrate de que "Google Drive API" esté habilitada en ese proyecto).
                        </li>
                        <li className="font-bold text-slate-800">
                            Pega esa clave en tu archivo <code>.env</code> o configuración de entorno.
                        </li>
                        <li>
                            Reinicia la aplicación para que tome la nueva clave.
                        </li>
                    </ol>
                </div>
             )}
          </div>
        )}

        {/* --- PREVIEW SECTION (Batch Results) --- */}
        {previewAssignments.length > 0 && (
            <div className="animate-fade-in bg-emerald-50 rounded-xl border border-emerald-200 overflow-hidden">
                <div className="bg-emerald-100/50 p-3 flex justify-between items-center border-b border-emerald-200">
                    <h4 className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600"/> Tareas Detectadas ({previewAssignments.length})
                    </h4>
                </div>
                <div className="max-h-60 overflow-y-auto p-2 space-y-2">
                    {previewAssignments.map((task, i) => (
                        <div key={i} className="bg-white p-2.5 rounded border border-emerald-100 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-sm text-slate-700">{task.name}</span>
                                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                                    {task.submittedStudents.length} carpetas
                                </span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate font-mono">
                                {task.submittedStudents.slice(0, 3).join(', ')} {task.submittedStudents.length > 3 ? '...' : ''}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- ACTION BUTTONS --- */}
        {previewAssignments.length === 0 ? (
            <button
                onClick={handleAnalyze}
                disabled={loading}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                    loading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-xl'
                }`}
            >
                {loading ? <><Loader2 className="animate-spin" /> {status}</> : 'Conectar y Escanear'}
            </button>
        ) : (
            <div className="flex gap-3 animate-fade-in">
                 <button
                    onClick={() => { setPreviewAssignments([]); setStatus(""); setError(null); }}
                    className="w-1/3 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
                >
                    Reiniciar
                </button>
                <button
                    onClick={handleConfirm}
                    className="w-2/3 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg flex items-center justify-center gap-2 hover:shadow-xl transition-all"
                >
                    Generar Reporte <ArrowRight size={18} />
                </button>
            </div>
        )}

      </div>
    </div>
  );
};
