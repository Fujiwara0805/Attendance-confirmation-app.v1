'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Building2, CheckCircle2, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type BillingResult = {
  quoteId: string;
  invoiceId: string;
  amount: number;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  quotePdfUrl: string;
  deliveryNoteUrl: string;
};

export default function InstitutionalBillingPage() {
  const { data: session, status } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BillingResult | null>(null);
  const [formData, setFormData] = useState({
    plan: 'pro',
    termMonths: '12',
    institutionName: '',
    departmentName: '',
    contactName: session?.user?.name || '',
    billingEmail: session?.user?.email || '',
    phone: '',
    postalCode: '',
    address: '',
    taxId: '',
    purchaseOrderNumber: '',
    daysUntilDue: '30',
    notes: '',
  });

  const estimatedAmount = useMemo(() => {
    const monthly = formData.plan === 'enterprise' ? 2000 : 550;
    return monthly * Number(formData.termMonths || 1);
  }, [formData.plan, formData.termMonths]);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    if (!session?.user) return;
    setFormData((current) => ({
      ...current,
      contactName: current.contactName || session.user?.name || '',
      billingEmail: current.billingEmail || session.user?.email || '',
    }));
  }, [session?.user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/stripe/institutional-billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '銀行振込払いの請求書作成に失敗しました');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '銀行振込払いの請求書作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </main>
    );
  }

  if (!session?.user?.email) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-16">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <h1 className="text-2xl font-bold text-slate-900">ログインが必要です</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            銀行振込払いの請求書をアカウントに紐づけるため、管理画面へログインしてください。
          </p>
          <Button asChild className="mt-6 bg-indigo-600 hover:bg-indigo-700">
            <Link href="/admin/login">ログインへ</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin/account"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          アカウント設定に戻る
        </Link>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
                <Building2 className="h-3.5 w-3.5" />
                Invoice Billing
              </div>
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                銀行振込払い
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                大学・研究費・法人向けの銀行振込支払いに対応します。見積書PDF・後払い請求書・印刷用納品書を作成し、支払い確認後に対象期間の有料プランが有効になります。
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200">
              <p className="text-slate-500">請求予定額</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
                ¥{estimatedAmount.toLocaleString('ja-JP')}
              </p>
              <p className="mt-1 text-xs text-slate-500">税込 / {formData.termMonths}ヶ月分</p>
            </div>
          </div>

          {result ? (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <h2 className="text-base font-bold text-emerald-950">書類を作成しました</h2>
                  <p className="mt-1 text-sm leading-6 text-emerald-800">
                    請求書はStripeから請求先メールアドレスにも送信されています。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="bg-white">
                      <a href={result.quotePdfUrl} target="_blank" rel="noopener noreferrer">
                        <FileText className="mr-2 h-4 w-4" />
                        見積書PDF
                      </a>
                    </Button>
                    {result.hostedInvoiceUrl && (
                      <Button asChild variant="outline" className="bg-white">
                        <a href={result.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          請求書・銀行振込
                        </a>
                      </Button>
                    )}
                    <Button asChild variant="outline" className="bg-white">
                      <a href={result.deliveryNoteUrl} target="_blank" rel="noopener noreferrer">
                        <FileText className="mr-2 h-4 w-4" />
                        納品書
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plan">プラン</Label>
                  <select
                    id="plan"
                    value={formData.plan}
                    onChange={(event) => updateField('plan', event.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="pro">Pro / 月額550円</option>
                    <option value="enterprise">Enterprise / 月額2,000円</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="termMonths">契約期間</Label>
                  <select
                    id="termMonths"
                    value={formData.termMonths}
                    onChange={(event) => updateField('termMonths', event.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="1">1ヶ月</option>
                    <option value="6">6ヶ月</option>
                    <option value="12">12ヶ月</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="institutionName">大学・団体名</Label>
                  <Input id="institutionName" required value={formData.institutionName} onChange={(event) => updateField('institutionName', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="departmentName">学部・研究室・部署</Label>
                  <Input id="departmentName" value={formData.departmentName} onChange={(event) => updateField('departmentName', event.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactName">担当者名</Label>
                  <Input id="contactName" required value={formData.contactName} onChange={(event) => updateField('contactName', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billingEmail">請求先メールアドレス</Label>
                  <Input id="billingEmail" type="email" required value={formData.billingEmail} onChange={(event) => updateField('billingEmail', event.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">電話番号</Label>
                  <Input id="phone" value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">郵便番号</Label>
                  <Input id="postalCode" value={formData.postalCode} onChange={(event) => updateField('postalCode', event.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">請求先住所</Label>
                <Input id="address" required value={formData.address} onChange={(event) => updateField('address', event.target.value)} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="taxId">法人番号・登録番号</Label>
                  <Input id="taxId" value={formData.taxId} onChange={(event) => updateField('taxId', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchaseOrderNumber">注文番号・予算番号</Label>
                  <Input id="purchaseOrderNumber" value={formData.purchaseOrderNumber} onChange={(event) => updateField('purchaseOrderNumber', event.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="daysUntilDue">支払期限</Label>
                  <select
                    id="daysUntilDue"
                    value={formData.daysUntilDue}
                    onChange={(event) => updateField('daysUntilDue', event.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="14">14日以内</option>
                    <option value="30">30日以内</option>
                    <option value="60">60日以内</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">備考</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  value={formData.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  placeholder="宛名や書類提出時の指定があれば入力してください。"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    作成中
                  </>
                ) : (
                  '見積書・請求書・納品書を作成'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
