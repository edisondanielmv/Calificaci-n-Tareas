import React from 'react';
import { Student, Assignment } from '../types';
import { downloadExcel, checkMatch } from '../utils/csv';
import { FileSpreadsheet, Check, X, RotateCcw, FileQuestion } from 'lucide-react';

interface Props {
  students: Student[];
  assignments: Assignment[];
  onBack: () => void;
}

export const GraderView: React.FC<Props> = ({ students, assignments, onBack }) => {
  
  const getGrade = (student: Student, assignment: Assignment) => {
    const isSubmitted = assignment.submittedStudents.some(folderName => checkMatch(student, folderName));
    return isSubmitted ? 20 : 0;
  };

  // Calculate Unmatched Files for debugging
  const getUnmatchedFiles = (assignment: Assignment) => {
      return assignment.submittedStudents.filter(folder => {
          return !students.some(s => checkMatch(s, folder));
      });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Reporte Final</h2>
            <p className="text-slate-500 text-sm">Resumen de calificaciones consolidado.</p>
          </div>
          <button
            onClick={() => downloadExcel(students, assignments)}
            className="px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg flex items-center gap-2 font-bold shadow-md transition-all hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <FileSpreadsheet size={20} /> Descargar Excel (.xlsx)
          </button>
        </div>

        <div className="overflow-x-auto border rounded-lg max-h-[60vh]">
          <table className="w-full text-sm text-left border-collapse relative">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-4 border-b font-semibold bg-slate-100 min-w-[200px]">Estudiante</th>
                {assignments.map(a => (
                  <th key={a.id} className="p-4 border-b font-semibold text-center min-w-[120px] bg-slate-100">
                    <div className="flex flex-col">
                      <span className="text-indigo-900 font-bold truncate max-w-[150px]" title={a.name}>{a.name}</span>
                      <span className="text-[10px] font-normal text-slate-500">{a.submittedStudents.length} entregas</span>
                    </div>
                  </th>
                ))}
                <th className="p-4 border-b font-semibold text-center min-w-[100px] bg-slate-100 text-slate-900">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map(student => {
                let totalScore = 0;
                return (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 border-r border-slate-100 bg-white sticky left-0 font-medium text-slate-900">
                    <div className="font-bold">{student.lastName}</div>
                    <div className="text-slate-600">{student.firstName}</div>
                    <div className="text-xs text-slate-400 font-mono font-normal mt-0.5">{student.id}</div>
                  </td>
                  {assignments.map(assignment => {
                    const grade = getGrade(student, assignment);
                    totalScore += grade;
                    return (
                      <td key={assignment.id} className="p-4 text-center border-r border-slate-50">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          grade > 0 ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}>
                          {grade > 0 ? <Check size={12} /> : <X size={12} />}
                          {grade}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-4 text-center font-bold text-indigo-700 bg-indigo-50/30">
                      {totalScore}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- DEBUG SECTION: UNMATCHED FILES --- */}
      {assignments.some(a => getUnmatchedFiles(a).length > 0) && (
          <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
              <div className="flex items-center gap-2 mb-4 text-orange-800">
                  <FileQuestion size={20} />
                  <h3 className="font-bold">Carpetas Sin Asignar (Revisión Manual)</h3>
              </div>
              <p className="text-sm text-orange-700 mb-4">
                  Las siguientes carpetas fueron encontradas en Drive pero no coinciden automáticamente con la lista de estudiantes (por ID o Nombre).
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {assignments.map(a => {
                      const unmatched = getUnmatchedFiles(a);
                      if (unmatched.length === 0) return null;
                      return (
                          <div key={a.id} className="bg-white p-4 rounded-lg border border-orange-100 shadow-sm flex flex-col max-h-60">
                              <h4 className="font-bold text-xs uppercase text-slate-500 mb-2 sticky top-0 bg-white pb-1 border-b border-orange-50">{a.name}</h4>
                              <ul className="space-y-1 overflow-y-auto pr-1">
                                  {unmatched.map((f, i) => (
                                      <li key={i} className="text-[10px] font-mono text-slate-600 break-all bg-slate-50 p-1.5 rounded flex flex-col">
                                          <span>{f}</span>
                                      </li>
                                  ))}
                              </ul>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      <div className="flex justify-start">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors py-2 px-4 rounded-lg hover:bg-slate-100 font-medium">
          <RotateCcw size={18} /> Iniciar Nuevo Proceso
        </button>
      </div>
    </div>
  );
};