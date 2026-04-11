/* ══════════════════════════════════════════
   constants.js — 상수 / 설정 기본값 / 데모 데이터
══════════════════════════════════════════ */

export const SK             = 'sobukMXv6';
export const UNDO_MAX       = 20;
export const CELL_OV        = 5;
export const ADMIN_TOKEN_KEY  = 'fmAdminToken';
export const EDITOR_TOKEN_KEY = 'fmEditorToken';

/**
 * 데이터 스키마 버전 — 아이템 필드 구조가 변경될 때마다 올린다.
 * MIGRATIONS 에 이전 버전 → 현재 버전 변환 함수를 추가한다.
 */
export const DATA_VERSION = 2;

/**
 * 마이그레이션 맵: { [fromVersion]: (item) => migratedItem }
 * v1 → v2: mdContent, status, updatedAt 기본값 보장
 */
export const MIGRATIONS = {
  1: item => ({
    ...item,
    mdContent: item.mdContent ?? '',
    status:    item.status    ?? '',
    updatedAt: item.updatedAt ?? 0,
  }),
};

export const FIELDS = [
  'key','name','desc','path','group','subGroup','category','subCategory',
  'priority','status','owner','isDelete','isImportant','relSystem','memo','mdPath','mdContent'
];

export const FLABELS = {
  key:'Key', name:'기능명', desc:'설명', path:'경로',
  group:'그룹', subGroup:'서브그룹', category:'카테고리', subCategory:'서브카테고리',
  priority:'우선순위', status:'진행상태', owner:'담당',
  isDelete:'삭제여부', isImportant:'중요여부', relSystem:'연관시스템', memo:'메모',
  mdPath:'MD경로', mdContent:'MD내용'
};

export const STATUS_OPTS = ['대기','시작가능','진행중','검토중','완료'];
export const STATUS_CLS  = { 대기:'status-backlog', 시작가능:'status-ready', 진행중:'status-progress', 검토중:'status-review', 완료:'status-done' };
export const STATUS_LBL  = { 대기:'대기', 시작가능:'시작가능', 진행중:'진행중', 검토중:'검토중', 완료:'완료' };

/** 상태별 강조 색상 (바 세그먼트, 컬럼 상단 테두리, 텍스트 강조용) */
export const STATUS_ACCENT = {
  '대기':    'var(--text-3)',
  '시작가능': '#7C3AED',
  '진행중':  'var(--accent)',
  '검토중':  '#D97706',
  '완료':    'var(--success)',
};

/** 상태별 칩/뱃지 색상 (필터 버튼, 툴팁 등) */
export const STATUS_CHIP_COLORS = {
  '대기':    { col:'#6B7280', bg:'#F3F4F6' },
  '시작가능': { col:'#7C3AED', bg:'#F5F3FF' },
  '진행중':  { col:'#2563A8', bg:'#EBF2FB' },
  '검토중':  { col:'#D97706', bg:'#FFF7ED' },
  '완료':    { col:'#1D7A4F', bg:'#EAF5EF' },
};

export const DEFAULT_LIST_COLS = [
  {key:'key',visible:true}, {key:'name',visible:true}, {key:'group',visible:true},
  {key:'subGroup',visible:true}, {key:'category',visible:true}, {key:'subCategory',visible:false},
  {key:'priority',visible:true}, {key:'status',visible:true}, {key:'owner',visible:true},
  {key:'isImportant',visible:true}, {key:'isDelete',visible:false},
  {key:'desc',visible:false}, {key:'relSystem',visible:false}, {key:'memo',visible:false}
];

export const PRESETS = [
  {id:'left-thick',label:'좌측②'}, {id:'left-thin',label:'좌측①'},
  {id:'all-thin',label:'전체①'},   {id:'all-thick',label:'전체②'},
  {id:'dashed',label:'점선'},       {id:'bg-fill',label:'배경색'}, {id:'none',label:'없음'}
];

