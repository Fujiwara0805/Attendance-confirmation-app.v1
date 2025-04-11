'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto py-12 px-4">
      <Card className="bg-white/50 backdrop-blur-sm border-2 border-slate-100">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-slate-900">管理画面</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExport}
            disabled={isLoading}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white"
          >
            <Download className="mr-2 h-4 w-4" />
            {isLoading ? 'エクスポート中...' : '出席データをエクスポート'}
          </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}