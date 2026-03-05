export const MATERIAL_PRICING = {
    // [格式]: '編號': { name: '稱呼/俗稱', cost: 成本, price: 報價 }
    'HC001': { name: '蛇型管100呎(200節)', cost: 0, price: 1500 }, // 圖片未列出成本，暫填0
    '70530': { name: '新廣業成人細菌過濾器', cost: 25, price: 30 },
    'HC002': { name: 'F-F01細菌過濾器', cost: 0, price: 35 },
    'HC004': { name: '拋棄式呼吸管路集水瓶,22mm外徑', cost: 36, price: 50 },
    'H-G-314001': { name: '拋棄式自動控水潮濕加溫加濕瓶 (Chamber舊)', cost: 0, price: 0 },
    'HC-M-OA': { name: '拋棄式潮濕加溫加濕瓶 (Chamber新)', cost: 126, price: 160 },
    'HC011': { name: '拋棄式單管管路', cost: 0, price: 0 },
    'HC009': { name: '氧氣導管2M', cost: 0, price: 25 },
    'HC008': { name: '氧氣延長管6M', cost: 0, price: 60 },
    'HC-OX-2': { name: 'OX-2氧氣鼻導管 250CM(成人)', cost: 0, price: 25 },
    'HC-NC08460': { name: '成人氧氣鼻導管6米-貝斯美德', cost: 0, price: 60 },
    'HC007': { name: '延長管連接頭', cost: 15, price: 20 },
    'HC-CL12': { name: '拋棄式雙旋L型接頭(15F,15M,K-Resin)', cost: 60, price: 80 },
    '1065775': { name: 'RP-Dep w/Filter Exhalation Por吐氣閥', cost: 0, price: 0 },
    '332113': { name: '吐氣閥Wisper Swivel II Packaged', cost: 1300, price: 1690 },
    'HC010': { name: '氧氣直型接頭T出口，22MM外徑', cost: 11, price: 25 },
    'HC-CS04': { name: '拋棄式直接頭(22M/15F,PC)', cost: 20, price: 30 },
    'AHSG-H-F15': { name: 'DIS-FLEX TUBE22/12,15OD,15CM (毛毛蟲)', cost: 0, price: 0 },
    'HC012': { name: '一般潮溼瓶', cost: 0, price: 100 },
    'R1038831': { name: '盒型過濾器RP-EVERFLO INTAKE FILTER', cost: 600, price: 1200 },
    'P060002': { name: '安心氧-進氣過濾器', cost: 500, price: 1000 },
    'HC-M07521': { name: '重力式灌食筒組', cost: 160, price: 210 },
    'GH-RST-S014': { name: '尖頭軟管(多次式)', cost: 0, price: 0 },
    'HC-OM81620': { name: '成人氣切面罩', cost: 48, price: 60 },
    'HC014': { name: 'P085120-聖誕樹', cost: 40, price: 50 },
    'P0600003': { name: '怡氧-盒型過濾器', cost: 615, price: 800 }
};

/**
 * 給定保養備註字串，粗略估算其中提到的耗材總成本與報價
 * @param {string} notes - 保養表格中的備註欄位 (有時會寫換了什麼耗材)
 * @returns {object} { totalCost, totalPrice, foundItems: [{ name, cost, price, qty }] }
 */
export function calculateMaterialCosts(notes) {
    if (!notes || typeof notes !== 'string') return { totalCost: 0, totalPrice: 0, foundItems: [] };

    let totalCost = 0;
    let totalPrice = 0;
    const foundItems = [];

    // 簡易關鍵字配對邏輯，後續依實際表格打字習慣做優化
    Object.keys(MATERIAL_PRICING).forEach(key => {
        const item = MATERIAL_PRICING[key];
        // 搜尋料號或是俗稱/品名的一部分
        if (notes.includes(key) || notes.includes(item.name.split('(')[0])) {
            // 目前先預設數量為 1
            totalCost += item.cost;
            totalPrice += item.price;
            foundItems.push({
                partNo: key,
                name: item.name,
                cost: item.cost,
                price: item.price,
                qty: 1
            });
        }
    });

    return { totalCost, totalPrice, foundItems };
}
