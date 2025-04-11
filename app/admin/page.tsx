'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/export');
      if (!response.ok) throw new Error('エクスポートに失敗しました');
      
      const data = await response.json();
      const downloadUrl = `/${data.fileName}`;
      
      // ダウンロードリンクの作成と自動クリック
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'エクスポート完了',
        description: 'CSVファイルのダウンロードを開始しました',
      });
    } catch (error) {
      toast({
        title: 'エラー',
        description: 'エクスポートに失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      
      // CSVエクスポートAPIを呼び出し、レスポンスをBlobとして取得
      const response = await fetch('/api/export');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'エクスポートに失敗しました');
      }
      
      // Blobを取得してダウンロード
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('CSVエクスポートエラー:', error);
      alert('CSVエクスポートに失敗しました: ' + error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto py-12 px-4">
      <Card className="bg-white/50 backdrop-blur-sm border-2 border-slate-100">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-slate-900">管理画面</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">データエクスポート</h2>
            <p className="mb-4">出席記録をCSVファイルとしてエクスポートします。</p>
            <Button 
              onClick={handleExportCSV} 
              disabled={isExporting}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isExporting ? 'エクスポート中...' : '出席データをCSVでダウンロード'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      </div>
    </div>
  );
}