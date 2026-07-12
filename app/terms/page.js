export const metadata = {
  title: "서비스 이용약관 | 빵쟁이들",
  description: "빵쟁이들 서비스 이용약관",
};

const effectiveDate = "2026년 7월 12일";
const contactEmail = "ehdrhquf88@gmail.com";

const sections = [
  {
    title: "1. 목적",
    body: [
      "이 약관은 빵쟁이들 서비스의 이용 조건, 사용자와 운영자의 권리와 의무, 서비스 이용 시 필요한 기본 사항을 정합니다.",
      "사용자는 Google 로그인을 통해 서비스를 이용함으로써 이 약관과 개인정보 처리방침의 내용을 확인하고 동의한 것으로 봅니다.",
    ],
  },
  {
    title: "2. 서비스 내용",
    body: [
      "빵쟁이들은 베이커와 제빵 작업자를 위한 레시피 계산, 레시피 저장, 재료비 관리, 온도/pH 기록, 공지사항 확인 기능을 제공합니다.",
      "서비스 기능은 운영 상황, 보안, 기술적 필요, 사용자 피드백에 따라 변경, 추가, 중단될 수 있습니다.",
    ],
  },
  {
    title: "3. 계정 및 로그인",
    body: [
      "서비스는 Google 계정을 통한 Supabase Auth 로그인을 사용합니다.",
      "사용자는 본인의 Google 계정 접근 권한을 안전하게 관리해야 하며, 계정 도용 또는 무단 사용이 의심되는 경우 즉시 Google 계정 보안 조치를 취해야 합니다.",
      "운영자는 서비스 보안, 법령 준수, 운영상 필요한 경우 계정 접근을 제한하거나 필요한 조치를 할 수 있습니다.",
    ],
  },
  {
    title: "4. 사용자 데이터",
    body: [
      "사용자가 입력한 레시피, 재료비, 온도/pH 기록, 메모 등은 해당 사용자 계정에 연결되어 저장됩니다.",
      "사용자는 본인이 입력한 데이터의 정확성, 적법성, 백업 필요성에 대한 책임을 가집니다.",
      "운영자는 서비스 제공, 장애 대응, 보안 점검, 데이터 복구 등 필요한 범위에서 시스템과 데이터베이스를 관리할 수 있습니다.",
    ],
  },
  {
    title: "5. 금지 행위",
    body: [
      "타인의 계정을 무단으로 사용하거나 접근하는 행위",
      "서비스의 정상 운영을 방해하거나 과도한 요청을 발생시키는 행위",
      "법령 또는 공서양속에 반하는 내용을 저장하거나 공유하는 행위",
      "서비스의 보안, 인증, 권한 구조를 우회하거나 침해하려는 행위",
      "운영자의 사전 동의 없이 서비스를 복제, 재판매, 상업적으로 악용하는 행위",
    ],
  },
  {
    title: "6. 서비스 제공 및 변경",
    body: [
      "운영자는 안정적인 서비스 제공을 위해 노력하지만, 네트워크, 외부 서비스, 클라우드 인프라, 배포 과정, 점검 등으로 서비스가 일시적으로 중단될 수 있습니다.",
      "Google, Supabase, Vercel, Cloudflare 등 외부 서비스의 장애나 정책 변경은 서비스 이용에 영향을 줄 수 있습니다.",
      "중요한 변경이 있는 경우 앱 화면, 공지사항, 문서 등을 통해 안내할 수 있습니다.",
    ],
  },
  {
    title: "7. 유료 기능 및 결제",
    body: [
      "현재 서비스는 공개 개인용 사용을 우선으로 운영하며, 향후 개인용 또는 회사용 유료 기능이 추가될 수 있습니다.",
      "유료 기능, 결제, 환불, 해지 조건은 해당 기능 출시 시 별도 정책 또는 약관으로 안내합니다.",
    ],
  },
  {
    title: "8. 데이터 삭제 및 계정 관리",
    body: [
      "사용자는 본인의 계정 및 서버 저장 데이터 삭제를 요청할 수 있습니다.",
      `삭제 요청은 로그인에 사용한 이메일 주소로 ${contactEmail}에 보내 주세요.`,
      "계정 삭제 시 사용자 ID와 연결된 프로필, 레시피, 재료비, 온도/pH 기록 등은 데이터베이스 정책에 따라 함께 삭제될 수 있습니다.",
    ],
  },
  {
    title: "9. 책임 제한",
    body: [
      "빵쟁이들은 제빵 계산과 기록 관리를 돕는 도구이며, 사용자가 실제 생산, 판매, 원가 계산, 품질 관리에 적용하는 최종 판단은 사용자 책임입니다.",
      "운영자는 고의 또는 중대한 과실이 없는 한 사용자의 입력 오류, 기기 문제, 네트워크 장애, 외부 서비스 장애, 브라우저 저장소 삭제 등으로 발생한 손해에 대해 책임을 제한할 수 있습니다.",
    ],
  },
  {
    title: "10. 약관의 변경",
    body: [
      "이 약관은 서비스 변경, 법령 개정, 운영 정책 변경에 따라 수정될 수 있습니다.",
      "중요한 변경이 있는 경우 서비스 화면 또는 공지사항을 통해 안내합니다.",
    ],
  },
  {
    title: "11. 문의",
    body: [
      "서비스 이용, 계정, 데이터 삭제, 개인정보, 약관 관련 문의는 아래 이메일로 연락할 수 있습니다.",
      `문의 이메일: ${contactEmail}`,
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f3] px-4 py-8 text-black md:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="border-b-2 border-black pb-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Bbangjaengideul</div>
          <h1 className="mt-2 text-4xl font-black tracking-tighter md:text-5xl">서비스 이용약관</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-gray-600">
            빵쟁이들은 레시피 계산과 작업 기록을 더 편하게 관리할 수 있도록 서비스를 제공합니다. 이 약관은 서비스를 안전하고 공정하게 이용하기 위한 기본 규칙입니다.
          </p>
          <p className="mt-3 text-xs font-black text-gray-400">시행일: {effectiveDate}</p>
        </header>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-black tracking-tight">요약</h2>
          <ul className="mt-3 space-y-2 text-sm font-bold leading-6 text-gray-600">
            <li>Google 계정으로 로그인하면 서비스 계정이 생성됩니다.</li>
            <li>레시피, 재료비, 온도/pH 기록은 사용자 계정에 연결되어 저장됩니다.</li>
            <li>사용자는 본인이 입력한 데이터와 계정 보안을 직접 관리해야 합니다.</li>
            <li>향후 유료 기능이 추가되면 결제 및 환불 조건을 별도로 안내합니다.</li>
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
            href="/privacy"
            className="rounded-xl border border-black px-5 py-3 text-sm font-black uppercase tracking-tight text-black"
          >
            개인정보 처리방침
          </a>
          <a
            href={`mailto:${contactEmail}?subject=${encodeURIComponent("빵쟁이들 서비스 이용 문의")}`}
            className="rounded-xl border border-black px-5 py-3 text-sm font-black uppercase tracking-tight text-black"
          >
            문의하기
          </a>
        </div>
      </div>
    </main>
  );
}
