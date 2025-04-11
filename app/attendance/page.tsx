import dynamic from 'next/dynamic';

// クライアントサイドでのみ読み込むように設定（位置情報APIの使用のため）
const AttendanceForm = dynamic(
  () => import('./components/AttendanceForm'),
  { ssr: false }
);

export default function AttendancePage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <AttendanceForm />
    </div>
  );
}
