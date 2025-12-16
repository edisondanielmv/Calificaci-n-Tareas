import React, { useState } from 'react';
import { Assignment, Student } from '../types';
import { parseAssignmentStructure } from '../services/gemini';
import { FolderOpen, Plus, Trash2, Loader2, Link as LinkIcon, Check, AlertCircle } from 'lucide-react';

interface Props {
  assignments: Assignment[];
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
  onNext: () => void;
  onBack: () => void;
  students: Student[];
}

export const AssignmentList: React.FC<Props> = ({ assignments, setAssignments, onNext, onBack, students }) => {
  const [newAssignmentName, setNewAssignmentName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Processing state
  const [linkInput, setLinkInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAssignment = () => {
    if (!newAssignmentName) return;
    const newAsg: Assignment = {
      id: Date.now().toString(),
      name: newAssignmentName,
      driveLink: '',
      submittedStudents: [],
      maxPoints: 20
    };
    setAssignments([...assignments, newAsg]);
    setNewAssignmentName('');
    setActiveId(newAsg.id);
    setLinkInput('');
    setError(null);
  };

  const removeAssignment = (id: string) => {
    setAssignments(assignments.filter(a => a.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const processContent = async (id: string) => {
    if (!linkInput) {
        setError("Ingresa un enlace.");
        return;
    }

    setLoading(true);
    setError(null);
    try {
      // Strict URL mode
      const result = await parseAssignmentStructure(linkInput, 'url');
      const folders = result[0]?.submittedStudents || [];
      
      if (folders.length === 0) {
          setError("No pudimos leer el enlace. Asegúrate que sea una carpeta de Drive válida.");
      } else {
          setAssignments(prev => prev.map(a => 
            a.id === id ? { ...a, submittedStudents: folders, driveLink: linkInput } : a
          ));
          if (folders.length > 0) setActiveId(null); // Close on success
      }
    } catch (e) {
      console.error(e);
      setError("Error al procesar el enlace.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6 text-slate-800">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
            <FolderOpen size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Gestión de Tareas</h2>
            <p className="text-sm text-slate-500">Agrega más carpetas para calificar múltiples tareas.</p>
          </div>
        </div>

        {/* Add New Assignment Form */}
        <div className="bg-slate-50 p-5 rounded-lg mb-6 border border-slate-100 flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre de la Nueva Tarea</label>
              <input
                type="text"
                value={newAssignmentName}
                onChange={(e) => setNewAssignmentName(e.target.value)}
                placeholder="Ej: Tarea 2 - Historia"
                className="w-full p-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button
            onClick={addAssignment}
            disabled={!newAssignmentName}
            className="py-2.5 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
          >
            <Plus size={16} /> Crear
          </button>
        </div>

        {/* List */}
        <div className="space-y-4">
          {assignments.map(assign => (
            <div key={assign.id} className="border border-slate-200 rounded-lg overflow-hidden transition-all shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white">
                <div className="flex items-start sm:items-center gap-4 mb-2 sm:mb-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${assign.submittedStudents.length > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {assign.submittedStudents.length}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{assign.name}</h4>
                    {assign.driveLink ? (
                      <a href={assign.driveLink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5 truncate max-w-[200px]">
                        <LinkIcon size={10} /> Link Guardado
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">Pendiente de enlace</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => {
                        setActiveId(activeId === assign.id ? null : assign.id);
                        setError(null);
                        setLinkInput('');
                    }}
                    className={`px-3 py-1.5 text-xs font-medium border rounded transition-colors ${assign.submittedStudents.length > 0 ? 'text-green-700 border-green-200 bg-green-50' : 'text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100'}`}
                  >
                    {assign.submittedStudents.length > 0 ? 'Revisar' : 'Vincular Carpeta'}
                  </button>
                  <button onClick={() => removeAssignment(assign.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Expansion Panel */}
              {activeId === assign.id && (
                <div className="p-4 bg-indigo-50 border-t border-indigo-100 animate-fade-in">
                   
                   <div className="mb-3">
                       <label className="text-xs font-bold text-slate-500 mb-1 block">Enlace de Google Drive</label>
                       <div className="relative">
                           <LinkIcon className="absolute left-3 top-3 text-slate-400" size={14}/>
                           <input
                            type="text"
                            value={linkInput}
                            onChange={(e) => setLinkInput(e.target.value)}
                            placeholder="https://drive.google.com/drive/folders/..."
                            className="w-full pl-9 p-2.5 border border-indigo-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                           />
                       </div>
                   </div>

                   {error && (
                       <div className="mb-3 p-2 bg-red-100 text-red-700 text-xs rounded border border-red-200 flex items-center gap-2">
                           <AlertCircle size={14}/> {error}
                       </div>
                   )}

                   <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setActiveId(null)}
                          className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => processContent(assign.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs font-bold flex items-center gap-2 shadow-sm"
                        >
                          {loading ? <Loader2 className="animate-spin" size={14}/> : 'Procesar Enlace'}
                        </button>
                   </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium text-slate-700">
          &larr; Volver
        </button>
        <button 
          onClick={onNext} 
          disabled={assignments.length === 0}
          className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 font-medium shadow-md hover:shadow-lg transition-all"
        >
          Ver Resumen &rarr;
        </button>
      </div>
    </div>
  );
};