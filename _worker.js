// Cloudflare Pages '워커' 파일. 이 파일 하나가 두 가지 일을 함:
//  1) 방문자가 POST /generate 로 부탁하면 → 내 키로 Gemini 다녀와 문구를 돌려줌 (키는 여기 숨김)
//  2) 그 외 모든 요청(화면 열기 등)은 → 그냥 index.html 같은 정적 파일을 보여줌

// AI한테 시킬 지시문 (전단지 문구 규칙)
const PROMPT = `너는 전봇대에 붙은 동네 전단지 작가야.
말투는 진짜 전단지처럼 건조하고 딱딱한데, 내용은 읽다 보면 피식 웃긴다.
웃기는 법: 쓸데없는 걸 스펙처럼 자랑하고(롤 티어, 옛날 폰), 본업과 무관한 혜택을 대단한 듯 내세우고(멤버십카드 제공), 영어를 어색하게 섞어. 끝까지 농담이라고 티내지 마.
말투는 "~가능 / ~보장 / ~제공 / ~드립니다"만. 블로그 말투(~해요), 느낌표 남발, 광고 카피는 금지.
혐오·비하·정치 소재 금지. 자학 개그와 서브컬처 드립 선에서만 웃겨.

각 항목 (글자수는 전단지가 두 줄로 깨지지 않게 반드시 지켜):
- title: 공백 포함 14자 이내.   예) "남조선 너드 온라인 과외"
- subtitle: 누구 모집인지만, 괄호로 감싸고 16자 이내.   예) "(모델, 연예인 모집)"
- features: 3~5개. 한 줄 20자 이내, 마침표 없이 '항목'처럼. 최소 2개는 본업과 무관한 웃긴 혜택.
- profile: 4~5줄, 오직 학력 위주로 짧게. 각 줄은 학교·학위 같은 고유명사 하나만, 15자 이내.
  설명·형용사·자기PR 금지 (경험/노하우/실력 같은 추상어로 끝나는 줄은 실패). 정보 없으면 그럴듯한 학교명을 지어내.
- intro: 2~3문장. 선생님을 3인칭으로 치켜세우고, 문의하면 상담해준다는 마무리.
- name, contact: 사용자가 안 줬으면 빈 문자열 (지어내지 마).

전체 예시 (톤·길이만 참고, 내용은 베끼지 마):
{
 "title": "남조선 너드 온라인 과외",
 "subtitle": "(모델, 연예인 모집)",
 "features": ["주 3회 월 100만원 (매일 30분)", "홈플러스 멤버십카드 제공", "외출 전 fit check 서비스", "선생님 너드 보장 (롤 10년)"],
 "profile": ["인하공전 메카트로닉스 졸업", "롤 Mastery Lv.7 Yasuo", "한세대학원 (M.Div-신학)", "현 나사북 PC방 부점장"],
 "intro": "남조선 최고 너드 Kim 선생님이 장담합니다. 최고의 너드 강사진이 기초부터 탄탄하게 가르쳐드립니다. 인스타그램으로 문의해주시면 롤체 리롤 돌리면서 상담해드리겠습니다.",
 "name": "",
 "contact": ""
}

사용자 키워드의 주제(과외/영어/헬스 등)는 반드시 지키되 살은 마음대로 붙여도 됨.
위와 똑같은 키를 가진 JSON으로만, 다른 말 없이 응답해.
사용자 입력: `;

export default {
  // 방문자 요청이 올 때마다 이 fetch가 실행됨
  async fetch(request, env) {
    const url = new URL(request.url);

    // (1) '/generate'로 온 POST 요청 → AI 문구 생성 담당
    if (url.pathname === "/generate" && request.method === "POST") {
      return handleGenerate(request, env);
    }

    // (2) 그 외 전부 → 정적 파일(index.html 등) 그대로 보여주기
    return env.ASSETS.fetch(request);
  }
};

// AI 문구 생성 함수
async function handleGenerate(request, env) {
  try {
    const { raw } = await request.json();          // 방문자가 보낸 키워드
    if (!raw) return json({ error: "키워드가 비었어" }, 400);

    const key = env.GEMINI_KEY;                     // ★ 키는 코드에 없고 Cloudflare 금고에서 꺼냄
    if (!key) return json({ error: "서버에 키가 설정 안 됨" }, 500);

    // 내 키로 Gemini 호출 (서버에서만 일어나 방문자에겐 안 보임)
    const gurl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + key;
    const res = await fetch(gurl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT + raw }] }],
        generationConfig: { responseMimeType: "application/json" } // "JSON으로만 답해"
      })
    });
    const data = await res.json();
    if (data.error) return json({ error: data.error.message }, 500);

    // 응답에서 문구(JSON 글자)만 뽑아 방문자에게 그대로 전달
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text).join("");
    return new Response(text, { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

// 응답을 JSON으로 만들어주는 작은 도우미
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
