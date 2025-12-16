import { GoogleGenAI } from "@google/genai";
import { Student, Assignment } from "../types";

// --- API KEY MANAGEMENT ---

// Helper to sanitize API Key
const getApiKey = () => {
  // CLAVE ACTUALIZADA MANUALMENTE: Proyecto "Prueba APP"
  // Se utiliza esta clave directamente para garantizar acceso a la API de Drive
  return "AIzaSyCJJPq0Q2fVCH5L9VI1_VXT2vpa48vjd_o";
};

const getAi = () => {
  const apiKey = getApiKey();
  return new GoogleGenAI({ apiKey });
};

// --- HELPERS ---

export const extractStudentInfo = (folderName: string): { name: string, id: string | null } => {
    let processedName = folderName
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/_/g, ' ')
        .replace(/-/g, ' ');
    
    const idMatch = processedName.match(/(\d{5,10})/);
    let studentId: string | null = null;
    let studentName = "Unknown Student";

    if (idMatch) {
        studentId = idMatch[1];
        processedName = processedName.replace(studentId, '').trim();
    }

    const cleanupTerms = [
        'assignsubmission file', 'assignsubmission', 'file', 
        'tarea', 'trabajo grupal', 'atrasado', 'copia' 
        // Removed 'de' to protect names like "De La Cruz"
    ];
    cleanupTerms.forEach(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'g');
        processedName = processedName.replace(regex, '');
    });

    processedName = processedName.replace(/\s+/g, ' ').trim();
    if (processedName.length > 0) {
        studentName = processedName.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    return { name: studentName, id: studentId };
};

const extractGoogleId = (url: string): string | null => {
    const patterns = [
        /\/d\/([a-zA-Z0-9-_]+)/,        // Standard File/Folder
        /folders\/([a-zA-Z0-9-_]+)/,    // Folders
        /id=([a-zA-Z0-9-_]+)/,          // ID param
        /open\?id=([a-zA-Z0-9-_]+)/,    // Open param
        /^([a-zA-Z0-9-_]+)$/            // Raw ID
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    return null;
};

// --- DRIVE API SERVICE ---

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
}

/**
 * Fetches files directly from Google Drive API.
 */
const fetchDriveFiles = async (folderId: string): Promise<DriveFile[]> => {
    const apiKey = getApiKey();
    const safeFolderId = folderId.replace(/[^a-zA-Z0-9-_]/g, ""); 

    const baseUrl = "https://www.googleapis.com/drive/v3/files";
    
    const query = `'${safeFolderId}' in parents and trashed = false`;
    
    const params = new URLSearchParams({
        q: query,
        key: apiKey,
        fields: 'files(id,name,mimeType)',
        pageSize: '1000'
    });

    const url = `${baseUrl}?${params.toString()}`;

    // Standard headers
    const headers = {
        'Accept': 'application/json'
    };

    // 'no-referrer' helps prevent 403 errors if the key has strict referrer restrictions
    const response = await fetch(url, { 
        method: 'GET', 
        headers,
        referrerPolicy: 'no-referrer' 
    });
    
    if (!response.ok) {
        let errorDetails = "";
        try {
            const json = await response.json();
            errorDetails = json.error?.message || JSON.stringify(json.error);
        } catch (e) {
            errorDetails = response.statusText;
        }

        const msg = `Drive API Error (${response.status}): ${errorDetails}`;
        console.error(msg);

        if (response.status === 403) {
            throw new Error(`PERMISO DENEGADO (403): La clave configurada es válida, pero el servicio "Google Drive API" no está activado en Google Cloud Console para esta clave.`);
        }
        
        if (response.status === 400) {
            if (errorDetails.includes("API key not valid") || errorDetails.includes("API Key rechazada")) {
                 throw new Error("ERROR DE CLAVE (400): La API Key configurada ha sido rechazada por Google. Verifica que no tenga restricciones de IP incorrectas.");
            }
            throw new Error(`Error 400 (Petición Incorrecta): ${errorDetails}`);
        }
        
        if (response.status === 404) {
            throw new Error("CARPETA NO ENCONTRADA (404). Verifica que el enlace es correcto y que la carpeta es pública (Cualquiera con el enlace).");
        }
        
        throw new Error(msg);
    }

    const data = await response.json();
    return data.files || [];
};

