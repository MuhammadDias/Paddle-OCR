import axios from 'axios';

const API_BASE_URL = '/api';

export interface TextRegion {
  index: number;
  text: string;
  confidence: number;
  box: number[][];
}

export interface Stats {
  total_regions: number;
  average_confidence: number;
  processing_time: number;
  device: string;
  resolution: string;
}

export interface Entities {
  emails: string[];
  phones: string[];
  currencies: string[];
  urls: string[];
}

export interface OCRResponse {
  text_regions: TextRegion[];
  annotated_image: string;
  stats: Stats;
  entities: Entities;
}

export interface StatusResponse {
  status: string;
  device: string;
}

export interface User {
  id: number;
  email: string;
}

export interface AuthResponse {
  status: string;
  message: string;
  access_token: string;
  token_type: string;
  user: User;
}

export interface HistoryItem {
  id: number;
  filename: string;
  ocr_result: OCRResponse;
  created_at: string;
}

export interface PDFPageResult {
  page: number;
  source: 'text_layer' | 'ocr' | 'error';
  text: string;
  blocks: TextRegion[];
  preview_image: string;
}

export interface PDFProgressUpdate {
  status: 'start' | 'progress' | 'completed' | 'error';
  page?: number;
  total?: number;
  source?: 'text_layer' | 'ocr' | 'error';
  total_pages?: number;
  message?: string;
  results?: PDFPageResult[];
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds (useful for long OCR tasks on large files)
});

// Sematkan JWT token secara otomatis pada setiap request jika tersedia di localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Respon interceptor untuk menangani token expired (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export const checkStatus = async (): Promise<StatusResponse> => {
  const response = await api.get<StatusResponse>('/status');
  return response.data;
};

export const processOCR = async (file: File): Promise<OCRResponse> => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await api.post<OCRResponse>('/ocr', formData);
  return response.data;
};

// Auth API Calls
export const registerUser = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/register', { email, password });
  return response.data;
};

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/login', { email, password });
  return response.data;
};

export const getMe = async (): Promise<User> => {
  const response = await api.get<User>('/auth/me');
  return response.data;
};

// History API Call
export const getHistory = async (): Promise<HistoryItem[]> => {
  const response = await api.get<HistoryItem[]>('/history');
  return response.data;
};

export const processPdfOCR = async (
  file: File,
  onProgress: (update: PDFProgressUpdate) => void
): Promise<PDFPageResult[]> => {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/ocr-pdf`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = 'Gagal memproses berkas PDF.';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch (_) {}
    throw new Error(errorDetail);
  }

  if (!response.body) {
    throw new Error('Aliran respon tidak tersedia (ReadableStream not supported).');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResults: PDFPageResult[] = [];

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const update: PDFProgressUpdate = JSON.parse(line);
          onProgress(update);
          if (update.status === 'completed' && update.results) {
            finalResults = update.results;
          } else if (update.status === 'error' && update.message) {
            throw new Error(update.message);
          }
        } catch (e: any) {
          if (e.message) throw e;
          console.error('Failed to parse NDJSON line:', e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return finalResults;
};


