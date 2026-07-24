import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

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

export interface OCRResponse {
  text_regions: TextRegion[];
  annotated_image: string;
  stats: Stats;
}

export interface StatusResponse {
  status: string;
  device: string;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds (useful for long OCR tasks on large files)
});

export const checkStatus = async (): Promise<StatusResponse> => {
  const response = await api.get<StatusResponse>('/status');
  return response.data;
};

export const processOCR = async (file: File): Promise<OCRResponse> => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await api.post<OCRResponse>('/ocr', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
