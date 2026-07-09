export const metadata = {
  title: "개인정보 처리방침 | 빵쟁이들",
  description: "빵쟁이들 개인정보 처리방침",
};

const effectiveDate = "2026년 7월 9일";
const contactEmail = "ehdrhquf88@gmail.com";

const sections = [
  {
    title: "1. 개인정보의 처리 목적",
    body: [
      "빵쟁이들은 초대된 사용자의 Google 로그인을 통한 본인 확인, 서비스 접근 권한 관리, 레시피 계산 및 저장, 재료비 관리, 온도/pH 기록 관리, 공지사항 제공, 사진 업로드 기능 제공, 서비스 보안 및 오류 대응을 위해 개인정보를 처리합니다.",
      "수집한 개인정보는 위 목적 외의 용도로 이용하지 않으며, 이용 목적이 변경되는 경우 관련 법령에 따라 필요한 조치를 하겠습니다.",
    ],
  },
  {
    title: "2. 처리하는 개인정보 항목",
    body: [
      "Google 로그인 및 계정 관리: 이메일 주소, 이름 또는 표시 이름, 프로필 이미지 URL, Google 계정 식별 정보, Supabase Auth 사용자 ID, 로그인 및 권한 정보",
      "서비스 이용 데이터: 사용자가 입력한 레시피, 재료비 항목, 온도/pH 기록, 메모, 공지사항 읽음 여부, 공개 설정, 업로드한 빵 사진 및 이미지 파일 정보",
      "기기 저장 데이터: 로그인 세션, 오프라인 작업용 계정 정보, 화면 언어, 계산기 상태, 삭제 동기화 정보 등 브라우저 localStorage 또는 sessionStorage에 저장되는 정보",
      "자동 생성 정보: 서비스 접속 과정에서 생성되는 인증 토큰, 요청 시각, 오류 로그, 접속 환경 정보가 서비스 제공 및 보안 목적으로 처리될 수 있습니다.",
    ],
  },
  {
    title: "3. 개인정보의 처리 및 보유 기간",
    body: [
      "회원 계정 및 서비스 데이터는 서비스 이용 기간 동안 보관하며, 계정 삭제 또는 데이터 삭제 요청이 처리되면 관련 데이터를 지체 없이 삭제합니다.",
      "관계 법령에 따라 보존이 필요한 정보가 있는 경우 해당 법령에서 정한 기간 동안 보관할 수 있습니다.",
      "사용자 브라우저에 저장된 localStorage 및 sessionStorage 데이터는 사용자가 로그아웃하거나 브라우저 데이터를 삭제하면 해당 기기에서 삭제됩니다.",
    ],
  },
  {
    title: "4. 개인정보의 제3자 제공",
    body: [
      "빵쟁이들은 법령에 근거가 있거나 사용자의 별도 동의가 있는 경우를 제외하고 개인정보를 외부에 판매하거나 제공하지 않습니다.",
      "다만 Google 로그인, 데이터 저장, 이미지 저장, 배포 및 분석 기능을 제공하기 위해 아래의 처리위탁 및 외부 서비스가 사용됩니다.",
    ],
  },
  {
    title: "5. 개인정보 처리위탁 및 국외 처리",
    body: [
      "Google: Google OAuth 로그인 및 기본 프로필 정보 제공",
      "Supabase: 사용자 인증, 프로필, 초대 목록, 레시피, 재료비, 온도/pH 기록, 공지사항 데이터 저장 및 동기화",
      "Cloudflare R2: 사용자가 업로드한 빵 사진 파일 저장",
      "Vercel: 웹앱 호스팅, 배포, 기본 접속 통계 및 성능 분석",
      "위 서비스의 인프라 위치 및 운영 정책에 따라 개인정보가 국외에서 처리 또는 보관될 수 있습니다. 빵쟁이들은 서비스 제공에 필요한 범위에서만 외부 서비스를 사용합니다.",
    ],
  },
  {
    title: "6. 개인정보의 파기",
    body: [
      "처리 목적이 달성되었거나 보유 기간이 종료된 개인정보는 복구하기 어려운 방식으로 삭제합니다.",
      "Supabase Auth 사용자 삭제 시 프로필, 레시피, 재료비, 온도/pH 기록 등 사용자 ID와 연결된 데이터는 데이터베이스 정책에 따라 함께 삭제되도록 구성되어 있습니다.",
      "이미지 파일 등 별도 저장소에 있는 데이터는 삭제 요청 확인 후 해당 저장소에서 삭제합니다.",
    ],
  },
  {
    title: "7. 정보주체의 권리와 행사 방법",
    body: [
      "사용자는 본인의 개인정보 열람, 정정, 삭제, 처리정지, 동의 철회를 요청할 수 있습니다.",
      `요청은 로그인에 사용한 이메일 주소로 ${contactEmail}에 보내 주세요. 요청자 확인 후 처리 결과를 안내합니다.`,
      "계정 및 서버 저장 데이터 삭제를 원할 경우 이메일 제목에 '빵쟁이들 데이터 삭제 요청'을 포함해 주세요. 기기에 남아 있는 브라우저 저장 데이터는 사용자가 로그아웃하거나 브라우저 데이터 삭제 기능으로 직접 삭제할 수 있습니다.",
    ],
  },
  {
    title: "8. 안전성 확보 조치",
    body: [
      "빵쟁이들은 초대 이메일 기반 접근 제한, Supabase Row Level Security, 인증된 사용자만 접근 가능한 서버 API, 비공개 이미지 저장소, 관리자 권한 분리, 서버 전용 비밀키 관리 등을 통해 개인정보 보호를 위해 노력합니다.",
      "사용자는 본인의 Google 계정과 기기 접근 권한을 안전하게 관리해야 하며, 공용 기기에서는 이용 후 로그아웃하는 것이 좋습니다.",
    ],
  },
  {
    title: "9. 쿠키 및 브라우저 저장소 이용",
    body: [
      "빵쟁이들은 로그인 유지, 오프라인 작업, 언어 설정, 계산기 상태 저장을 위해 브라우저 localStorage 및 sessionStorage를 사용합니다.",
      "브라우저 설정에서 저장소 데이터를 삭제할 수 있으나, 이 경우 로그인 유지나 오프라인 작업 데이터가 사라질 수 있습니다.",
    ],
  },
  {
    title: "10. 만 14세 미만 아동의 개인정보",
    body: [
      "빵쟁이들은 만 14세 미만 아동을 대상으로 서비스를 제공하지 않습니다.",
      "만 14세 미만 아동의 개인정보가 수집된 사실을 알게 된 경우 지체 없이 필요한 조치를 하겠습니다.",
    ],
  },
  {
    title: "11. 개인정보 보호책임자",
    body: [
      "개인정보 보호책임자: 빵쟁이들 운영자",
      `문의 및 요청 이메일: ${contactEmail}`,
    ],
  },
  {
    title: "12. 개인정보 처리방침의 변경",
    body: [
      "이 개인정보 처리방침은 서비스 변경, 법령 개정, 외부 서비스 변경에 따라 수정될 수 있습니다.",
      "중요한 변경이 있는 경우 서비스 화면 또는 공지사항을 통해 안내합니다.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f3] px-4 py-8 text-black md:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="border-b-2 border-black pb-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Bbangjaengideul</div>
          <h1 className="mt-2 text-4xl font-black tracking-tighter md:text-5xl">개인정보 처리방침</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-gray-600">
            빵쟁이들은 사용자의 개인정보를 필요한 범위에서만 처리하고, 한국 개인정보 보호법의 원칙에 따라 안전하게 관리하기 위해 노력합니다.
          </p>
          <p className="mt-3 text-xs font-black text-gray-400">시행일: {effectiveDate}</p>
        </header>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-black tracking-tight">요약</h2>
          <ul className="mt-3 space-y-2 text-sm font-bold leading-6 text-gray-600">
            <li>Google 로그인으로 이메일, 이름, 프로필 이미지 등 기본 계정 정보를 받습니다.</li>
            <li>레시피, 재료비, 온도/pH 기록, 빵 사진은 사용자 계정에 연결되어 저장됩니다.</li>
            <li>데이터 삭제 요청은 {contactEmail}로 보낼 수 있습니다.</li>
          </ul>
        </section>

        <div className="mt-6 space-y-4">
          {sections.map(section => (
            <section key={section.title} className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-black tracking-tight">{section.title}</h2>
              <div className="mt-3 space-y-2">
                {section.body.map(item => (
                  <p key={item} className="text-sm font-bold leading-6 text-gray-600">{item}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/"
            className="rounded-xl bg-black px-5 py-3 text-sm font-black uppercase tracking-tight text-white"
          >
            앱으로 돌아가기
          </a>
          <a
            href={`mailto:${contactEmail}?subject=${encodeURIComponent("빵쟁이들 개인정보 문의")}`}
            className="rounded-xl border border-black px-5 py-3 text-sm font-black uppercase tracking-tight text-black"
          >
            문의하기
          </a>
        </div>
      </div>
    </main>
  );
}
