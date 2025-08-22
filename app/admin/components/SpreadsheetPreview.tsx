'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { FormField } from '@/app/types';
import { generateSpreadsheetHeaders } from '@/lib/formUtils';

interface SpreadsheetPreviewProps {
  courseId: string;
  courseName: string;
  spreadsheetId: string;
  formFields: FormField[];
  useDefaultForm: boolean;
}

export default function SpreadsheetPreview({ 
  courseId, 
  courseName, 
  spreadsheetId, 
  formFields,
  useDefaultForm 
}: SpreadsheetPreviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // スプレッドシートのプレビューデータを取得
  const fetchPreviewData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/spreadsheet-preview`);
      if (response.ok) {
        const data = await response.json();
        setPreviewData(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching preview data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const headers = generateSpreadsheetHeaders(formFields);
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">スプレッドシート設定</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPreviewData}
              disabled={isLoading}
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              更新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(spreadsheetUrl, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              開く
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">講義名:</span>
            <span className="ml-2 font-medium">{courseName}</span>
          </div>
          <div>
            <span className="text-gray-500">フォーム種類:</span>
            <Badge variant={useDefaultForm ? "default" : "secondary"} className="ml-2">
              {useDefaultForm ? "デフォルト" : "カスタム"}
            </Badge>
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-500">スプレッドシートID:</span>
            <code className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">{spreadsheetId}</code>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">出力される列</h4>
          <div className="flex flex-wrap gap-1">
            {headers.map((header, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {header}
              </Badge>
            ))}
          </div>
        </div>

        {previewData.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">最新データ（最大5件）</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    {headers.slice(0, 5).map((header, index) => (
                      <th key={index} className="border border-gray-200 p-2 text-left">
                        {header}
                      </th>
                    ))}
                    {headers.length > 5 && (
                      <th className="border border-gray-200 p-2 text-left">...</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.slice(0, 5).map((cell: any, cellIndex: number) => (
                        <td key={cellIndex} className="border border-gray-200 p-2 max-w-[100px] truncate">
                          {cell}
                        </td>
                      ))}
                      {row.length > 5 && (
                        <td className="border border-gray-200 p-2">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
