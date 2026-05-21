export const DEFAULT_LANGUAGE = "ko";

export const LANGUAGES = [
  { code: "ko", label: "한국어" },
  { code: "fr", label: "Français" },
];

export const translations = {
  ko: {
    navRecipeCalculator: "레시피 계산기",
    navRecipeDb: "레시피 DB",
    navCostDb: "원가 리스트 DB",
    navTempPh: "온도/pH 히스토리",
    navSettings: "설정",
    settingsTitle: "Settings",
    languageSetting: "언어 설정",
    languageDescription: "앱의 기본 화면 언어를 선택하세요.",
    calculatorNotice: "레시피 계산기 알림",
    saltYeastConfirm: "소금/이스트 확인창",
    currentStatus: "현재 상태",
    statusHidden: "숨김",
    statusVisible: "표시",
    restoreNotifications: "알림 다시 보기",
    saltCheck: "소금 넣었어??",
    yeastCheck: "이스트도?",
    hideNextTime: "다음부터 이 창 보이지 않기",
    cancel: "취소",
    confirm: "확인",
    loginGreeting: "빵쟁이들 안녕?",
    signIn: "Sign In",
    email: "Email",
    password: "Password",
    login: "로그인",
    loginComingSoon: "로그인 기능은 준비 중입니다. 지금은 무료로 사용하기를 선택해 주세요.",
    or: "or",
    freeStart: "무료로 사용하기",
  },
  fr: {
    navRecipeCalculator: "Calculateur",
    navRecipeDb: "Recettes",
    navCostDb: "Couts",
    navTempPh: "Temperature/pH",
    navSettings: "Parametres",
    settingsTitle: "Parametres",
    languageSetting: "Langue",
    languageDescription: "Choisissez la langue principale de l'application.",
    calculatorNotice: "Alertes du calculateur",
    saltYeastConfirm: "Confirmation sel/levure",
    currentStatus: "Etat actuel",
    statusHidden: "Masque",
    statusVisible: "Visible",
    restoreNotifications: "Reafficher les alertes",
    saltCheck: "Tu as ajoute le sel ?",
    yeastCheck: "Et la levure ?",
    hideNextTime: "Ne plus afficher cette fenetre",
    cancel: "Annuler",
    confirm: "Confirmer",
    loginGreeting: "Salut les boulangers !",
    signIn: "Connexion",
    email: "E-mail",
    password: "Mot de passe",
    login: "Se connecter",
    loginComingSoon: "La connexion arrive bientot. Pour l'instant, utilisez le mode gratuit.",
    or: "ou",
    freeStart: "Utiliser gratuitement",
  },
};

export function getTranslator(language) {
  return function translate(key) {
    return translations[language]?.[key] || translations[DEFAULT_LANGUAGE][key] || key;
  };
}
