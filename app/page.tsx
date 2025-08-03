import  AttendanceForm  from './attendance/components/AttendanceForm';
import { GraduationCap } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto py-12 px-4">
        <AttendanceForm />
      </div>
    </div>
  );
}