export const THEMES = {
  sobuk: { name:'소복청',
    light: {pHigh:'#C0312A',pHighBg:'#FDECEA',pMid:'#9A6200',pMidBg:'#FDF4E1',pLow:'#D0CEC9',pLowBg:'#F2F1EE',mxGBg:'#EBF2FB',mxGC:'#2563A8',mxSgBg:'#F2F1EE',mxSgC:'#5C5752',mxCBg:'#F2F1EE',mxCC:'#5C5752',mxBorder:'#E4E2DE',mxBW:1},
    dark:  {pHigh:'#E05A52',pHighBg:'#200C0C',pMid:'#E0A030',pMidBg:'#1E1608',pLow:'#3D3B38',pLowBg:'#272523',mxGBg:'#162438',mxGC:'#5B96D8',mxSgBg:'#272523',mxSgC:'#A09B94',mxCBg:'#272523',mxCC:'#A09B94',mxBorder:'#2E2D2A',mxBW:1}},
  slate: { name:'슬레이트',
    light: {pHigh:'#7C3AED',pHighBg:'#F5F3FF',pMid:'#2563A8',pMidBg:'#EFF6FF',pLow:'#64748B',pLowBg:'#F8FAFC',mxGBg:'#F1F5F9',mxGC:'#475569',mxSgBg:'#F8FAFC',mxSgC:'#64748B',mxCBg:'#F1F5F9',mxCC:'#64748B',mxBorder:'#CBD5E1',mxBW:1},
    dark:  {pHigh:'#A78BFA',pHighBg:'#1E1B4B',pMid:'#60A5FA',pMidBg:'#172554',pLow:'#94A3B8',pLowBg:'#1E293B',mxGBg:'#1E293B',mxGC:'#94A3B8',mxSgBg:'#0F172A',mxSgC:'#64748B',mxCBg:'#1E293B',mxCC:'#64748B',mxBorder:'#334155',mxBW:1}},
  sage:  { name:'세이지',
    light: {pHigh:'#BE123C',pHighBg:'#FFF1F2',pMid:'#15803D',pMidBg:'#F0FDF4',pLow:'#84A98C',pLowBg:'#F4F9F4',mxGBg:'#F0FDF4',mxGC:'#166534',mxSgBg:'#F4F9F4',mxSgC:'#3D7A5A',mxCBg:'#F4F9F4',mxCC:'#3D7A5A',mxBorder:'#BBF7D0',mxBW:1},
    dark:  {pHigh:'#FB7185',pHighBg:'#1C0B0F',pMid:'#4ADE80',pMidBg:'#052E16',pLow:'#6B7280',pLowBg:'#1A2B1B',mxGBg:'#052E16',mxGC:'#4ADE80',mxSgBg:'#1A2B1B',mxSgC:'#3DBE78',mxCBg:'#1A2B1B',mxCC:'#3DBE78',mxBorder:'#166534',mxBW:1}},
  rose:  { name:'로즈',
    light: {pHigh:'#BE185D',pHighBg:'#FDF2F8',pMid:'#9D174D',pMidBg:'#FCE7F3',pLow:'#C0312A',pLowBg:'#FDECEA',mxGBg:'#FDF2F8',mxGC:'#9D174D',mxSgBg:'#FCE7F3',mxSgC:'#BE185D',mxCBg:'#FDF2F8',mxCC:'#BE185D',mxBorder:'#FBCFE8',mxBW:1},
    dark:  {pHigh:'#F472B6',pHighBg:'#1C0B18',pMid:'#EC4899',pMidBg:'#1A0A14',pLow:'#BE185D',pLowBg:'#1A0A14',mxGBg:'#1C0B18',mxGC:'#F472B6',mxSgBg:'#1A0A14',mxSgC:'#EC4899',mxCBg:'#1C0B18',mxCC:'#EC4899',mxBorder:'#831843',mxBW:1}},
  amber: { name:'앰버',
    light: {pHigh:'#B45309',pHighBg:'#FFFBEB',pMid:'#7C2D12',pMidBg:'#FFF7ED',pLow:'#78716C',pLowBg:'#FAFAF9',mxGBg:'#FFFBEB',mxGC:'#92400E',mxSgBg:'#FFF7ED',mxSgC:'#78716C',mxCBg:'#FEFCE8',mxCC:'#78716C',mxBorder:'#FDE68A',mxBW:1},
    dark:  {pHigh:'#FBBF24',pHighBg:'#1C1200',pMid:'#FB923C',pMidBg:'#1C0A00',pLow:'#78716C',pLowBg:'#1C1917',mxGBg:'#1C1200',mxGC:'#FBBF24',mxSgBg:'#1C1917',mxSgC:'#78716C',mxCBg:'#1C1200',mxCC:'#78716C',mxBorder:'#78350F',mxBW:1}}
};

