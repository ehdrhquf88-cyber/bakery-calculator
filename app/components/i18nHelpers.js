export const RECIPE_CATEGORY_LABEL_KEYS = {
  "하드계열": "hardCategory",
  "소프트계열": "softCategory",
  "사전반죽": "prefermentCategory",
};

export const COST_CATEGORY_LABEL_KEYS = {
  "미등록": "uncategorized",
  "밀가루": "flourCategory",
  "유제품": "dairyCategory",
  "설탕류": "sugarCategory",
  "유지류": "fatCategory",
  "견과류": "nutsCategory",
  "과일/필링": "fruitFillingCategory",
  "초콜릿": "chocolateCategory",
  "소금": "typeSalt",
  "첨가물": "additiveCategory",
  "기타": "typeOther",
};

export const INGREDIENT_TYPE_LABEL_KEYS = {
  "밀": "typeFlour",
  "수분": "typeWater",
  "사전반죽": "typePreferment",
  "소금": "typeSalt",
  "기타": "typeOther",
};

export const TEMP_FIELD_LABEL_KEYS = {
  "날짜": "itemDate",
  "르방": "itemLevain",
  "밀": "itemFlour",
  "물": "itemWater",
  "결과": "itemResult",
  "오토리즈": "itemAutolyse",
  "오토리즈완료": "itemAutolyseDone",
  "반죽완료": "itemMixDone",
  "하바1": "itemFold1",
  "하바2": "itemFold2",
  "하바3": "itemFold3",
  "하바4": "itemFold4",
  "분할": "itemDivide",
  "성형": "itemShape",
  "굽기": "itemBake",
  "수분": "typeWater",
  "사용시점": "itemUsePoint",
  "정점": "itemPeak",
};

export const LOG_TYPE_LABEL_KEYS = {
  "1차 저온": "firstCold",
  "2차 저온": "secondCold",
  "사전반죽 기록": "prefermentRecord",
};

export function labelFromMap(t, map, value) {
  return map[value] ? t(map[value]) : value;
}
