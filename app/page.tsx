import  AttendanceForm  from './attendance/components/AttendanceForm';
import { GraduationCap } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto py-12 px-4">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="https://res.cloudinary.com/dz9trbwma/image/upload/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
            alt="ざせきくん"
            width={128}
            height={128}
            className="rounded-lg shadow-sm"
          />
          <h1 className="text-2xl font-bold text-indigo-700 text-center">
            - 出席管理システム -
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
