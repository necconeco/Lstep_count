/**
 * スプレッドシート生成ユーティリティ
 * SheetJSを使用してExcel形式で出力
 */
import * as XLSX from 'xlsx';
import type { SpreadsheetOutputData } from '../types';

/**
 * スプレッドシートデータをExcelファイルとして生成・ダウンロード
 *
 * @param data - スプレッドシート出力データ（AB~AM列）
 * @param month - 集計月（YYYY-MM形式）
 */
export function generateSpreadsheet(data: SpreadsheetOutputData, month: string): void {
  // ワークブック作成
  const workbook = XLSX.utils.book_new();

  // データ行の作成（AB~AM列に対応）
  // 注意: ExcelのAB列 = index 27, AM列 = index 38
  const sheetData: unknown[][] = [
    // ヘッダー行
    [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '', // A~J列（空）
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '', // K~T列（空）
      '',
      '',
      '',
      '',
      '',
      '',
      '', // U~AA列（空）
      '初回予約合計', // AB列
      '初回予約率(%)', // AC列
      '初回実施合計', // AD列
      '初回実施率(%)', // AE列
      '',
      '',
      '',
      '', // AF~AI列（空）
      '2回目以降予約合計', // AJ列
      '2回目以降予約率(%)', // AK列
      '2回目以降実施合計', // AL列
      '2回目以降実施率(%)', // AM列
    ],
    // データ行（集計月のデータ）
    [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '', // A~J列（空）
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '', // K~T列（空）
      '',
      '',
      '',
      '',
      '',
      '',
      '', // U~AA列（空）
      data.AB, // 初回予約合計
      data.AC, // 初回予約率(%)
      data.AD, // 初回実施合計
      data.AE, // 初回実施率(%)
      '',
      '',
      '',
      '', // AF~AI列（空）
      data.AJ, // 2回目以降予約合計
      data.AK, // 2回目以降予約率(%)
      data.AL, // 2回目以降実施合計
      data.AM, // 2回目以降実施率(%)
    ],
  ];

  // TTL行（合計行）の追加
  // 注意: 予約率と実施率は平均値として計算（合計ではない）
  const ttlRow = [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '', // A~J列（空）
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '', // K~T列（空）
    '',
    '',
    '',
    '',
    '',
    '',
    '', // U~AA列（空）
    data.AB, // TTL: 初回予約合計
    data.AC, // TTL: 初回予約率(%)
    data.AD, // TTL: 初回実施合計
    data.AE, // TTL: 初回実施率(%)
    '',
    '',
    '',
    '', // AF~AI列（空）
    data.AJ, // TTL: 2回目以降予約合計
    data.AK, // TTL: 2回目以降予約率(%)
    data.AL, // TTL: 2回目以降実施合計
    data.AM, // TTL: 2回目以降実施率(%)
  ];

  // TTL行ラベルの追加（AA列に「TTL」と記載）
  ttlRow[26] = 'TTL';
  sheetData.push(ttlRow);

  // ワークシートを作成
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // 列幅の設定（AB~AM列のみ）
  const columnWidths = [];
  for (let i = 0; i < 27; i++) {
    columnWidths.push({ wch: 10 }); // A~AA列（デフォルト幅）
  }
  // AB~AM列（データ列）
  columnWidths.push({ wch: 15 }); // AB: 初回予約合計
  columnWidths.push({ wch: 15 }); // AC: 初回予約率(%)
  columnWidths.push({ wch: 15 }); // AD: 初回実施合計
  columnWidths.push({ wch: 15 }); // AE: 初回実施率(%)
  columnWidths.push({ wch: 10 }); // AF（空）
  columnWidths.push({ wch: 10 }); // AG（空）
  columnWidths.push({ wch: 10 }); // AH（空）
  columnWidths.push({ wch: 10 }); // AI（空）
  columnWidths.push({ wch: 18 }); // AJ: 2回目以降予約合計
  columnWidths.push({ wch: 18 }); // AK: 2回目以降予約率(%)
  columnWidths.push({ wch: 18 }); // AL: 2回目以降実施合計
  columnWidths.push({ wch: 18 }); // AM: 2回目以降実施率(%)

  worksheet['!cols'] = columnWidths;

  // セルスタイルの設定（ヘッダー行とTTL行を太字に）
  const headerCells = ['AB1', 'AC1', 'AD1', 'AE1', 'AJ1', 'AK1', 'AL1', 'AM1'];
  headerCells.forEach(cell => {
    if (worksheet[cell]) {
      worksheet[cell].s = {
        font: { bold: true },
        alignment: { horizontal: 'center' },
      };
    }
  });

  // 数値セルの書式設定
  const valueCells = ['AB2', 'AD2', 'AJ2', 'AL2']; // 合計セル（整数）
  const rateCells = ['AC2', 'AE2', 'AK2', 'AM2']; // 率セル（%）

  valueCells.forEach(cell => {
    if (worksheet[cell]) {
      worksheet[cell].t = 'n'; // 数値型
      worksheet[cell].z = '#,##0'; // 整数表示
      worksheet[cell].s = {
        alignment: { horizontal: 'right' },
      };
    }
  });

  rateCells.forEach(cell => {
    if (worksheet[cell]) {
      worksheet[cell].t = 'n'; // 数値型
      worksheet[cell].z = '0.0"%"'; // 小数点1桁 + %
      worksheet[cell].s = {
        alignment: { horizontal: 'right' },
      };
    }
  });

  // TTL行のセルスタイル
  const ttlCells = ['AA3', 'AB3', 'AC3', 'AD3', 'AE3', 'AJ3', 'AK3', 'AL3', 'AM3'];
  ttlCells.forEach(cell => {
    if (worksheet[cell]) {
      if (cell === 'AA3') {
        // TTLラベル
        worksheet[cell].s = {
          font: { bold: true },
          alignment: { horizontal: 'center' },
        };
      } else if (cell.match(/AC3|AE3|AK3|AM3/)) {
        // 率セル
        worksheet[cell].t = 'n';
        worksheet[cell].z = '0.0"%"';
        worksheet[cell].s = {
          font: { bold: true },
          alignment: { horizontal: 'right' },
        };
      } else {
        // 合計セル
        worksheet[cell].t = 'n';
        worksheet[cell].z = '#,##0';
        worksheet[cell].s = {
          font: { bold: true },
          alignment: { horizontal: 'right' },
        };
      }
    }
  });

  // ワークシートをワークブックに追加
  XLSX.utils.book_append_sheet(workbook, worksheet, '集計結果');

  // ファイル名生成（Lステップ集計_YYYY年MM月_YYYYMMDD.xlsx）
  const now = new Date();
  const [year, monthNum] = month.split('-');
  const dateStr = now.toISOString().split('T')[0]?.replace(/-/g, '') || ''; // YYYYMMDD
  const fileName = `Lステップ集計_${year || ''}年${monthNum || ''}月_${dateStr}.xlsx`;

  // Excelファイルとしてダウンロード
  XLSX.writeFile(workbook, fileName);
}

