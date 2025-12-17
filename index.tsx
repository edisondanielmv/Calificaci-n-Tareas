import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { utils, writeFile } from 'xlsx';
import { 
  Users, Loader2, FolderOpen, ArrowRight, Link as LinkIcon, AlertCircle, 
  CheckCircle2, Layers, Key, Plus, Trash2, Check, X, FileSpreadsheet, 
  RotateCcw, FileQuestion, GraduationCap, Lock, ShieldAlert 
} from 'lucide-react';

// --- TYPES ---

export interface Student {
  id: string; 
  firstName: string;
  lastName: string;
  rawText: string;
}

export interface Assignment {
  id: string;
  name: string;
  driveLink?: string;
  submittedStudents: string[];
  maxPoints: number;
}

export enum AppStep {
  LOGIN = -1,
  SETUP = 0,
  RESULTS = 1
}

// --- UTILS ---

const normalize = (str: string) => {
  return str
      .toLowerCase()
      .replace(/ñ/g, 'n')
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
};

const checkMatch = (student: Student, folderName: string) => {
  const normFolder = normalize(folderName);
  const folderTokens = new Set(normFolder.split(" ")); 

  const cleanId = student.id.trim();
  if (cleanId.length > 4 && normFolder.includes(cleanId)) {
      return true;
  }

  const firstNameTokens = normalize(student.firstName).split(" ").filter(t => t.length > 1);
  const lastNameTokens = normalize(student.lastName).split(" ").filter(t => t.length > 1);

  const matchedLast = lastNameTokens.filter(token => {
      return folderTokens.has(token) || Array.from(folderTokens).some(ft => ft.includes(token));
  }).length;

  const matchedFirst = firstNameTokens.filter(token => {
      return folderTokens.has(token) || Array.from(folderTokens).some(ft => ft.includes(token));
  }).length;
  
  const hasLastNameMatch = matchedLast > 0;
  const hasFirstNameMatch = matchedFirst > 0;

  if (hasLastNameMatch && hasFirstNameMatch) {
      return true;
  }

  if (matchedLast === lastNameTokens.length && lastNameTokens.length >= 2) {
      return true; 
  }

  return false;
};

const downloadExcel = (students: Student[], assignments: Assignment[]) => {
  const data = students.map(student => {
    const row: Record<string, string | number> = {
      'Cédula': student.id,
      'Apellidos': student.lastName,
      'Nombres': student.firstName
    };

    let totalScore = 0;
    assignments.forEach(assignment => {
      const isSubmitted = assignment.submittedStudents.some(folderName => checkMatch(student, folderName));
      const grade = isSubmitted ? 20 : 0;
      row[assignment.name] = grade;
      totalScore += grade;
    });

    row['NOTA FINAL'] = totalScore;
    return row;
  });

  const worksheet = utils.json_to_sheet(data);
  const wscols = [
    { wch: 15 }, 
    { wch: 25 }, 
    { wch: 25 }, 
    ...assignments.map(() => ({ wch: 15 })), 
    { wch: 12 }  
  ];
  worksheet['!cols'] = wscols;

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Calificaciones");
  writeFile(workbook, "Reporte_Calificaciones.xlsx");
};

// --- SERVICES ---

const getApiKey = () => "AIzaSyCJJPq0Q2fVCH5L9VI1_VXT2vpa48vjd_o";

const getAi = () => {
  const apiKey = getApiKey();
  return new GoogleGenAI({ apiKey });
};

