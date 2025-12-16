import { utils, writeFile } from 'xlsx';
import { Student, Assignment } from '../types';

export const normalize = (str: string) => {
  return str
      .toLowerCase()
      .replace(/ñ/g, 'n')
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9]/g, " ") // Replace non-alphanumeric with space
      .replace(/\s+/g, " ")
      .trim();
};

export const checkMatch = (student: Student, folderName: string) => {
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

  // Fallback: If ALL surnames match (and there are at least 2), accept it even without first name match (rare but possible)
  if (matchedLast === lastNameTokens.length && lastNameTokens.length >= 2) {
      return true; 
  }

  return false;
};

export const downloadExcel = (students: Student[], assignments: Assignment[]) => {
  // 1. Preparar los datos en formato JSON plano para la hoja
  const data = students.map(student => {
    const row: Record<string, string | number> = {
      'Cédula': student.id,
      'Apellidos': student.lastName,
      'Nombres': student.firstName
    };

    let totalScore = 0;

    // Agregar columnas dinámicas por cada tarea
    assignments.forEach(assignment => {
      const isSubmitted = assignment.submittedStudents.some(folderName => checkMatch(student, folderName));
      const grade = isSubmitted ? 20 : 0;
      row[assignment.name] = grade;
      totalScore += grade;
    });

    row['NOTA FINAL'] = totalScore;
    return row;
  });

  // 2. Crear Hoja de Cálculo
  const worksheet = utils.json_to_sheet(data);

  // 3. Ajustar ancho de columnas para mejor legibilidad
  const wscols = [
    { wch: 15 }, // Cédula
    { wch: 25 }, // Apellidos
    { wch: 25 }, // Nombres
    ...assignments.map(() => ({ wch: 15 })), // Tareas
    { wch: 12 }  // Nota Final
  ];
  worksheet['!cols'] = wscols;

  // 4. Crear Libro y Agregar Hoja
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Calificaciones");

  // 5. Descargar archivo .xlsx
  writeFile(workbook, "Reporte_Calificaciones.xlsx");
};