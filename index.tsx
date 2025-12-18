import React, { useState, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from 'xlsx';
import { 
  Users, Loader2, FolderOpen, ArrowRight, AlertCircle, 
  Check, X, FileSpreadsheet, RotateCcw, GraduationCap, 
  Download, ExternalLink, ShieldCheck
} from 'lucide-react';

// --- TYPES ---
interface Student {
  id: string;
  fullName: string;
}

interface FileRef {
  name: string;
  id: string;
}

interface Assignment {
  title: string;
  files: FileRef[];
}

// --- HELPERS ---
const extractDriveId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
};

const normalize = (str: string): string => 
  String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .trim();

const fuzzyMatch = (student: Student, fileName: string): boolean => {
  const sName = normalize(student.fullName);
  const fName = normalize(fileName);
  const sId = normalize(student.id);
  
  // 1. Check ID in filename
  if (sId.length > 3 && fName.includes(sId)) return true;
  
  // 2. Token based matching
  const tokens = sName.split(/\s+/).filter(t => t.length > 2);
  if (tokens.length === 0) return false;
  
  const matches = tokens.filter(t => fName.includes(t));
  // Matches at least 2 significant tokens (e.g. one name and one surname)
  return matches.length >= 2 || (tokens.length === 1 && matches.length === 1);
};