const extractGoogleId = (url: string): string | null => {
    const patterns = [
        /\/d\/([a-zA-Z0-9-_]+)/,        
        /folders\/([a-zA-Z0-9-_]+)/,    
        /id=([a-zA-Z0-9-_]+)/,          
        /open\?id=([a-zA-Z0-9-_]+)/,    
        /^([a-zA-Z0-9-_]+)$/            
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    return null;
};

const fetchDriveFiles = async (folderId: string): Promise<any[]> => {
    const apiKey = getApiKey();
    const safeFolderId = folderId.replace(/[^a-zA-Z0-9-_]/g, ""); 
    const baseUrl = "https://www.googleapis.com/drive/v3/files";
    const query = `'${safeFolderId}' in parents and trashed = false`;
    const params = new URLSearchParams({
        q: query, key: apiKey, fields: 'files(id,name,mimeType)', pageSize: '1000'
    });

    const response = await fetch(`${baseUrl}?${params.toString()}`, { 
        method: 'GET', headers: { 'Accept': 'application/json' }, referrerPolicy: 'no-referrer' 
    });
    
    if (!response.ok) {
        let errorDetails = "";
        try { const json = await response.json(); errorDetails = json.error?.message; } catch (e) {}
        if (response.status === 403) throw new Error("PERMISO DENEGADO (403): API Drive no habilitada o clave inválida.");
        throw new Error(`Drive API Error (${response.status}): ${errorDetails}`);
    }
    const data = await response.json();
    return data.files || [];
};

const scanRootFolder = async (input: string): Promise<Assignment[]> => {
  const driveId = extractGoogleId(input);
  if (!driveId) throw new Error("No se pudo identificar un ID de carpeta válido.");
  
  const rootFiles = await fetchDriveFiles(driveId);
  if (rootFiles.length === 0) return [];

  const folderMime = "application/vnd.google-apps.folder";
  let taskFolders = rootFiles.filter(f => 
      f.mimeType === folderMime && 
      (f.name.toLowerCase().includes("tarea") || f.name.toLowerCase().includes("trabajo") || f.name.match(/^(task|assignment|deber)\s*\d+/i))
  );

  const assignments: Assignment[] = [];
  if (taskFolders.length > 0) {
      for (const task of taskFolders) {
          try {
              const studentFiles = await fetchDriveFiles(task.id);
              assignments.push({
                  id: task.id, name: task.name, driveLink: `https://drive.google.com/drive/folders/${task.id}`,
                  submittedStudents: studentFiles.map(f => f.name), maxPoints: 20
              });
          } catch (e) {}
      }
  } else {
      assignments.push({
          id: driveId, name: "Tarea (Carpeta Principal)", driveLink: `https://drive.google.com/drive/folders/${driveId}`,
          submittedStudents: rootFiles.map(f => f.name), maxPoints: 20
      });
  }
  return assignments;
};

const parseStudentList = async (input: string): Promise<Student[]> => {
  const ai = getAi();
  const isUrl = input.trim().startsWith('http');
  const sheetId = isUrl ? extractGoogleId(input) : null;
  
  let contentToProcess = input;
  let useSearchTool = false;

  if (isUrl && sheetId) {
     try {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
        const res = await fetch(url);
        if (res.ok) {
            const txt = await res.text();
            const jsonString = txt.substring(txt.indexOf("{"), txt.lastIndexOf("}") + 1);
            const data = JSON.parse(jsonString);
            let csvMock = "";
            data.table?.rows?.forEach((row: any) => {
                csvMock += row.c.map((cell: any) => cell ? (cell.v || "") : "").join(" | ") + "\n";
            });
            contentToProcess = csvMock;
        } else {
             useSearchTool = true;
             contentToProcess = input.replace(/\/edit.*$/, '/htmlview');
        }
     } catch(e) { useSearchTool = true; }
  }

  const prompt = `SYSTEM: Extract student roster. Return text. One student per line: ID | LastName | FirstName.\nDATA: ${contentToProcess.substring(0, 30000)}`;
  const config: any = {};
  if (useSearchTool) config.tools = [{ googleSearch: {} }];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', contents: prompt, config
  });

  const students: Student[] = [];
  (response.text || "").split('\n').forEach(line => {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 2) {
          if (/^\d+$/.test(parts[0]) || parts[0].length > 5) {
               students.push({ id: parts[0], lastName: parts[1] || "", firstName: parts[2] || "", rawText: line });
          }
      }
  });
  if (students.length === 0) throw new Error("NO_DATA_FOUND");
  return students;
};

// --- COMPONENTS ---

const LoginGate: React.FC<{ onLoginSuccess: () => void }> = ({ onLoginSuccess }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [hasLoggedIn, setHasLoggedIn] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('drive_grader_session') === 'active') onLoginSuccess();
  }, [onLoginSuccess]);

  const handleLoginClick = () => {
    setIsChecking(true);
    window.open('https://accounts.google.com/ServiceLogin?service=wise&passive=1209600&continue=https://drive.google.com', '_blank');
    setTimeout(() => { setHasLoggedIn(true); setIsChecking(false); localStorage.setItem('drive_grader_session', 'active'); }, 2000);
  };

  return (
    <div className="max-w-md mx-auto mt-12 animate-fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center space-y-6">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><Lock size={40} /></div>
        <div className="space-y-2"><h2 className="text-2xl font-bold text-slate-900">Acceso Seguro</h2><p className="text-slate-500">Inicia sesión en Google para permitir acceso.</p></div>
        {!hasLoggedIn ? (
            <button onClick={handleLoginClick} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg">
                {isChecking ? 'Verificando...' : 'Iniciar Sesión en Google'}
            </button>
        ) : (
            <button onClick={() => { localStorage.setItem('drive_grader_session', 'active'); onLoginSuccess(); }} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg">
                Continuar
            </button>
        )}
      </div>
    </div>
  );
};

