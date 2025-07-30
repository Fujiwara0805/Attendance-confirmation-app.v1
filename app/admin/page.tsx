'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Copy, HelpCircle, ExternalLink } from 'lucide-react';

export default function AdminPage() {
  const { toast } = useToast();
  const [attendanceSpreadsheetId, setAttendanceSpreadsheetId] = useState<string>('');
  const [loadingSpreadsheetId, setLoadingSpreadsheetId] = useState<boolean>(true);

  const SERVICE_ACCOUNT_EMAIL = 'id-791@attendance-management-467501.iam.gserviceaccount.com';

  // カスタムトースト関数（1秒間表示）
  const showToast = (title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
    toast({
      title,
      description,
      variant,
      duration: 1000, // 1秒間表示
    });
  };

  // サービスアカウントのメールアドレスをクリップボードにコピーする関数
  const copyServiceAccountEmail = async () => {
    try {
      await navigator.clipboard.writeText(SERVICE_ACCOUNT_EMAIL);
      showToast("コピー完了", "サービスアカウントのメールアドレスをクリップボードにコピーしました。");
    } catch (error) {
      showToast("コピー失敗", "クリップボードへのコピーに失敗しました。手動でコピーしてください。", "destructive");
    }
  };

  // スプレッドシートID設定関連の処理
  const fetchSpreadsheetId = async () => {
    setLoadingSpreadsheetId(true);
    try {
      const response = await fetch('/api/admin/spreadsheet-config');
      if (response.ok) {
        const data = await response.json();
        setAttendanceSpreadsheetId(data.attendanceSpreadsheetId || '');
        showToast("設定取得完了", "スプレッドシート設定を読み込みました。");
      } else {
        showToast("エラー", "スプレッドシートIDの取得に失敗しました。", "destructive");
      }
    } catch (error) {
      console.error('Failed to fetch spreadsheet ID:', error);
      showToast("エラー", "スプレッドシートIDの取得中にエラーが発生しました。", "destructive");
    } finally {
      setLoadingSpreadsheetId(false);
    }
  };

  const handleSaveSpreadsheetId = async () => {
    try {
      const response = await fetch('/api/admin/spreadsheet-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceSpreadsheetId }),
      });
      if (response.ok) {
        showToast("保存完了", "スプレッドシートIDを保存しました。");
        fetchSpreadsheetId();
      } else {
        const errorData = await response.json();
        showToast("保存失敗", errorData.message || "スプレッドシートIDの保存に失敗しました。", "destructive");
      }
    } catch (error) {
      console.error('Failed to save spreadsheet ID:', error);
      showToast("エラー", "スプレッドシートIDの保存中にエラーが発生しました。", "destructive");
    }
  };

  useEffect(() => {
    fetchSpreadsheetId();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8 text-center text-indigo-700">管理者ダッシュボード</h1>

        {/* セットアップガイド */}
        <Card className="mb-8 w-full max-w-4xl mx-auto bg-white shadow-md border border-blue-100">
          <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-t-lg">
            <CardTitle className="text-white flex items-center gap-2">
              <HelpCircle size={24} />
              初期セットアップガイド
            </CardTitle>
            <CardDescription className="text-green-100">
              出席データ管理用Googleスプレッドシートとの連携設定手順
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* ステップ1: スプレッドシートの作成 */}
            <div className="border-l-4 border-indigo-500 pl-4">
              <h3 className="text-lg font-semibold text-indigo-700 mb-3">ステップ1: 出席データ用Googleスプレッドシートの作成</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>
                  <a 
                    href="https://sheets.google.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
                  >
                    Google Sheets <ExternalLink size={14} />
                  </a>
                  にアクセスし、新しいスプレッドシートを作成します
                </li>
                <li>スプレッドシートに分かりやすい名前を付けます（例：「出席管理データ」）</li>
                <li>作成したスプレッドシートのURLをコピーします</li>
                <li>URLから<strong>スプレッドシートID</strong>を抜き出します：
                  <div className="mt-2 p-3 bg-gray-100 rounded-md font-mono text-sm">
                    https://docs.google.com/spreadsheets/d/<span className="bg-yellow-200 px-1 rounded">1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms</span>/edit
                  </div>
                  <p className="text-sm text-gray-600 mt-1">黄色でハイライトされた部分がスプレッドシートIDです</p>
                </li>
              </ol>
            </div>

            {/* ステップ2: サービスアカウントとの共有 */}
            <div className="border-l-4 border-emerald-500 pl-4">
              <h3 className="text-lg font-semibold text-emerald-700 mb-3">ステップ2: サービスアカウントとの共有設定</h3>
              <div className="space-y-3">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700 mb-2">以下のサービスアカウントのメールアドレスをコピーしてください：</p>
                  <div className="flex items-center gap-2 p-2 bg-white border rounded-md">
                    <code className="flex-1 text-sm font-mono text-gray-800">{SERVICE_ACCOUNT_EMAIL}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyServiceAccountEmail}
                      className="flex items-center gap-1"
                    >
                      <Copy size={14} />
                      コピー
                    </Button>
                  </div>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>作成したスプレッドシートの右上にある「<strong>共有</strong>」ボタンをクリック</li>
                  <li>「ユーザーやグループを追加」の入力欄に、上記のサービスアカウントのメールアドレスを貼り付け</li>
                  <li>権限を「<strong>編集者</strong>」に設定</li>
                  <li>「<strong>送信</strong>」ボタンをクリックして共有を完了</li>
                </ol>
                <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <strong>重要：</strong> サービスアカウントには「編集者」権限が必要です。「閲覧者」では正常に動作しません。
                  </p>
                </div>
              </div>
            </div>

            {/* ステップ3: スプレッドシートIDの設定 */}
            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="text-lg font-semibold text-purple-700 mb-3">ステップ3: 管理画面での設定</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>下記の「出席データ用スプレッドシートID設定」セクションに、ステップ1で取得したスプレッドシートIDを入力</li>
                <li>「保存」ボタンをクリックして設定を完了</li>
                <li>学生が出席登録を行うと、設定したスプレッドシートに自動的にデータが記録されます</li>
              </ol>
            </div>

            {/* データ構造の説明 */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-lg font-semibold text-blue-700 mb-3">記録されるデータの構造</h3>
              <p className="text-sm text-gray-700 mb-3">学生が出席登録を行うと、以下の形式でスプレッドシートに記録されます：</p>
              <div className="bg-gray-50 p-3 rounded-md">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-1">ID</th>
                      <th className="text-left p-1">Date</th>
                      <th className="text-left p-1">ClassName</th>
                      <th className="text-left p-1">StudentID</th>
                      <th className="text-left p-1">Grade</th>
                      <th className="text-left p-1">Name</th>
                      <th className="text-left p-1">Department</th>
                      <th className="text-left p-1">Feedback</th>
                      <th className="text-left p-1">Latitude</th>
                      <th className="text-left p-1">Longitude</th>
                      <th className="text-left p-1">CreatedAt</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-gray-600">
                      <td className="p-1">UUID</td>
                      <td className="p-1">日付</td>
                      <td className="p-1">講義名</td>
                      <td className="p-1">学籍番号</td>
                      <td className="p-1">学年</td>
                      <td className="p-1">氏名</td>
                      <td className="p-1">学科</td>
                      <td className="p-1">レポート</td>
                      <td className="p-1">緯度</td>
                      <td className="p-1">経度</td>
                      <td className="p-1">登録日時</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* トラブルシューティング */}
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="text-lg font-semibold text-red-700 mb-3">トラブルシューティング</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-gray-800">「設定取得に失敗しました」エラーが出る場合：</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 ml-4">
                    <li>サービスアカウントがスプレッドシートと正しく共有されているか確認</li>
                    <li>スプレッドシートIDが正確にコピーされているか確認</li>
                    <li>インターネット接続を確認</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">出席データが記録されない場合：</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 ml-4">
                    <li>サービスアカウントの権限が「編集者」になっているか確認</li>
                    <li>ブラウザを更新して再度お試しください</li>
                    <li>Googleスプレッドシートを直接開いて、データが追加されているか確認</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* スプレッドシートID設定 */}
        <Card className="mb-8 w-full max-w-2xl mx-auto bg-white shadow-md border border-blue-100">
          <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-t-lg">
            <CardTitle className="text-white">出席データ用スプレッドシートID設定</CardTitle>
            <CardDescription className="text-blue-100">
              学生の出席データが記録されるGoogleスプレッドシートのIDを設定します。
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {loadingSpreadsheetId ? (
              <p className="text-center text-gray-600">読み込み中...</p>
            ) : (
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="spreadsheet-id" className="text-indigo-700 font-medium">スプレッドシートID</Label>
                  <Input
                    id="spreadsheet-id"
                    type="text"
                    placeholder="例: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    value={attendanceSpreadsheetId}
                    onChange={(e) => setAttendanceSpreadsheetId(e.target.value)}
                    className="border-indigo-200 focus:border-indigo-400"
                    style={{ fontSize: '16px' }}
                  />
                  <p className="text-xs text-gray-500">
                    GoogleスプレッドシートのURLの「/d/」と「/edit」の間にある文字列です
                  </p>
                </div>
                <Button 
                  onClick={handleSaveSpreadsheetId} 
                  className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-medium"
                >
                  保存
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}