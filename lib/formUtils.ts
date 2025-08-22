import { z } from 'zod';
import { FormField } from '@/app/types';

// 動的フォームスキーマ生成
export const createDynamicFormSchema = (formFields: FormField[]) => {
  const schemaObject: any = {};
  
  formFields.forEach(field => {
    let fieldSchema: any;
    
    switch (field.type) {
      case 'text':
      case 'textarea':
        fieldSchema = z.string();
        break;
      case 'number':
        fieldSchema = z.string().refine((val) => !isNaN(Number(val)), {
          message: '数値を入力してください'
        });
        break;
      case 'date':
        fieldSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: '有効な日付を入力してください'
        });
        break;
      case 'select':
        fieldSchema = z.string();
        break;
      default:
        fieldSchema = z.string();
    }
    
    if (!field.required) {
      fieldSchema = fieldSchema.optional();
    } else {
      fieldSchema = fieldSchema.min(1, { message: `${field.label}を入力してください` });
    }
    
    // バリデーション追加
    if (field.validation) {
      if (field.validation.minLength) {
        fieldSchema = fieldSchema.min(field.validation.minLength, {
          message: `${field.label}は${field.validation.minLength}文字以上で入力してください`
        });
      }
      if (field.validation.maxLength) {
        fieldSchema = fieldSchema.max(field.validation.maxLength, {
          message: `${field.label}は${field.validation.maxLength}文字以下で入力してください`
        });
      }
    }
    
    schemaObject[field.name] = fieldSchema;
  });
  
  return z.object(schemaObject);
};

// フォームのデフォルト値生成
export const createDefaultValues = (formFields: FormField[]) => {
  const defaultValues: any = {};
  
  formFields.forEach(field => {
    switch (field.type) {
      case 'date':
        defaultValues[field.name] = field.name === 'date' ? new Date().toISOString().split('T')[0] : '';
        break;
      default:
        defaultValues[field.name] = '';
    }
  });
  
  return defaultValues;
};

// フォームデータをスプレッドシート用に変換（修正版）
export const formatFormDataForSpreadsheet = (
  formData: any, 
  formFields: FormField[],
  additionalData: any = {}
) => {
  const formattedData: any[] = [];
  
  // 基本データ
  formattedData.push(
    additionalData.id || '',
    additionalData.createdAt || new Date().toISOString()
  );
  
  // カスタムフィールドのデータをorder順に追加
  formFields
    .sort((a, b) => a.order - b.order)
    .forEach(field => {
      let value = formData[field.name] || '';
      
      // データ型に応じた変換
      if (field.type === 'number' && value) {
        value = parseFloat(value);
      } else if (field.type === 'date' && value) {
        // 日付フォーマットの統一
        value = new Date(value).toLocaleDateString('ja-JP');
      }
      
      formattedData.push(value);
    });
  
  // 位置情報
  formattedData.push(
    additionalData.latitude || '',
    additionalData.longitude || ''
  );
  
  return formattedData;
};

// スプレッドシートヘッダー生成（修正版）
export const generateSpreadsheetHeaders = (formFields: FormField[]) => {
  const headers = ['ID', 'CreatedAt'];
  
  // カスタムフィールドのヘッダーをorder順に追加
  formFields
    .sort((a, b) => a.order - b.order)
    .forEach(field => {
      headers.push(field.label);
    });
  
  // 位置情報
  headers.push('Latitude', 'Longitude');
  
  return headers;
};

// バリデーション用ヘルパー関数を追加
export const validateFormData = (formData: any, formFields: FormField[]) => {
  const errors: { [key: string]: string } = {};
  
  formFields.forEach(field => {
    const value = formData[field.name];
    
    // 必須チェック
    if (field.required && (!value || value.toString().trim() === '')) {
      errors[field.name] = `${field.label}は必須項目です`;
      return;
    }
    
    // 値が存在する場合のバリデーション
    if (value) {
      // 文字数チェック
      if (field.validation?.minLength && value.toString().length < field.validation.minLength) {
        errors[field.name] = `${field.label}は${field.validation.minLength}文字以上で入力してください`;
      }
      
      if (field.validation?.maxLength && value.toString().length > field.validation.maxLength) {
        errors[field.name] = `${field.label}は${field.validation.maxLength}文字以下で入力してください`;
      }
      
      // 数値チェック
      if (field.type === 'number' && isNaN(Number(value))) {
        errors[field.name] = `${field.label}は数値で入力してください`;
      }
      
      // 日付チェック
      if (field.type === 'date' && isNaN(Date.parse(value))) {
        errors[field.name] = `${field.label}は有効な日付で入力してください`;
      }
    }
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