const StudentList: React.FC<{ setStudents: (s: Student[]) => void; setAssignments: (a: Assignment[]) => void; onNext: () => void; }> = ({ setStudents, setAssignments, onNext }) => {
  const [studentInput, setStudentInput] = useState('');
  const [assignmentInput, setAssignmentInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [previewAssignments, setPreviewAssignments] = useState<Assignment[]>([]);
  const [tempStudents, setTempStudents] = useState<Student[]>([]);

  const handleAnalyze = async () => {
      if (!studentInput.trim() || !assignmentInput.trim()) { setError("Ingresa ambos enlaces."); return; }
      setLoading(true); setError(null); setPreviewAssignments([]);
      try {
          setStatus("Procesando lista...");
          const parsedStudents = tempStudents.length ? tempStudents : await parseStudentList(studentInput);
          setTempStudents(parsedStudents);
          setStatus("Escaneando Drive...");
          const results = await scanRootFolder(assignmentInput);
          if (results.length === 0) throw new Error("Carpeta vacía o sin acceso.");
          setPreviewAssignments(results);
          setStatus("Listo.");
      } catch(e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 space-y-6">
        <div>
            <label className="block text-sm font-bold mb-2">1. Lista de Estudiantes (Sheets)</label>
            <input type="text" className="w-full p-3 border rounded-lg" placeholder="https://docs.google.com/spreadsheets/..." value={studentInput} onChange={(e) => setStudentInput(e.target.value)} />
        </div>
        <div>
            <label className="block text-sm font-bold mb-2">2. Carpeta de Drive</label>
            <input type="text" className="w-full p-3 border rounded-lg" placeholder="https://drive.google.com/..." value={assignmentInput} onChange={(e) => setAssignmentInput(e.target.value)} />
        </div>
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        {previewAssignments.length > 0 && (
            <div className="bg-emerald-50 p-4 rounded-lg text-emerald-800 text-sm">
                <b>{previewAssignments.length} Tareas encontradas.</b>
                <div className="mt-2 space-y-1">{previewAssignments.map(t => <div key={t.id}>{t.name} ({t.submittedStudents.length})</div>)}</div>
            </div>
        )}
        {previewAssignments.length === 0 ? (
            <button onClick={handleAnalyze} disabled={loading} className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold">
                {loading ? `Cargando... ${status}` : 'Escanear'}
            </button>
        ) : (
            <button onClick={() => { setStudents(tempStudents); setAssignments(previewAssignments); onNext(); }} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold">
                Generar Reporte
            </button>
        )}
      </div>
    </div>
  );
};

const GraderView: React.FC<{ students: Student[]; assignments: Assignment[]; onBack: () => void; }> = ({ students, assignments, onBack }) => {
  return (
    <div className="space-y-6 animate-fade-in pb-10">
       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Resultados</h2>
          <button onClick={() => downloadExcel(students, assignments)} className="px-4 py-2 bg-green-700 text-white rounded-lg font-bold text-sm flex gap-2">
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>
        </div>
        <div className="overflow-x-auto border rounded-lg max-h-[60vh]">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 font-bold">
              <tr>
                <th className="p-3">Estudiante</th>
                {assignments.map(a => <th key={a.id} className="p-3 text-center">{a.name}</th>)}
                <th className="p-3 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                let total = 0;
                return (
                <tr key={s.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-medium">{s.lastName} {s.firstName}</td>
                  {assignments.map(a => {
                    const ok = a.submittedStudents.some(f => checkMatch(s, f));
                    const score = ok ? 20 : 0;
                    total += score;
                    return <td key={a.id} className="p-3 text-center">{ok ? <Check size={16} className="text-green-600 inline" /> : <span className="text-slate-300">-</span>}</td>;
                  })}
                  <td className="p-3 text-center font-bold text-indigo-700">{total}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
      <button onClick={onBack} className="text-slate-500 hover:text-indigo-600 text-sm font-medium">Volver al inicio</button>
    </div>
  );
};

// --- MAIN APP ---

function App() {
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white"><GraduationCap size={20} /></div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">DriveGrader AI</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">
        {step === AppStep.LOGIN && <LoginGate onLoginSuccess={() => setStep(AppStep.SETUP)} />}
        {step === AppStep.SETUP && <StudentList setStudents={setStudents} setAssignments={setAssignments} onNext={() => setStep(AppStep.RESULTS)} />}
        {step === AppStep.RESULTS && <GraderView students={students} assignments={assignments} onBack={() => setStep(AppStep.SETUP)} />}
      </main>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