export const DEMO = [
  {key:'N0001',name:'회원 가입',desc:'신규 회원 등록.\n이메일 및 소셜 로그인 지원.',path:'/auth/register',group:'인증/보안',subGroup:'계정',category:'프론트엔드',subCategory:'폼/입력',priority:'상',owner:'홍길동',isDelete:'N',isImportant:'Y',relSystem:'Auth',memo:'',mdPath:'',mdContent:''},
  {key:'N0002',name:'로그인',desc:'이메일·비밀번호 또는 소셜 계정으로 로그인.',path:'/auth/login',group:'인증/보안',subGroup:'계정',category:'프론트엔드',subCategory:'폼/입력',priority:'상',owner:'홍길동',isDelete:'N',isImportant:'Y',relSystem:'Auth',memo:'',mdPath:'',mdContent:''},
  {key:'N0003',name:'비밀번호 재설정',desc:'이메일로 재설정 링크 전송.\n만료시간 30분.',path:'/auth/reset',group:'인증/보안',subGroup:'계정',category:'프론트엔드',subCategory:'폼/입력',priority:'중',owner:'홍길동',isDelete:'N',isImportant:'N',relSystem:'',memo:'',mdPath:'',mdContent:''},
  {key:'N0004',name:'JWT 발급',desc:'로그인 성공 시 Access/Refresh Token 발급.',path:'/api/auth/token',group:'인증/보안',subGroup:'토큰',category:'백엔드',subCategory:'API',priority:'상',owner:'김철수',isDelete:'N',isImportant:'Y',relSystem:'',memo:'',mdPath:'',mdContent:''},
  {key:'N0005',name:'토큰 갱신',desc:'Refresh Token을 이용한 재발급.',path:'/api/auth/refresh',group:'인증/보안',subGroup:'토큰',category:'백엔드',subCategory:'API',priority:'상',owner:'김철수',isDelete:'N',isImportant:'N',relSystem:'',memo:'',mdPath:'',mdContent:''},
  {key:'N0006',name:'상품 목록',desc:'카테고리별 상품 조회.\n페이지네이션 포함.',path:'/products',group:'상품 관리',subGroup:'조회',category:'프론트엔드',subCategory:'리스트/테이블',priority:'상',owner:'이영희',isDelete:'N',isImportant:'N',relSystem:'',memo:'',mdPath:'',mdContent:''},
  {key:'N0007',name:'상품 상세',desc:'개별 상품 상세 페이지.\n이미지 갤러리 포함.',path:'/products/:id',group:'상품 관리',subGroup:'조회',category:'프론트엔드',subCategory:'상세뷰',priority:'상',owner:'이영희',isDelete:'N',isImportant:'Y',relSystem:'CDN',memo:'',mdPath:'',mdContent:''},
  {key:'N0008',name:'상품 등록',desc:'관리자 상품 등록 폼.',path:'/admin/products/new',group:'상품 관리',subGroup:'관리',category:'프론트엔드',subCategory:'폼/입력',priority:'중',owner:'이영희',isDelete:'N',isImportant:'N',relSystem:'',memo:'',mdPath:'',mdContent:''},
  {key:'N0009',name:'상품 검색 API',desc:'키워드 기반 상품 검색.',path:'/api/products/search',group:'상품 관리',subGroup:'조회',category:'백엔드',subCategory:'API',priority:'중',owner:'박민준',isDelete:'N',isImportant:'N',relSystem:'Elasticsearch',memo:'',mdPath:'',mdContent:''},
  {key:'N0010',name:'장바구니 추가',desc:'상품을 장바구니에 담기.',path:'/cart/add',group:'주문/결제',subGroup:'장바구니',category:'프론트엔드',subCategory:'인터랙션',priority:'상',owner:'이영희',isDelete:'N',isImportant:'N',relSystem:'',memo:'',mdPath:'',mdContent:''},
  {key:'N0011',name:'결제 처리',desc:'PG사 연동 결제.\n카드/간편결제 지원.',path:'/api/orders/payment',group:'주문/결제',subGroup:'결제',category:'백엔드',subCategory:'API',priority:'상',owner:'박민준',isDelete:'N',isImportant:'Y',relSystem:'PG사',memo:'',mdPath:'',mdContent:'# 결제 처리\n\n## 개요\nPG사 연동을 통한 결제 처리 모듈.\n\n## 지원 수단\n- **카드**: 신용/체크카드\n- **간편결제**: 카카오페이, 네이버페이\n\n## 주의사항\n> 실결제 테스트 시 반드시 sandbox 환경 사용'},
  {key:'N0012',name:'주문 내역 조회',desc:'사용자 주문 이력 페이지.',path:'/mypage/orders',group:'주문/결제',subGroup:'주문',category:'프론트엔드',subCategory:'리스트/테이블',priority:'중',owner:'홍길동',isDelete:'N',isImportant:'N',relSystem:'',memo:'',mdPath:'',mdContent:''},
  {key:'N0013',name:'(구)결제 모듈',desc:'마이그레이션 완료로 비활성.',path:'/api/payment-v1',group:'주문/결제',subGroup:'결제',category:'백엔드',subCategory:'API',priority:'하',owner:'박민준',isDelete:'Y',isImportant:'N',relSystem:'',memo:'마이그레이션 완료.\n신규 모듈로 전환됨.',mdPath:'',mdContent:''},
  {key:'N0014',name:'알림 발송',desc:'주문/배송 관련 알림.',path:'/api/notifications',group:'알림',subGroup:'발송',category:'백엔드',subCategory:'API',priority:'중',owner:'김철수',isDelete:'N',isImportant:'N',relSystem:'FCM',memo:'',mdPath:'',mdContent:''},
  {key:'N0015',name:'알림 설정',desc:'알림 수신 채널 설정.',path:'/mypage/notifications',group:'알림',subGroup:'설정',category:'프론트엔드',subCategory:'폼/입력',priority:'하',owner:'',isDelete:'N',isImportant:'N',relSystem:'',memo:'',mdPath:'',mdContent:''}
];
