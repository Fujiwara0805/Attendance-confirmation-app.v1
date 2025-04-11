export interface AttendanceFormData {
  studentId: string;
  name: string;
  year: string;
  department: string;
  feedback: string;
  date: string;
  lectureName: string;
  latitude: number;
  longitude: number;
}

export interface LocationBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}