// --- APP ---
const App: React.FC = () => {
  const [view, setView] = useState<'setup' | 'results'>('setup');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const startAnalysis = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const sheetUrl = String(formData.get('sheetUrl') || '');
    const driveUrl = String(formData.get('driveUrl') || '');

    const sId = extractDriveId(sheetUrl);
    const dId = extractDriveId(driveUrl);

    if (!sId || !dId) {
      setError("Por favor, introduce enlaces válidos de Google Sheets y Google Drive.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus("Conectando con Google...");

    try {
      const apiKey = process.env.API_KEY || "";
      const ai = new GoogleGenAI({ apiKey });

      // 1. Obtener datos de la nómina
      setStatus("Obteniendo nómina de estudiantes...");
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${sId}/gviz/tq?tqx=out:json`;
      const sRes = await fetch(gvizUrl);
      if (!sRes.ok) throw new Error("No se pudo conectar con la hoja de cálculo. Verifica tu conexión.");
      
      const sText = await sRes.text();
      const match = sText.match(/\{.*\}/);
      if (!match) throw new Error("No se pudo acceder a los datos de la hoja. Verifica que sea pública (Cualquier persona con el enlace).");
      
      const tableData = JSON.parse(match[0]);
      const rawRows = tableData.table.rows.map((r: any) => 
        (r.c || []).map((cell: any) => cell?.v || "").join(" | ")
      ).join("\n");

      // 2. Procesar con Gemini para obtener lista limpia
      setStatus("IA analizando estructura de nombres...");
      const prompt = `Analiza esta lista de estudiantes y devuelve un array JSON con objetos {id, fullName}. Extrae el número de identificación (cédula) y el nombre completo. Ignora encabezados. Datos:\n${rawRows}`;
      
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                fullName: { type: Type.STRING }
              },
              required: ["id", "fullName"]
            }
          }
        }
      });

      const parsedStudents = JSON.parse(aiResponse.text || "[]") as Student[];
      if (parsedStudents.length === 0) throw new Error("No se detectaron estudiantes en la hoja.");

      // 3. Escanear Drive
      setStatus("Escaneando carpetas de entregas...");
      const listFiles = async (folderId: string) => {
        const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&key=${apiKey}&fields=files(id,name,mimeType)`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Error al acceder a Google Drive. ¿La carpeta es pública?");
        const data = await res.json();
        return data.files || [];
      };

      const rootFiles = await listFiles(dId);
      const subfolders = rootFiles.filter((f: any) => f.mimeType === "application/vnd.google-apps.folder");
      
      const foundAssignments: Assignment[] = [];
      if (subfolders.length > 0) {
        for (const f of subfolders) {
          const files = await listFiles(f.id);
          foundAssignments.push({ 
            title: String(f.name), 
            files: files.map((file: any) => ({ name: String(file.name), id: String(file.id) })) 
          });
        }
      } else {
        foundAssignments.push({ 
          title: "Entregas Directas", 
          files: rootFiles.map((file: any) => ({ name: String(file.name), id: String(file.id) })) 
        });
      }

      setStudents(parsedStudents);
      setAssignments(foundAssignments);
      setView('results');
    } catch (err: any) {
      console.error("Error details:", err);
      // Ensure error is a string
      setError(err?.message ? String(err.message) : "Error desconocido durante el procesamiento.");
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const exportExcel = useCallback(() => {
    try {
      const data = students.map(s => {
        const row: any = { "ID": s.id, "Estudiante": s.fullName };
        let total = 0;
        assignments.forEach(a => {
          const submitted = a.files.some(f => fuzzyMatch(s, f.name));
          row[a.title] = submitted ? 20 : 0;
          total += submitted ? 20 : 0;
        });
        row["TOTAL"] = total;
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Calificaciones");
      XLSX.writeFile(wb, `Reporte_Notas_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Error al exportar a Excel.");
    }
  }, [students, assignments]);

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8">
      {/* Header */}
      <nav className="max-w-6xl w-full mx-auto flex justify-between items-center mb-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-200">
            <GraduationCap size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">DriveGrader <span className="text-blue-600">AI</span></h1>
        </div>
        {view === 'results' && (
          <button 
            onClick={() => setView('setup')}
            className="text-sm font-medium text-slate-500 hover:text-blue-600 flex items-center gap-2 transition-all px-4 py-2 hover:bg-white rounded-lg"
          >
            <RotateCcw size={16} /> Nuevo Análisis
          </button>
        )}
      </nav>

      <main className="max-w-6xl w-full mx-auto flex-1">
        {view === 'setup' ? (
          <div className="max-w-xl mx-auto space-y-8 py-10">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-extrabold text-slate-900">Automatiza tus notas</h2>
              <p className="text-slate-500 text-lg">Compara tu nómina con archivos entregados en Drive de forma inteligente.</p>
            </div>

            <form onSubmit={startAnalysis} className="glass p-8 md:p-10 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">
                    <FileSpreadsheet size={14} className="text-blue-500" /> 1. Enlace de la Nómina (Sheets)
                  </label>
                  <input 
                    required
                    name="sheetUrl"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full p-4 bg-white border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2 px-1">
                    <FolderOpen size={14} className="text-emerald-500" /> 2. Carpeta de Entregas (Drive)
                  </label>
                  <input 
                    required
                    name="driveUrl"
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="w-full p-4 bg-white border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm flex gap-3 items-center">
                  <AlertCircle size={20} className="shrink-0" />
                  <span className="font-medium">{String(error)}</span>
                </div>
              )}

              {loading ? (
                <div className="space-y-4">
                  <div className="loading-bar"><div className="loading-bar-inner"></div></div>
                  <p className="text-center text-sm font-semibold text-blue-600 animate-pulse uppercase tracking-widest">
                    {String(status)}
                  </p>
                </div>
              ) : (
                <button 
                  type="submit"
                  className="w-full py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98]"
                >
                  Procesar con IA <ArrowRight size={20} />
                </button>
              )}

              <div className="pt-4 border-t flex items-center gap-2 text-slate-400 justify-center">
                <ShieldCheck size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Seguridad de Datos Activa</span>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-3xl border border-slate-100 shadow-sm gap-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Análisis Finalizado</h2>
                <p className="text-slate-500">Sincronización exitosa entre Nómina ({students.length}) y Drive ({assignments.length} actividades).</p>
              </div>
              <button 
                onClick={exportExcel}
                className="w-full md:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 transition-all active:scale-95"
              >
                <Download size={20} /> Descargar Reporte (.xlsx)
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="p-6 font-bold text-slate-400 text-[10px] uppercase tracking-widest border-b">Estudiante</th>
                      {assignments.map((a, i) => (
                        <th key={i} className="p-6 font-bold text-slate-400 text-[10px] uppercase tracking-widest text-center border-b">
                          {String(a.title)}
                        </th>
                      ))}
                      <th className="p-6 font-bold text-blue-600 text-[10px] uppercase tracking-widest text-center border-b bg-blue-50/50">Calificación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((s, idx) => {
                      let total = 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-6">
                            <p className="font-bold text-slate-800">{String(s.fullName)}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-1 tracking-tighter">{String(s.id)}</p>
                          </td>
                          {assignments.map((a, i) => {
                            const submitted = a.files.some(f => fuzzyMatch(s, f.name));
                            if (submitted) total += 20;
                            return (
                              <td key={i} className="p-6 text-center">
                                {submitted ? (
                                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm ring-4 ring-emerald-50">
                                    <Check size={18} strokeWidth={3} />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto opacity-40">
                                    <X size={18} strokeWidth={2.5} />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-6 text-center bg-blue-50/20">
                            <span className="text-xl font-black text-blue-700">{total}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-6xl w-full mx-auto pt-10 pb-6 text-center">
        <p className="text-slate-300 text-[10px] font-bold uppercase tracking-[0.3em]">DriveGrader AI v2.0 — Educación Inteligente</p>
      </footer>
    </div>
  );
};

// --- RENDER ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}