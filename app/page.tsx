import  AttendanceForm  from './attendance/components/AttendanceForm';
import { GraduationCap } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto py-12 px-4">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-full mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 text-center">
            出席管理システム
          </h1>
          <p className="text-gray-600 mt-2 text-center max-w-md">
            レポートを提出して、出席登録をしましょう。
          </p>
        </div>
        <AttendanceForm />
      </div>
    </div>
  );
}