export const scanRootFolder = async (input: string): Promise<Assignment[]> => {
  const driveId = extractGoogleId(input);
  if (!driveId) {
      throw new Error("No se pudo identificar un ID de carpeta válido.");
  }
  
  // 1. Fetch Root Content
  let rootFiles: DriveFile[] = [];
  try {
      rootFiles = await fetchDriveFiles(driveId);
  } catch (e: any) {
      throw e; 
  }

  if (rootFiles.length === 0) return [];

  const folderMime = "application/vnd.google-apps.folder";
  
  // 2. Scan Structure
  // Look for sub-folders that look like tasks
  let taskFolders = rootFiles.filter(f => 
      f.mimeType === folderMime && 
      (f.name.toLowerCase().includes("tarea") || 
       f.name.toLowerCase().includes("trabajo") || 
       f.name.toLowerCase().includes("lab") ||
       f.name.match(/^(task|assignment|deber)\s*\d+/i))
  );

  const assignments: Assignment[] = [];

  if (taskFolders.length > 0) {
      for (const task of taskFolders) {
          try {
              const studentFiles = await fetchDriveFiles(task.id);
              const studentNames = studentFiles.map(f => f.name);
              assignments.push({
                  id: task.id,
                  name: task.name,
                  driveLink: `https://drive.google.com/drive/folders/${task.id}`,
                  submittedStudents: studentNames,
                  maxPoints: 20
              });
          } catch (e) {
              console.warn(`Skipping task folder ${task.name} due to error`, e);
          }
      }
  } else {
      const studentNames = rootFiles.map(f => f.name);
      assignments.push({
          id: driveId,
          name: "Tarea (Carpeta Principal)",
          driveLink: `https://drive.google.com/drive/folders/${driveId}`,
          submittedStudents: studentNames,
          maxPoints: 20
      });
  }

  return assignments;
};

// Fallback wrapper for UI compatibility
export const parseAssignmentStructure = async (input: string, inputType: 'url' | 'text' | 'image'): Promise<Assignment[]> => {
    if (inputType === 'url' || input.startsWith('http')) {
        return await scanRootFolder(input);
    }
    return []; 
};

// --- SHEET PARSING (Unchanged) ---
const fetchGvizData = async (sheetId: string): Promise<string | null> => {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const txt = await response.text();
        const jsonString = txt.substring(txt.indexOf("{"), txt.lastIndexOf("}") + 1);
        const data = JSON.parse(jsonString);
        let csvMock = "";
        if (data.table && data.table.rows) {
            data.table.rows.forEach((row: any) => {
                const line = row.c.map((cell: any) => cell ? (cell.v || "") : "").join(" | ");
                csvMock += line + "\n";
            });
        }
        return csvMock.length > 10 ? csvMock : null;
    } catch (e) { return null; }
};

export const parseStudentList = async (input: string): Promise<Student[]> => {
  const ai = getAi();
  const isUrl = input.trim().startsWith('http');
  const sheetId = isUrl ? extractGoogleId(input) : null;
  
  let contentToProcess = input;
  let useSearchTool = false;

  if (isUrl && sheetId) {
      const gvizData = await fetchGvizData(sheetId);
      if (gvizData) {
          contentToProcess = gvizData;
      } else {
          useSearchTool = true;
          contentToProcess = input.replace(/\/edit.*$/, '/htmlview').replace(/\/preview.*$/, '/htmlview');
      }
  }

  const prompt = `
    SYSTEM: You are a data extraction engine.
    TASK: Extract the student roster.
    CRITICAL: Return pure text, one student per line. Format: ID | LastName | FirstName.
    DATA SOURCE: ${useSearchTool ? `Navigate to this URL: ${contentToProcess}` : contentToProcess.substring(0, 30000)}
  `;

  const config: any = {};
  if (useSearchTool) config.tools = [{ googleSearch: {} }];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config
  });

  const text = response.text || "";
  const students: Student[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 2) {
          let id = "N/A";
          let lastName = parts[0];
          let firstName = parts[1];
          if (/^\d+$/.test(parts[0]) || parts[0].length > 6) {
              id = parts[0];
              lastName = parts[1] || "";
              firstName = parts[2] || "";
          }
          if (lastName.toLowerCase().includes("apellido") || id.toLowerCase().includes("id")) continue;
          if (lastName && firstName) {
              students.push({
                  id,
                  lastName,
                  firstName,
                  rawText: `${firstName} ${lastName} ${id}`
              });
          }
      }
  }
  if (students.length === 0) throw new Error("NO_DATA_FOUND");
  return students;
};
