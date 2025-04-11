// 大学の位置情報の境界を定義
// これは例の値です。実際の大学の位置情報に合わせて調整してください
export const UNIVERSITY_BOUNDS = {
  north: 35.6895, // 北緯
  south: 35.6855, // 南緯
  east: 139.7020, // 東経
  west: 139.6980, // 西経
};

export const LECTURE_NAME = "情報システム論"; // 講義名を設定

export const YEAR_OPTIONS = [
  { value: "1", label: "1年" },
  { value: "2", label: "2年" },
  { value: "3", label: "3年" },
  { value: "4", label: "4年" },
];

export const DEPARTMENT_OPTIONS = [
  { value: "情報工学科", label: "情報工学科" },
  { value: "電気電子工学科", label: "電気電子工学科" },
  { value: "機械工学科", label: "機械工学科" },
  // 必要に応じて学科を追加
];