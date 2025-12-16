export interface Student {
  id: string; // Cédula o ID
  firstName: string;
  lastName: string;
  rawText: string; // Texto original para matching difuso
}

export interface Assignment {
  id: string;
  name: string;
  driveLink?: string;
  submittedStudents: string[]; // Lista de nombres extraídos de las carpetas
  maxPoints: number;
}

export interface GradeResult {
  studentId: string;
  grades: Record<string, number>; // AssignmentID -> Score
}

export enum AppStep {
  LOGIN = -1,
  SETUP = 0,
  RESULTS = 1
}