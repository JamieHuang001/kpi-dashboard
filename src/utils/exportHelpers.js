import Papa from 'papaparse';
import html2canvas from 'html2canvas';

/**
 * 匯出表格資料為 CSV
 */
export function exportToCSV(data, columns, filename = 'export.csv') {
    const headers = columns.map(c => c.header);
    const rows = data.map(row =>
        columns.map(c => {
            const val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
            return val != null ? String(val) : '';
        })
    );

    const csv = Papa.unparse({ fields: headers, data: rows });
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

/**
 * 匯出 DOM 元素為 PNG 圖片
 */
export async function exportToPNG(element, filename = 'chart.png') {
    if (!element) return;

    try {
        const canvas = await html2canvas(element, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
        });

        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error('PNG 匯出失敗:', err);
    }
}