/**
 * スプレッドシートデータをCSV形式でダウンロード
 * （オプション機能：Excel非対応環境向け）
 *
 * @param data - スプレッドシート出力データ
 * @param month - 集計月（YYYY-MM形式）
 */
export function generateCSV(data: SpreadsheetOutputData, month: string): void {
  // CSVヘッダー
  const header = [
    '初回予約合計',
    '初回予約率(%)',
    '初回実施合計',
    '初回実施率(%)',
    '2回目以降予約合計',
    '2回目以降予約率(%)',
    '2回目以降実施合計',
    '2回目以降実施率(%)',
  ].join(',');

  // CSVデータ行
  const dataRow = [data.AB, data.AC, data.AD, data.AE, data.AJ, data.AK, data.AL, data.AM].join(',');

  // TTL行
  const ttlRow = [data.AB, data.AC, data.AD, data.AE, data.AJ, data.AK, data.AL, data.AM].join(',');

  // CSV文字列を構築
  const csvContent = `${header}\n${dataRow}\nTTL,${ttlRow}`;

  // BOMを追加（Excel対応）
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

  // ダウンロード
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const now = new Date();
  const [year, monthNum] = month.split('-');
  const dateStr = now.toISOString().split('T')[0]?.replace(/-/g, '') || ''; // YYYYMMDD
  link.href = url;
  link.download = `Lステップ集計_${year || ''}年${monthNum || ''}月_${dateStr}.csv`;
  link.click();

  // URLオブジェクトを解放
  URL.revokeObjectURL(url);
}
