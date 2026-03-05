import fetch from 'node-fetch';

const API_KEY = 'AIzaSyCkPFG6shRp6OvwJ3SAToNy78tp6PkMF-g';
const SPREADSHEET_ID = '1hml34WXofOXhftGszFABKe78DRRY11hroHZUpNpL8DI';

async function testCurrentMonth() {
    // 假設抓 115年醫院保養總表 (1584576451? No wait, let's fetch meta first)
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}&fields=sheets.properties`;
    const metaRes = await fetch(metaUrl);
    const metaData = await metaRes.json();

    // Find home sheet
    const homeSheet = metaData.sheets.find(s => s.properties.title.includes('永定居家') && s.properties.title.includes('月'));
    console.log('Testing Home Sheet:', homeSheet.properties.title);

    // Fetch with grid data
    const homeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}&ranges=${encodeURIComponent(homeSheet.properties.title)}&includeGridData=true`;
    const homeRes = await fetch(homeUrl);
    const homeJson = await homeRes.json();

    const rowData = homeJson.sheets[0].data[0].rowData;
    if (rowData && rowData.length > 3) {
        // Just print the 4th row to see cell colors
        const cells = rowData[3].values || [];
        cells.forEach((cell, idx) => {
            const format = cell.effectiveFormat;
            const bg = format?.backgroundColor;
            const val = cell.formattedValue || '';
            console.log(`Col ${idx}: [${val}] -> R:${bg?.red || 0} G:${bg?.green || 0} B:${bg?.blue || 0}`);
        });
    }

    console.log('---');
    // Find hosp sheet
    const hospSheet = metaData.sheets.find(s => s.properties.title.includes('醫院保養總表'));
    console.log('Testing Hosp Sheet:', hospSheet.properties.title);

    const hospUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}&ranges=${encodeURIComponent(hospSheet.properties.title)}&includeGridData=true`;
    const hospRes = await fetch(hospUrl);
    const hospJson = await hospRes.json();
    const hospRowData = hospJson.sheets[0].data[0].rowData;
    if (hospRowData && hospRowData.length > 5) {
        // Just print the 6th row to see cell colors (usually has monthly data)
        const cells = hospRowData[5].values || [];
        cells.slice(0, 15).forEach((cell, idx) => {
            const format = cell.effectiveFormat;
            const bg = format?.backgroundColor;
            const val = cell.formattedValue || '';
            console.log(`Col ${idx}: [${val}] -> R:${bg?.red || 0} G:${bg?.green || 0} B:${bg?.blue || 0}`);
        });
    }
}

testCurrentMonth();
