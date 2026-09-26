# 티켓·행사 플랫폼 전체 및 테스트 검토

검토일: 2026-09-04

검토 기준: 검토 시점의 저장소 스냅샷에 포함된 코드·스키마·테스트·배포 설정

문서 상태: 검토 결과 기록. 아래 문제의 수정이나 운영 반영이 완료됐다는 의미가 아니다.

> 공개용 표기: 서비스명과 고유 저장소명, 일부 파일명·연락처는 일반적인 표현이나 예시 값으로 바꿨고, 원래 커밋 해시는 생략했다. 코드의 핵심 동작과 검토 결과는 유지했다.

이 문서는 다른 파일을 열지 않아도 검토 결과를 이해할 수 있도록 작성했다. 필요한 시스템 설명, 결함 발생 흐름, 재현 결과, 검증 한계와 개선 기준을 본문에 포함했다. 들여쓴 흐름도는 설명용 의사 코드이고, 파일 경로가 적힌 코드 블록은 해당 저장소 코드에서 필요한 부분을 발췌한 것이다. 일부 블록에는 관련 없는 줄을 생략하고 판단 지점을 표시하는 검토 주석을 덧붙였다.

## 1. 종합 판단

**가장 큰 위험은 기능 확장 속도를 권한·결제·복구 규칙의 통합이 따라가지 못한다는 점이다.**

안전장치가 없는 프로젝트는 아니다. 원자적 검표, 일부 발권·재고 잠금, 환불 요청 원장, 정산 두 사람 승인, 마이그레이션 검사, 운영 환경 격리 규칙과 회귀 테스트가 존재한다.

그러나 이 보호가 모든 진입 경로에 일관되게 적용되지 않는다. 웹에서 해결한 판매 조건이 앱에는 적용되지 않고, API에서 막는 파트너 접근이 DB 함수 직접 호출에서는 열려 있으며, 선택 배포의 복구 절차가 전체 배포에는 빠져 있다.

테스트도 같은 패턴을 보인다. 계산·집계·페이지네이션을 실제로 검증하는 좋은 테스트가 있지만, 중요한 권한·결제·복구 테스트 일부는 코드 문자열만 검사하거나 실행 대상에서 빠져 있다. 따라서 **현재의 테스트 통과 결과만으로 운영 안전성을 충분히 판단할 수 없다.**

권고 우선순위는 다음과 같다.

1. 타 파트너 접근과 인증 세션 혼합을 차단한다.
2. 결제·발권·환불의 실패 및 동시성 처리를 바로잡는다.
3. 전체 배포 롤백, 스테이징 갱신, 실제 백업 복원을 검증한다.
4. 테스트 실행 누락과 실패 예외를 해소하고, 핵심 업무 흐름을 CI의 필수 검사로 연결한다.
5. 기능 개발과 병행해 주문·발권·환불·권한 규칙을 공통 경로로 점진적으로 모은다.

## 2. 대상 시스템과 검토 범위

### 2.1 시스템 구조

검토 대상은 다음 구성요소를 한 저장소에서 관리하는 티켓·행사 운영 플랫폼이다.

- NestJS API: 모바일 앱·디바이스와 웹 일부의 서버 진입점.
- Partner Console: 파트너의 행사·판매·고객·정산 업무.
- Admin Console: 내부 운영·승인·정산·CRM 업무.
- Storefront: 관객의 공개 행사 조회와 예매.
- Supabase: PostgreSQL, 인증, Storage, DB 함수 및 Edge Functions.
- 내부 오디오 믹싱 서비스, 서버 크론, Caddy 및 백업 작업.

운영 배포는 ARM64 EC2 한 대의 Docker Compose 스택이다. 스테이징은 같은 배포 스크립트와 환경 템플릿을 사용하는 별도 EC2 프로필이다. 운영 DB 마이그레이션은 이전 앱 릴리스가 요청을 처리하는 동안 적용되므로 이전 버전과의 호환성이 필요하다.

업무 규칙은 API 서비스, 웹 서버 액션, Edge Functions와 DB 함수에 나뉘어 있다. DB를 직접 사용하는 웹 서버 코드에는 RLS를 우회하는 특권 클라이언트가 다수 존재한다. 이 키가 브라우저에 노출됐다는 뜻은 아니다. 각 서버 진입점에서 별도 인가 검사를 정확히 해야 하는 구조라는 뜻이다.

### 2.2 검토 방법과 한계

코드·SQL·설정·테스트 실행 목록을 읽고, 단위·계약·정적 검사 결과를 확인했다. 실제 SDK 또는 서비스에 가짜 외부 응답을 연결하여 결함을 재현했고, DB 권한 문제는 기존 데이터와 분리된 임시 PostgreSQL에서 검증했다.

이 문서에서 사용하는 증거 구분은 다음과 같다.

| 구분 | 의미 |
|---|---|
| 실제 SQL 재현 | 최신 마이그레이션을 적용한 격리 DB에서 역할·입력·최종 데이터를 확인했다. |
| 로컬 재현 | 실제 SDK·서비스·스크립트를 사용하되 외부 통신이나 DB 응답을 대체해 특정 상황을 실행했다. |
| 코드·설정 확인 | 구현과 최신 스키마·호출 경로를 대조했다. 실제 운영 요청은 실행하지 않았다. |
| 구조적 위험 | 현재 구조에서 규모나 변경량이 늘 때 커질 위험을 추론한 것이다. 사고가 이미 발생했다는 뜻은 아니다. |

운영 서버·운영 DB·실제 결제 API에는 접근하지 않았다. 전체 브라우저 E2E와 운영 부하 시험도 이번 검토에서 실행하지 않았다. 운영 배포 버전, 외부 백업의 실제 정상 동작 여부, 클라우드 별도 보안 설정, GitHub 원격 브랜치 보호 설정은 확인하지 않았다.

수치는 앞선 검토에서 실행한 결과다. 문서 저장 단계에서 모든 검사를 다시 실행한 것은 아니다. 제품 코드나 운영 환경은 변경하지 않았다.

## 3. 프로젝트 위험 검토

### 3.1 위험 요약

| 항목 | 우선도 | 확인된 내용 | 주된 영향 |
|---|---|---|---|
| 파트너 간 DB 접근 | 매우 높음 | 일반 로그인 역할로 타 파트너 매출 조회·마감 생성 재현 | 고객사 정보 노출, 현장 판매 방해 |
| 인증 세션 혼합 | 높음 | 로그인 후 공개 조회에 사용자 토큰이 붙는 현상 재현 | 미공개 행사·미검수 번역 노출 가능 |
| 결제 실패·동시성 처리 | 높음 | 취소 성공 미확인 후 주문 삭제, 완료 상태를 실패로 덮는 경합 | 결제·주문 불일치, 복구와 추적 곤란 |
| 채널별 판매 규칙 차이 | 높음 | 앱·웹의 정원·구매 한도·수수료 처리 차이 | 초과발권, 안내·청구·정산 차이 |
| 배포·스테이징 | 높음 | 전체 배포 롤백 누락, 스테이징 복원 입력 불일치 | 장애 장기화, 사전 검증 신뢰 저하 |
| 백업 | 높음 | 업로드 중 전체 백업 폐기, 용량 부족 시 정리 순서 문제 | 데이터 증가에 따른 복구 가능성 저하 |
| 분산된 권한·업무 규칙 | 구조적 | 특권 접근과 큰 파일 증가, 검사 연결 차이 | 변경 비용과 누락 가능성 증가 |
| 회원탈퇴 | 중간 | 여러 삭제 작업 후 제약조건에 걸려 중간 실패 가능 | 계정은 남고 일부 데이터만 삭제 |
| 개발 데이터 개인정보 | 구조적 | 운영 인증정보는 무효화하나 고객 정보는 유지 | 개발 장비·참여자 증가에 따른 노출면 확대 |

### 3.2 일반 로그인 권한으로 다른 파트너의 매출 조회·영업 마감 가능

**판정: 실제 SQL 재현. 수정 우선순위가 가장 높다.**

일부 POS DB 함수는 함수 소유자의 권한으로 실행되는 SECURITY DEFINER 함수다. 그런데 입력으로 받은 파트너 ID가 호출자 소속인지 확인하지 않고, 일반 로그인 역할인 authenticated에 실행 권한을 허용한다.

확인된 대표 함수는 pos_lock_day, pos_get_settlement, pos_get_kiosk_hourly_stats다. 핵심 흐름은 다음과 같다.

    일반 로그인 사용자
      → 다른 파트너 ID를 넣어 DB 함수 호출
      → 함수가 소유자 권한으로 매출 조회 또는 마감 잠금 생성
      → 호출자의 파트너 소속 검사는 없음

실제 마이그레이션의 핵심 부분은 다음과 같다. 함수는 `SECURITY DEFINER`인데 본문에는 `auth.uid()`나 호출자의 파트너를 확인하는 조건이 없고, 마지막에 `authenticated` 역할에 실행 권한을 준다.

```sql
-- supabase/migrations/<baseline>_schema.sql
CREATE OR REPLACE FUNCTION public.pos_lock_day(
  p_partner uuid,
  p_event uuid DEFAULT NULL,
  p_business_date date DEFAULT NULL,
  p_device uuid DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
begin
  if p_partner is null then
    raise exception 'INVALID_PARTNER (partner required)';
  end if;

  select coalesce(sum(gross_amount), 0), coalesce(sum(txn_count), 0)::int
    into v_gross, v_txn
  from public.pos_daily_stats
  where partner_id = p_partner
    and business_date = v_date
    and (p_event is null or event_id is not distinct from p_event);

  insert into public.pos_day_locks (
    partner_id, event_id, business_date, status, locked_by, device_id,
    gross_amount, txn_count, locked_at
  ) values (
    p_partner, p_event, v_date, 'locked', p_device, p_device,
    v_gross, v_txn, now()
  );
  -- 반환부 생략
end;
$$;

REVOKE ALL ON FUNCTION public.pos_lock_day(uuid, uuid, date, uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pos_lock_day(uuid, uuid, date, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pos_lock_day(uuid, uuid, date, uuid) TO service_role;
```

최신 마이그레이션 123개를 적용한 임시 DB에서 다음을 확인했다.

- 파트너 소속이 없는 일반 사용자 문맥으로 호출했다.
- 다른 파트너의 테스트 매출 70,000원을 조회했다.
- 해당 파트너의 마감 잠금 생성이 성공했다.
- 실제 잠긴 행 1개가 DB에 생성된 것을 확인했다.

마감 잠금은 디바이스 판매 처리에서 영업 거부 조건으로 사용된다. 따라서 단순 읽기 유출에 그치지 않고 현장 영업을 방해할 수 있다.

API 가드와 테이블 RLS가 존재해도, 직접 호출 가능한 이 DB 함수의 인가 누락을 대신 막아 주지 못한다. 이후 마이그레이션에서 해당 실행 권한을 회수하거나 함수 내부 인가를 추가한 내용은 확인되지 않았다.

**개선 기준:** 각 함수의 직접 호출 경계에서 역할·파트너·행사 소속을 강제해야 한다. 익명, 일반회원, 자사 파트너, 타사 파트너, 관리자 역할별 허용·거절 테스트가 실제 DB에서 통과해야 한다.

### 3.3 로그인 세션이 공개 조회 클라이언트에 섞임

**판정: 실제 설치된 SDK와 가짜 외부 응답으로 로컬 재현.**

API는 공개 조회용 Supabase 클라이언트 하나를 공유하고, 로그인 처리도 같은 클라이언트의 auth 객체를 사용한다.

```ts
// apps/api/src/supabase/supabase.service.ts
get anon(): SupabaseClient {
  if (!this.anonClient) {
    this.anonClient = createClient(this.url, this.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return this.anonClient;
}

// 인증도 위에서 만든 같은 anonClient의 auth 상태를 사용한다.
get auth() {
  return this.anon.auth;
}
```

    공개 조회 클라이언트 = 공유된 anon 인스턴스
    로그인 처리 클라이언트 = 같은 anon 인스턴스의 auth

    공개 행사 조회 → 익명 토큰 사용
    OTP 로그인 성공 → SDK 메모리에 사용자 세션 저장
    다음 공개 행사 조회 → 로그인한 사용자 토큰 사용

설정의 persistSession=false는 세션 상태 자체를 없애지 않는다. 검토 환경의 실제 SDK에서는 메모리에 세션을 유지했고, 이후 조회에 사용자 토큰을 붙였다.

공개 행사 상세와 번역 조회 일부는 승인·검수 조건을 직접 제한하지 않고 RLS에 의존한다. 관리자나 파트너가 해당 API로 인증한 뒤에는 익명 요청이 그 사용자의 권한으로 미공개 행사나 미검수 번역을 읽을 수 있다. 공개 목록이 사용자 권한에 따라 간헐적으로 달라질 가능성도 있다.

사용자별 forUser 클라이언트는 별도로 생성된다. 따라서 모든 사용자 주문이 곧바로 유출된다고 확대 해석해서는 안 된다. 운영 계정으로 실제 유출을 검증한 것은 아니다.

**개선 기준:** 공개 조회 클라이언트와 세션을 생성하는 인증 클라이언트를 분리하고, 인증 처리가 요청 사이 상태를 공유하지 않게 해야 한다. 실제 SDK를 유지한 채 외부 fetch만 대체하여 로그인 전후 익명 요청의 Authorization이 변하지 않는지 검증해야 한다.

### 3.4 결제 승인 후 발권 실패를 끝까지 복구하지 못함

**판정: 코드·현재 호출 경로·환불 재조정 대상 확인. 실제 PG 호출은 하지 않음.**

앱의 create-order 및 pay-with-billing 경로는 다음과 같이 처리한다.

    PG 결제 승인
      → 주문·티켓 생성 시도
      → 생성 실패
      → PG 취소 요청
      → 생성된 주문·티켓 삭제 시도
      → order_failed_refunded 오류 반환

문제는 PG 취소 요청의 HTTP 상태와 응답 본문을 검사하지 않고, 네트워크 오류도 무시한다는 점이다. 취소가 실패해도 이후 주문 삭제와 '환불됨' 응답으로 진행할 수 있다.

```ts
// supabase/functions/create-order/index.ts
async function tossCancel(paymentKey: string, reason: string) {
  try {
    await fetch(
      `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(TOSS_SECRET + ":"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancelReason: reason }),
      },
    );
    // response.ok, 응답 status와 취소 금액을 확인하지 않는다.
  } catch {
    // 네트워크 오류도 호출자에게 전달하거나 원장에 남기지 않는다.
  }
}

try {
  // 주문과 티켓 생성
} catch (e) {
  await tossCancel(paymentKey, "order_creation_failed");
  if (orderIds.length) {
    try { await db.from("tickets").delete().in("order_id", orderIds); } catch {}
    try { await db.from("orders").delete().in("id", orderIds); } catch {}
  }
  return json({
    error: "order_failed_refunded",
    detail: String((e as any)?.message ?? e),
  }, 500);
}
```

    결제 승인 성공 + 발권 실패 + 결제 취소 실패
      → 고객 결제는 남음
      → 내부 주문 기록은 삭제될 수 있음
      → 응답은 환불된 것으로 표현

코드에는 재조정 작업 대상이라는 주석이 있으나, 현재 환불 재조정기는 refund_requests 원장을 조회한다. 해당 앱 발권 함수는 이 실패를 그 원장에 기록하지 않는다.

이 경우 정상 주문·환불 통계 밖으로 빠진 결제가 고객 신고를 통해 발견될 수 있다.

**개선 기준:** 취소 성공이 확인되기 전에는 환불 완료로 처리하지 않아야 한다. 결제키와 실패 원인을 복구 가능한 원장에 남기고, 불명확한 상태는 재조회·재시도 대상으로 유지해야 한다. PG 성공 이후 DB 실패, PG 취소 실패, 응답 유실 상황에서 최종 결제·주문·환불 상태를 검증해야 한다.

### 3.5 늦은 실패 요청이 완료된 디바이스 결제를 실패로 덮어씀

**판정: 실제 TypeScript 서비스와 가짜 DB 응답으로 로컬 재현.**

디바이스 결제 실패 처리는 먼저 세션 상태를 읽고 pending이면 실패 갱신을 실행한다. 하지만 갱신 조건에는 세션 ID만 있고 이전 상태 조건이 없다.

```ts
// apps/api/src/device/device-pg-payment.service.ts
async failPublicSession(sessionId: string, dto: PgPaymentSessionFailDto) {
  const session = await this.loadPublicSession(sessionId, dto.token);
  if (session.status !== 'pending') return this.publicShape(session);

  // 위 조회와 아래 UPDATE 사이에 다른 요청이 completed로 바꿀 수 있다.
  const failed = await this.markFailure(
    session.id,
    dto.code || 'PAYMENT_AUTH_FAILED',
    dto.message || '결제 인증이 완료되지 않았습니다.',
    'failed',
  );
  return this.publicShape(failed);
}

private async markFailure(sessionId: string, code: string, message: string,
  status: 'failed' | 'manual_review') {
  const { data, error } = await this.db
    .from('device_pg_payment_sessions')
    .update({ status, failure_code: code, failure_message: message })
    .eq('id', sessionId) // .eq('status', 'pending') 조건이 없다.
    .select('*')
    .single();
  if (error) throw new ApiError(500, 'ERR_INTERNAL', error.message);
  return data as PgSessionRow;
}

// 상태가 잘못 failed가 되면 취소도 여기서 종료된다.
if (session.status === 'failed') return this.deviceShape(session);
```

    요청 A: 세션이 pending임을 읽음
    요청 B: 결제 승인·주문 생성 후 completed 기록
    요청 A: 세션 ID만 조건으로 failed 기록

실제 서비스에 이 순서를 주입했을 때 다음 결과를 확인했다.

- 세션 상태는 failed.
- 승인 결제키는 남아 있음.
- 결제된 주문도 남아 있음.
- 실패 UPDATE의 조건은 ID 하나뿐.

후속 취소 처리는 failed 상태이면 바로 반환한다. 따라서 화면·세션은 실패인데 결제는 존재하고, 정상 취소 흐름도 막히는 상황이 가능하다.

기존 PG 응답 검증이나 일부 자동 취소 처리가 이 경합을 막지는 못한다. DB에 직접 연결한 경합 재현은 아니며, 실제 서비스의 상태 갱신 흐름을 검증한 결과다.

**개선 기준:** 상태 변경을 허용된 이전 상태와 함께 원자적으로 검사해야 한다. 승인·실패·취소 요청의 순서가 바뀌거나 중복돼도 최종 원장이 한 가지 일관된 상태에 도달해야 한다.

### 3.6 같은 티켓의 앱·웹 판매 규칙이 다름

**판정: 코드·최신 스키마·현재 API 진입 경로 확인.**

웹에 추가된 회차 정원 보호는 session_capacity_enforced가 true이고 주문 출처가 web 또는 reservation_form인 경우를 대상으로 한다. 이 값의 기본값은 false다.

앱의 기존 발권 경로는 별도 Edge Functions에서 주문과 티켓을 직접 생성하며, 최신 웹 경로와 같은 판매기간·재고·1인 한도·회차 검사를 적용하지 않는다. 이 함수들은 현재 API의 구매·무료 발권·저장 카드 결제 경로에서 호출하므로 폐기된 코드가 아니다.

수수료 처리도 다르다.

| 경로 | 확인된 처리 |
|---|---|
| 앱 구매 화면 | 관객 부담 수수료를 가격의 5%로 추정 |
| 실제 앱 주문 생성 | 수수료 0원, 주최자 부담으로 기록 |
| 웹 | DB의 수수료 정책 구간으로 계산 |

앱 화면과 실제 주문 생성 코드의 차이는 다음과 같다.

```ts
// apps/api/src/events/events.controller.ts — 앱 구매 화면용 응답
const bookingFeePerTicket =
  feePayer === 'audience' ? bookingFee(normalPrice) : 0

function bookingFee(price: number): number {
  if (!price || price <= 0) return 0
  return Math.max(0, Math.round(price * 0.05))
}

// supabase/functions/create-order/index.ts — 실제 앱 주문 INSERT
await db.from("orders").insert({
  unit_price: ln.unit,
  quantity: ln.qty,
  subtotal,
  booking_fee: 0,
  fee_payer: "organizer",
  total_amount: subtotal,
  status: "paid",
  source: "app",
})
```

한 채널에서 바로잡은 규칙이 다른 채널에는 남아 있을 수 있다. 행사와 거래가 늘면 초과발권, 판매 종료 후 구매, 고객 안내와 청구 차이, 정산 차이가 누적될 위험이 있다.

**개선 기준:** 채널에 관계없이 같은 입력은 같은 가격·판매 가능 여부·재고·구매 한도로 판정해야 한다. 의도적인 채널 차이는 명시적인 정책으로 표현하고 테스트해야 한다. 공통 주문·발권 처리 경로로 점진적으로 모으는 것이 필요하다.

### 3.7 전체 배포 롤백 누락과 스테이징 갱신 불일치

**전체 배포 판정: 실제 스크립트 함수에 실패를 주입하여 로컬 재현.**

선택 서비스 배포에는 새 컨테이너 기동 실패 시 이전 이미지로 되돌리는 처리가 있다. 그러나 전체 배포는 다음 경로로 실행되고, 기동 실패 시 복구 호출 없이 종료한다.

    전체 배포 → start_services → compose up --wait 실패 → 종료

두 경로의 실제 차이는 다음과 같다.

```bash
# deploy/production/run.sh — 전체 배포의 start_services
if [[ "$cron_option" == --without-cron ]]; then
  mapfile -t services < <(compose config --services | grep -vx cron)
  compose stop cron >/dev/null 2>&1 || true
  compose up -d --remove-orphans --wait --wait-timeout 420 "${services[@]}"
else
  compose up -d --remove-orphans --wait --wait-timeout 420
fi
# 실패를 잡는 if와 rollback 호출이 없다. set -e로 종료한다.

# 같은 파일 — 선택 서비스 배포
if ! compose up -d --wait --wait-timeout 420 "${active_services[@]}"; then
  echo "::error::교체 실패 — 직전 이미지로 되돌린다." >&2
  dump_unhealthy_logs "${active_services[@]}"
  rollback_services_to_previous "${active_services[@]}" || true
  exit 1
fi
```

실제 start_services 함수만 추출하고 컨테이너 기동을 가짜 명령으로 대체해 실패를 주입했다. 종료 코드는 42였고 롤백 호출은 없었다. 기존 롤백 회귀 테스트는 9개 모두 통과했다.

컨테이너 교체 과정에서 이전 컨테이너가 제거된 뒤 새 컨테이너가 기동하지 못하면 서비스가 중단된 채 남을 수 있다. 전체 배포는 수동 선택뿐 아니라 공통 배포 설정 변경으로도 선택될 수 있으므로 예외적인 경로로 보기 어렵다.

**스테이징 판정: 코드·입력 형식·실행 순서 확인.**

스테이징 갱신 스크립트는 현행 백업 디렉터리를 입력받는다고 설명하지만, 호출하는 복원기는 옛 SQL 스냅샷과 별도 manifest·Storage 디렉터리 형식을 요구한다. 복원기는 Compose 프로젝트 이름과 DB 컨테이너도 고정하고, 이미 복원한 DB에 재적용하는 것을 거절한다.

```bash
# deploy/staging/refresh-data.sh
echo "==> Restoring the production snapshot into staging"
"$ROOT/deploy/production/restore-production-snapshot.sh" "$SNAPSHOT"

# 복원 호출이 끝난 다음에 앱을 중단한다.
echo "==> Stopping applications while the copy is unmasked"
for service in "${APP_SERVICES[@]}"; do
  container="$(stack_container "$service")"
  [[ -n "$container" ]] && docker stop "$container" >/dev/null || true
done

# deploy/production/restore-production-snapshot.sh
# 디렉터리형 현행 백업이 아니라 SNAPSHOT.sql을 기준으로 파생 경로를 계산한다.
MANIFEST="${SNAPSHOT}.manifest.json"
STORAGE_DIR="${SNAPSHOT%.sql}-storage"
STORAGE_METADATA_FILE="${SNAPSHOT%.sql}-storage-objects.sql"
[[ -f "$MANIFEST" && -d "$STORAGE_DIR" ]] || {
  echo "Snapshot package is incomplete: $SNAPSHOT" >&2
  exit 1
}
```

즉, 현행 백업으로 스테이징 데이터를 반복 갱신하려는 목적과 복원기의 동작이 맞지 않는다. 앱 중단도 복원 호출 뒤에 있어, 형식 문제를 고친 뒤에도 마스킹 전 앱 접근을 막는 순서를 별도로 바로잡아야 한다.

현재 현행 백업 입력은 먼저 실패하므로 개인정보가 실제 노출됐다고 단정할 수 없다. 확인한 문제는 갱신 절차의 실행 불일치와 격리 보장 공백이다.

**개선 기준:** 전체·선택 배포 모두 실제 진입점에서 실패를 주입해 이전 이미지 복구를 확인해야 한다. 스테이징은 같은 운영 배포 경로를 유지하면서 현행 백업 입력, 앱 중단, 복원, 마스킹, 감사, 재시작 순서를 검증해야 한다. 감사 실패 시 앱은 시작되지 않아야 한다.

### 3.8 데이터 증가가 백업 완료와 복구를 어렵게 만듦

**판정: 백업 스크립트·배포 설정 확인 및 규모 증가 시 위험 추론.**

백업은 전체 DB dump와 Storage 압축을 만든다. 이 구간에서 Storage 메타데이터가 바뀌면 해당 백업 시도 전체를 폐기한다.

```bash
# deploy/production/backup/backup.sh
storage_state_before="$(storage_state)"
pg_dump --format=custom --compress=9 --file="$partial/postgres.dump"
pg_dumpall --globals-only --no-role-passwords >"$partial/globals.sql"

tar --xattrs --xattrs-include='user.supabase.*' \
  -czf "$partial/storage.tar.gz" \
  -C "$STORAGE_SOURCE_ROOT/supabase" storage

storage_state_after="$(storage_state)"
if [[ "$storage_state_before" != "$storage_state_after" ]]; then
  echo "Storage changed during backup; discarding this attempt for consistency." >&2
  exit 1
fi

# 새 백업이 완성된 뒤에야 만료 백업을 정리한다.
mv -- "$partial" "$final"
prune_expired_backups
```

    백업 전 Storage 상태 기록
      → 전체 DB dump
      → 전체 Storage 압축
      → Storage 상태 재확인
      → 상태가 달라졌으면 전체 시도 폐기

데이터가 커져 백업 시간이 길어지고 업로드가 잦아지면, 백업이 끝날 때까지 변경이 없는 구간을 확보하기 어려워진다.

용량 관리에도 순서 문제가 있다. 새 백업 전에는 여유 공간을 검사하지만, 만료된 백업 정리는 새 백업 성공 후 실행한다. 오래된 백업으로 공간이 부족해지면 삭제 가능한 만료분이 있어도 용량 검사에서 계속 실패할 수 있다.

기본 백업과 DB는 같은 저장소 루트에 있고 운영은 단일 호스트다. 저장소 밖 외부 복제의 실제 운영 상태는 확인하지 않았으므로 '외부 백업이 없다'고 단정하지 않는다.

체크섬·아카이브 구조 검증, 기본 6시간 주기, 재시도, 백업 최신성 healthcheck는 있다. 다만 DB 아카이브 목록을 읽을 수 있다는 사실은 실제 복원 성공과 같지 않다.

**개선 기준:** 업로드가 계속되는 상황에서도 일관된 백업을 완료할 방법, 용량 부족 전 정리 기준, 장애 알림과 외부 사본 상태를 검증해야 한다. 별도 환경에서 실제 복원을 수행하고 허용 가능한 데이터 손실량과 복구 시간을 확인해야 한다.

### 3.9 분산된 특권 접근과 유지보수 부담

**판정: 저장소 정적 측정과 검사 실행 결과.**

저장소 스캐너 기준으로 웹 앱 서버 코드의 특권 DB 클라이언트 사용은 398개 파일, 759곳이다.

| 앱 | 파일 수 | 스캐너가 집계한 사용 지점 |
|---|---:|---:|
| Admin | 147 | 324 |
| Partner | 217 | 382 |
| Storefront | 34 | 53 |
| 합계 | 398 | 759 |

이는 런타임 요청 횟수나 취약점 개수가 아니다. 권한 검사가 필요할 수 있는 코드의 분산 정도를 보여 주는 정적 지표다.

800줄 이상 앱 소스 파일은 28개였다. 큰 파일 자체가 결함이라는 뜻은 아니지만, 변경의 영향 범위를 이해하고 검토하는 비용이 커진다.

기존 기준선보다 특권 접근 파일이 늘지 않도록 하는 검사에서는 신규 파일 2개 때문에 실패했다. 파일 크기 검사에서도 기존 파일 3개 증가와 기준선에 없던 큰 파일 6개가 확인됐다.

특권 접근 검사는 실제 배포 CI에 연결되어 있다. 파일 크기 검사는 도구 자체가 존재하지만 현행 workflow에서 실제 저장소를 검사하는 필수 단계로 연결되어 있지 않다.

실패한 상태가 저장소에 들어온 경위나 병합 가능 여부는 원격 브랜치 보호 설정을 확인하지 않아 단정할 수 없다.

**개선 기준:** 각 서버 진입점의 개별 판단에 의존하는 범위를 줄여야 한다. 공통 인가와 업무 경로를 사용하고, 중요한 규칙은 모든 경로에서 검증되도록 해야 한다. 기준선 숫자를 늘려 검사를 통과시키는 행위는 이 구조적 문제를 해결하지 않는다.

### 3.10 회원탈퇴의 부분 실행과 개발 데이터의 개인정보

**회원탈퇴 판정: 코드와 DB 제약조건 확인.**

회원탈퇴는 결제수단·인증·멤버십 등을 차례로 삭제하고, 주문·CRM 정보를 익명화한 뒤 Auth 사용자를 삭제한다. 하나의 원자적인 작업이나 실패 후 재개 가능한 절차로 묶여 있지 않다.

```ts
// supabase/functions/delete-account/index.ts
const del = [
  db.from("user_payment_methods").delete().eq("user_id", uid),
  db.from("user_identity").delete().eq("user_id", uid),
  db.from("trusted_devices").delete().eq("user_id", uid),
  db.from("memberships").delete().eq("member_user_id", uid),
  db.from("event_staff").delete().eq("user_id", uid),
  db.from("partner_members").delete().eq("user_id", uid),
]
for (const p of del) {
  const { error } = await p
  if (error) return json({ error: "cleanup_failed", detail: error.message }, 500)
}

for (const p of [
  db.from("orders").update({
    user_id: null,
    customer_name: "탈퇴회원",
    customer_phone: "",
    customer_email: "",
  }).eq("user_id", uid),
  db.from("crm_activities").update({ user_id: null }).eq("user_id", uid),
]) {
  const { error } = await p
  if (error) return json({ error: "anonymize_failed", detail: error.message }, 500)
}

const { error: delErr } = await db.auth.admin.deleteUser(uid)
```

앞의 삭제가 성공한 뒤 뒤의 익명화나 Auth 삭제가 실패해도 앞선 변경을 한 번에 되돌리는 트랜잭션은 없다.

CRM 기록이 있는 사용자는 NULL을 허용하지 않는 사용자 ID를 NULL로 바꾸는 단계에서 실패할 수 있다. 도슨트·티켓 양도·티켓 소유자 등의 FK도 Auth 삭제를 막을 수 있다.

그 결과 계정은 남고 결제수단·멤버십 등 앞 단계의 데이터만 삭제되는 상태가 가능하다.

**개선 기준:** 모든 참조 관계와 보존·익명화 정책을 포함한 탈퇴 절차가 필요하다. 어느 단계에서 실패해도 상태가 명확하고, 재시도가 중복 부작용 없이 완료되어야 한다.

**개발 데이터 판정: 로컬 복원·정리 정책 확인.**

로컬 데이터 정리는 운영 세션·비밀번호·외부 서비스 자격증명을 무효화하지만, 현실적인 화면 테스트를 위해 고객·프로필·업무 데이터는 유지한다. 운영 원본 DB 및 private Storage 백업 캐시도 개발 환경에 존재할 수 있는 구조다.

Git 밖 저장과 제한된 파일 권한은 유효한 방어지만, 고객 개인정보의 복제 자체를 없애지는 않는다. 개발 참여자와 장비가 늘수록 접근·보관·삭제를 관리해야 할 범위가 커진다.

**개선 기준:** 일반 개발에는 마스킹된 데이터를 기본으로 사용하고, 원본이 꼭 필요한 작업의 범위·보관 기간·삭제를 구분해야 한다. 실제 개인정보 유출이나 법 위반 여부를 판단한 것은 아니다.

### 3.11 현재 방식이 지속될 때 예상되는 변화

다음은 코드 구조에 근거한 전망이며, 실제 조직 규모나 장애 빈도를 측정한 결과는 아니다.

- **거래량 증가:** 드문 결제 예외도 절대 건수가 늘어난다. 원장 밖으로 빠진 사고를 고객 신고와 PG 수동 대조로 처리할 가능성이 커진다.
- **판매 채널 증가:** 같은 정책을 여러 번 수정해야 하며, 한 경로의 개선이 다른 경로에 적용되지 않는 문제가 반복될 수 있다.
- **개발 참여자 증가:** 어느 경로에 어떤 예외가 남아 있는지 공유하기 어려워지고, 특정 담당자의 기억에 의존하는 검토 부담이 커질 수 있다.
- **데이터 증가:** 백업 시간이 길어지고 업로드와 겹치면서 백업 성공 구간이 줄어든다.
- **장애 발생:** 배포·스테이징·복구 절차의 공백이 중단 시간과 수동 작업을 늘릴 수 있다.

결국 신규 기능보다 고객 문의, 데이터 대조, 긴급 수정에 쓰는 시간이 늘어날 위험이 있다. 기능 확대와 함께 권한·결제·복구의 공통 규칙을 정리해야 한다.

## 4. 테스트 검토

### 4.1 판단 기준

**좋은 테스트는 실제 제품 동작이 잘못됐을 때 실패해야 한다.**

테스트 개수, 파일명, '동시성'이나 '권한'이라는 설명, CI의 초록색 결과만으로 검증력을 판단할 수 없다. 다음을 구분해야 한다.

- 제품의 실제 함수·상태·DB 결과를 검증하는가.
- 테스트 안에 복사한 규칙만 검증하는가.
- 코드에 특정 문자열이 존재하는지만 검사하는가.
- 검증해야 할 상태를 가짜 객체가 없애 버리지는 않는가.
- 테스트가 자동 실행 대상에 포함되는가.
- 준비 실패나 실행 실패가 skip 또는 허용된 실패로 바뀌지는 않는가.
- 테스트 실패가 실제 배포를 막는가.

### 4.2 일부러 결함을 넣어 확인한 결과

원본 관련 테스트가 먼저 통과하는 것을 확인한 뒤, 저장소 밖 임시 복사본에만 결함을 넣었다. 각 복사본에서 기존 테스트를 실행하고 임시 파일을 삭제했다.

| 넣은 결함 | 관련 테스트 파일의 결과 | 확인한 한계 |
|---|---:|---|
| 관리자 매출 조회의 권한 검사 호출을 주석 처리 | 21개 중 21개 통과 | 주석 속 함수 이름도 호출로 인정 |
| 결제 취소의 좌석 해제 두 호출을 항상 거짓인 조건 안에 배치 | 1개 중 1개 통과 | 실행 여부를 확인하지 않음 |
| 실제 발송 액션의 전화번호 검증을 비활성화 | 7개 중 7개 통과 | 테스트 안에 복사한 규칙을 검사 |

이 수치는 전체 테스트의 결함 검출률을 의미하지 않는다. 세 가지 구체적인 기능 결함을 관련 테스트가 놓친다는 사실을 확인한 것이다.

별도 메모리 변형 실험에서는 배포 조건의 AND 한 곳을 OR로 바꿔 앞 조건만 참이면 뒤 검사들을 우회할 수 있게 해도, 기존 배포 게이트 테스트 5개가 모두 통과했다. 현행 배포 조건이 실제로 우회한다는 뜻은 아니다. 조건식의 문자열만 확인하는 테스트가 논리 결합의 오류를 놓친다는 의미다.

현재 workflow의 배포 조건과 이를 검사하는 테스트를 같이 보면 이유를 확인할 수 있다.

```yaml
# .github/workflows/production.yml
deploy:
  needs: [changes, images, migration_gate, security_gate, app_tests, sql_regression]
  if: >-
    always() &&
    needs.changes.result == 'success' &&
    needs.migration_gate.result == 'success' &&
    needs.security_gate.result == 'success' &&
    needs.app_tests.result == 'success' &&
    needs.sql_regression.result == 'success' &&
    (needs.images.result == 'success' || needs.images.result == 'skipped') &&
    needs.changes.outputs.deploy == 'true' &&
    github.event_name == 'workflow_dispatch' &&
    github.ref == 'refs/heads/main' &&
    vars.AWS_ROLE_ARN != '' &&
    vars.PRODUCTION_INSTANCE_ID != '' &&
    vars.PRODUCTION_REPO_PATH != '' &&
    vars.PRODUCTION_DEPLOY_USER != ''
```

```js
// .github/scripts/production-deploy-gate.test.mjs
test("검사 job 은 skipped 를 성공으로 쳐 주지 않는다", () => {
  for (const job of ["migration_gate", "security_gate", "app_tests", "sql_regression"]) {
    assert.ok(
      condition.includes(`needs.${job}.result == 'success'`),
      `${job} 이 엄격하게 검사되지 않는다`,
    );
    assert.ok(
      !condition.includes(`needs.${job}.result == 'skipped'`),
      `${job} 의 skipped 를 성공으로 쳐 주고 있다 — 안 돈 검사가 통과가 된다`,
    );
  }
});
```

이 테스트는 각 성공 조건 문자열이 존재하는지는 확인하지만 그 조건들이 모두 `&&`로 연결됐는지는 확인하지 않는다. 따라서 중간 연결자 하나가 `||`로 바뀌어도 검사하는 문자열은 전부 남아 있고 테스트는 통과한다.

### 4.3 문제 1 — 동작 대신 코드 문자열을 검사

관리자 권한 테스트의 핵심은 다음과 같다.

    소스에서 권한 함수 이름의 위치를 찾음
    소스에서 특권 DB 클라이언트 생성 위치를 찾음
    권한 함수 이름이 앞에 있으면 통과

실제 테스트 코드는 함수 호출을 실행하거나 AST로 구분하지 않고 문자열 위치만 비교한다.

```ts
// apps/admin/tests/unit/admin-service-role-guard.test.ts
for (const [rel, route] of TARGETS) {
  test(`${rel}: 서비스 롤로 읽기 전에 권한을 확인한다`, () => {
    const src = read(rel)
    const guard = src.indexOf('requireRouteRole(')
    const client = src.indexOf('createAdminClient()')
    assert.ok(guard > 0, 'requireRouteRole 호출이 없다')
    assert.ok(client > 0, 'createAdminClient 를 쓰지 않는다')
    assert.ok(guard < client, '권한 확인보다 서비스 롤 클라이언트가 먼저다')
  })
}
```

현재 제품 코드에는 실제 호출이 들어 있다.

```ts
// apps/admin/lib/admin/sales-overview.ts
export async function getSalesOverview(opts?: {
  status?: string
  limit?: number
}): Promise<SalesOverviewData> {
  // orders 의 RLS 는 user_id = auth.uid() 뿐이라 세션 클라이언트로는 관리자에게도
  // 남의 주문이 안 보인다(숫자가 전부 0 이 된다). 권한을 확인하고 서비스 롤로 읽는다.
  await requireRouteRole('/sales-overview')
  const supabase = createAdminClient()
  // … 이하 집계 로직 생략
}
```

검출력 실험에서는 첫 줄을 아래처럼 바꾼 임시 복사본도 테스트 21개를 모두 통과했다. `indexOf`가 주석 속 문자열을 호출로 오인하기 때문이다.

```ts
// await requireRouteRole('/sales-overview')
const supabase = createAdminClient()
```

실제 비인가 사용자를 입력하지 않고, 거절 응답이나 DB 접근 차단도 확인하지 않는다. 그래서 호출을 주석으로 바꿔도 통과했다.

좌석 해제 테스트도 소스에 releasePendingOrder 호출 문자열이 있는지 확인한다. 호출이 도달 불가능한 분기에 남아 있어도 통과했다.

```ts
// apps/storefront/tests/unit/order-release.test.mjs
test('두 취소 경로가 모두 좌석을 놓아 준다', async () => {
  const form = await readFile(
    new URL('../../app/[locale]/events/[eventId]/checkout/_components/checkout-form.tsx', import.meta.url),
    'utf8',
  )
  const success = await readFile(
    new URL('../../app/[locale]/events/[eventId]/success/page.tsx', import.meta.url),
    'utf8',
  )

  // 결제창을 닫거나 SDK 가 던진 경우(브라우저)
  assert.match(form, /releasePendingOrder\(createdOrderId\)/)
  // 토스가 fail URL 로 돌려보낸 경우(서버)
  assert.match(success, /if \(orderId\) await releasePendingOrder\(orderId\)/)
})
```

임시 복사본에서 두 호출을 다음처럼 도달 불가능하게 만들어도 정규식은 그대로 일치해 테스트가 통과했다.

```ts
if (false) void releasePendingOrder(createdOrderId).catch(() => {})
if (false) { if (orderId) await releasePendingOrder(orderId) }
```

이런 검사는 특정 구조나 금지 패턴을 유지하는 보조 검사로는 의미가 있다. 하지만 '권한 없는 사용자를 거절한다' 또는 '취소하면 좌석이 돌아온다'는 동작을 증명하지 못한다. 정상적인 리팩터링에는 깨지고 실제 기능 결함에는 통과할 수 있다.

**개선 기준:** 구조 검사는 그 범위에 맞게 이름과 역할을 제한하고, 실제 호출 결과와 부작용을 검증하는 테스트를 추가해야 한다. 비인가 요청은 오류만 반환하는 것이 아니라 민감 데이터 조회·변경 자체가 실행되지 않아야 한다.

### 4.4 문제 2 — 테스트 안에 제품 로직을 복사

전화번호 테스트는 실제 발송 액션의 정규화·검증을 가져오지 않는다. 테스트 안에 이메일 정규식, 전화번호 정규식, 숫자만 남기는 함수를 다시 정의해 실행한다.

    제품 코드: 입력 정규화와 전화번호 검증
    테스트 코드: 별도로 복사한 입력 정규화와 전화번호 검증

두 코드의 관계를 나란히 보면 문제가 분명하다.

```js
// apps/storefront/tests/unit/send-ticket-contact.test.mjs
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^0\d{8,10}$/
const normalizePhone = (value) => value.replace(/\D/g, '')

test('정규화한 번호가 국내 형식이면 통과한다', () => {
  for (const ok of ['01000000000', '0200000000', '0310000000']) {
    assert.ok(PHONE_RE.test(ok), ok)
  }
})
```

```ts
// apps/storefront/lib/actions/send-ticket-to-contact.ts
export async function sendTicketToContact(input: {
  orderId: string
  currentEmail: string
  email: string
  phone: string
  editToken: string
  locale: string
}): Promise<SendTicketResult> {
  const currentEmail = input.currentEmail.trim().toLowerCase()
  const email = input.email.trim().toLowerCase()
  // 문자는 숫자만 보낸다(BizM 규약). 화면 입력의 하이픈은 여기서 떨군다.
  const phone = input.phone.replace(/\D/g, '')

  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: 'invalidEmail' }
  if (phone && !/^0\d{8,10}$/.test(phone)) return { ok: false, error: 'invalidPhone' }
  if (!verifyOrderEmailEditToken(input.editToken, input.orderId, currentEmail)) {
    return { ok: false, error: 'expired' }
  }
  // … 이하 DB 조회와 발송 처리 생략
}
```

검출력 실험에서는 제품 코드의 전화번호 분기를 `if (false && phone && ...)`로 비활성화했다. 테스트는 자기 파일에 복사된 `PHONE_RE`만 실행하기 때문에 7개 모두 통과했다.

제품 검증을 비활성화해도 테스트 속 복사본은 정상이라 계속 통과한다. 이 테스트는 실제 제품의 변경을 감시하지 못한다.

**개선 기준:** 실제 제품이 사용하는 순수 함수를 가져와 검증하거나, 외부 의존성을 대체한 실제 액션을 호출해야 한다. 기대 결과는 업무 규칙에서 정하되, 검증 대상 구현을 테스트 안에 다시 만들지 않아야 한다.

### 4.5 문제 3 — 가짜 객체가 검증할 위험을 제거

세션 공유 관련 테스트는 공유 service-role 클라이언트를 사용하지 않는다는 점을 실제로 확인한다. 이 부분은 의미가 있다.

그러나 공개 anon 클라이언트의 세션 오염까지 확인하지는 않는다. auth.verifyOtp를 상태 없는 가짜 함수로 바꾸기 때문에 실제 SDK가 세션을 기억하는 성질이 없어져 있다. 로그인 후 다른 요청에 어떤 토큰이 붙는지 검사하지 않는다.

테스트는 다음처럼 `sb.client`가 읽혔는지만 기록하고, 인증 객체는 세션 상태가 없는 일반 함수로 만든다.

```ts
// apps/api/test/unit/auth-oauth.spec.ts
let sharedClientRead = false;
const sb = {
  projectRef: 'rkrvaepppehatekrtyyl',
  serviceCredentialKind: 'secret',
  get client() {
    sharedClientRead = true;
    throw new Error('공유 service-role client를 사용하면 안 됨');
  },
  authAdmin: {
    createUser: async () => ({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    }),
    generateLink: async () => ({
      data: { properties: { hashed_token: 'hashed-token' } },
      error: null,
    }),
  },
  auth: {
    verifyOtp: async () => ({
      data: {
        session: { access_token: 'access', refresh_token: 'refresh' },
        user: {
          id: 'user-id',
          email: 'member@example.com',
          user_metadata: { name: '회원' },
        },
      },
      error: null,
    }),
  },
};

const controller = new AuthController(sb as any);
const result = await (controller as any).mintSession('member@example.com', {
  provider: 'naver',
});

assert.equal(sharedClientRead, false);
assert.deepEqual(result, {
  accessToken: 'access',
  refreshToken: 'refresh',
  user: { id: 'user-id', email: 'member@example.com', name: '회원' },
});
```

실제 구현에서 문제가 되는 공유는 위 테스트가 감시하는 service-role `client`가 아니라 `anon`과 `auth` 사이다.

```ts
// apps/api/src/supabase/supabase.service.ts
get anon(): SupabaseClient {
  if (!this.anonClient) {
    this.anonClient = createClient(this.url, this.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return this.anonClient;
}

get auth() {
  return this.anon.auth;
}
```

디바이스 PG 관련 테스트 4개는 금액 견적, 승인 응답 판별, 상세 응답 복원, 공개 응답의 필드 제한을 다룬다. API 테스트에서 confirmPublicSession, failPublicSession, cancelSession의 핵심 상태 전이를 직접 실행하는 호출은 확인되지 않았다.

테스트가 놓친 상태 전이의 실제 코드는 다음과 같다. 첫 조회 이후 UPDATE에 이전 상태 조건이 없어 그 사이 완료된 결제를 덮을 수 있다.

```ts
// apps/api/src/device/device-pg-payment.service.ts
async failPublicSession(sessionId: string, dto: PgPaymentSessionFailDto) {
  const session = await this.loadPublicSession(sessionId, dto.token);
  if (session.status !== 'pending') return this.publicShape(session);
  const failed = await this.markFailure(
    session.id,
    (dto.code || 'PAYMENT_AUTH_FAILED').slice(0, 100),
    (dto.message || '결제 인증이 완료되지 않았습니다.').slice(0, 500),
    'failed',
  );
  return this.publicShape(failed);
}

private async markFailure(sessionId: string, code: string, message: string,
  status: 'failed' | 'manual_review') {
  const { data, error } = await this.db
    .from('device_pg_payment_sessions')
    .update({
      status,
      failure_code: code.slice(0, 100),
      failure_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw new ApiError(500, 'ERR_INTERNAL', error.message);
  return data as PgSessionRow;
}
```

따라서 다음 상황은 현재 테스트가 충분히 다루지 못한다.

- 실패 요청이 pending을 읽은 직후 다른 요청이 결제를 완료함.
- PG 승인은 성공했지만 DB 쓰기 또는 응답 수신에 실패함.
- PG 취소 결과가 불명확함.
- 승인·실패·취소 요청이 중복되거나 순서가 바뀜.

가짜 객체 자체가 문제는 아니다. 검증할 성질을 실제로 유지해야 한다. 인증 격리에는 실제 SDK 인스턴스를 유지하고 외부 fetch만 대체하는 방식이 적합하다. 결제 상태 검증에는 외부 PG 통신을 대체하되 내부 서비스·원장·상태 전이를 실제로 실행하는 방식이 필요하다.

### 4.6 실행 누락과 실패 예외

API 단위·계약 테스트 파일 31개 중 실행 명령의 수동 목록에는 30개가 등록되어 있다. device.spec.ts가 빠져 있다.

누락된 파일에는 가드 4개, QR·로그 관련 2개, 체크인 관련 2개, 판매 관련 3개의 테스트 선언이 있다. 별도 실행 결과는 8개 통과, 3개 실패였다. 실패 3개는 오래된 판매 입력 fixture의 eventId 누락으로 현재 계약과 맞지 않는 문제다.

통과한 8개가 모두 보안 테스트인 것은 아니다. 중요한 점은 오래된 판매 테스트와 함께 유효한 가드·QR·체크인 회귀도 파일 전체로 자동 실행에서 빠져 있다는 것이다.

SQL 회귀에서는 5개 파일의 실패가 예외 목록으로 허용된다. 이 중 정산 승인·발송 테스트는 다음 문제가 있다.

- 정산 승인 테스트가 설정한 인증 문맥에서 auth.uid()가 기대 사용자로 인식되지 않는다.
- 예상한 권한 거절 대신 not_authenticated가 반환되어 앞 단계에서 중단된다.
- 자기 승인 차단, 다른 사람 승인, 중복 지급, 역분개, 승인 직전 금액 변경 단언까지 도달하지 못한다.
- 정산 발송 테스트는 요청·승인 성공부터 확인하지 않고 ID를 사용해, 준비 실패와 실제 발송 원장 결함을 구분하기 어렵다.

이 두 테스트는 사용자·프로필·주문 fixture를 스스로 만든다. 따라서 운영 데이터가 없어서 실행하지 못한다는 설명만으로 충분하지 않다. 나머지 예외 3개는 실제 특정 데이터 fixture 부재에 따른 실패이므로 새 제품 결함으로 세지 않는다.

예외 목록의 테스트가 다시 통과하기 시작하면 CI를 실패시켜 목록 정리를 요구하는 방어는 있다. 그러나 예외 테스트가 실패하면 원인에 관계없이 허용하므로 새 회귀도 감춰질 수 있다.

실행기의 실제 분기는 다음과 같다. 예외 목록에 등록된 테스트는 실패 원인을 검사하지 않고 모두 `skipped`로 계산한다.

```bash
# supabase/tests/run-ci.sh
if psql_run < "$f" >/dev/null 2>&1; then
  if [ -n "${SKIP[$name]:-}" ]; then
    echo "⚠ $name — 건너뛰기 목록에 있는데 통과했다. 목록에서 지워라."
    revived=$((revived + 1))
  else
    pass=$((pass + 1))
  fi
  continue
fi

if [ -n "${SKIP[$name]:-}" ]; then
  echo "⏭ $name — ${SKIP[$name]}"
  skipped=$((skipped + 1))
  continue
fi

failed=$((failed + 1))
```

정산 테스트 두 개를 포함한 현재 예외 등록은 아래와 같다.

```text
# supabase/tests/ci-skip.tsv
anonymous_survey_import_identity_regression    설문 응답 데이터가 있어야 신원 병합을 검증할 수 있다
bilie_non_billable_purchase_survey_regression  주류박람회 설문·주문 데이터가 필요하다
bilie2026_legacy_refund_adoption_regression    fixture 가 이벤트 최소 1건을 요구한다
settlement_approval_regression                 auth.uid() 문맥이 있어야 승인 권한 분기를 탄다
settlement_outbox_regression                   정산 지급 행이 있어야 발송 원장을 대조할 수 있다
```

**개선 기준:** 테스트 파일을 자동 발견하고, 낡은 fixture를 현재 계약에 맞게 고쳐야 한다. 공통 인증 fixture에는 auth.uid()가 기대 사용자와 같은지 사전 단언을 넣어야 한다. 필수 정산 검증은 예외 목록에서 빠져 실제 실패 시 배포를 막아야 한다.

### 4.7 E2E와 실제 복구 경로의 연결 부족

Partner에는 다음을 확인하는 구매 E2E가 존재한다.

    공개 화면에서 주문 생성
      → 외부 PG 통신만 대체한 결제 확정
      → DB 주문 상태 paid 확인
      → 티켓 1장 발권 확인
      → 성공 화면 재방문 후 중복 발권 없음 확인

지갑 충전도 잔액이 정확히 증가하고 재방문 때 중복 충전되지 않는지 검사하는 시나리오가 있다. 프로젝트 전체에 구매 E2E가 없다고 평가하면 부정확하다.

문제는 현행 CI workflow에서 Playwright E2E 실행을 찾지 못했다는 점이다. 핵심 테스트라는 주석이나 태그만으로 필수 검사가 되지는 않는다. 로컬 검증의 별도 smoke 실행도 전체 E2E 실행과는 다르다.

운영 workflow의 앱 검사 단계에는 아래 명령들이 연결되어 있다. API 계약과 세 웹 앱의 단위 테스트, 배포 롤백 회귀는 실행하지만 Playwright 명령은 없다.

```yaml
# .github/workflows/production.yml
- name: API contracts (DI 배선·응답 계약)
  run: npm run test:contracts --prefix apps/api

- name: Admin unit
  run: npm run test:unit --prefix apps/admin

- name: Partner unit
  run: npm run test:unit --prefix apps/partner

- name: Storefront unit
  run: npm run test:unit --prefix apps/storefront

# 배포 스크립트는 잘못되면 가장 위험한 자리다. 롤백이 실제로 되돌리는지,
# 되돌릴 수 없을 때 조용히 넘어가지 않는지 본다.
- name: Deploy rollback regression
  run: bash deploy/production/tests/rollback.test.sh
```

API의 브라우저 E2E는 기본 health·입력 거절·미인증 거절과 로컬 로그인 후 내 정보 조회 수준이다. 실제 구매·환불·타 파트너 접근의 HTTP→가드→DTO→서비스→DB 연결을 배포 게이트에서 증명하지 못한다.

Admin E2E 준비 코드에서는 파트너·이벤트 생성 실패를 로그만 남기고 계속하거나 반환한다. 후속 승인 테스트는 생성 결과 표시가 없으면 skip한다. 환경을 일부러 생략한 선택 실행에서 skip은 합리적일 수 있지만, 환경이 준비된 필수 검사에서 스키마·권한 오류로 fixture 생성이 실패하면 테스트 실패여야 한다.

```ts
// apps/admin/tests/global-setup.ts
const PARTNER_MARKER = path.join('.e2e', 'temp-partner.json');

const companyName = `[E2E임시] 승인테스트 ${stamp}`;
const { data, error } = await supabase
  .from('partners')
  .insert({
    company_name: companyName,
    business_number: '0000000000',
    representative_name: 'E2E 승인',
    representative_phone: '010-0000-0000',
    representative_email: 'approval-test@example.com',
    approval_status: 'pending',
  })
  .select('id')
  .single();

if (error || !data) {
  console.error('[global-setup] (1) pending 파트너 생성 실패:', error?.message);
} else {
  fs.writeFileSync(PARTNER_MARKER, JSON.stringify({ id: data.id, companyName }));
  console.log(`[global-setup] (1) pending 파트너 생성: ${companyName} (${data.id})`);
}

// apps/admin/tests/partner-approve.spec.ts
const MARKER_FILE = path.join('.e2e', 'temp-partner.json');

test('대기 파트너 승인 → 대기 목록에서 사라진다', async ({ page }) => {
  test.skip(!fs.existsSync(MARKER_FILE), 'throwaway 파트너 미생성(SUPABASE env 누락) — skip');

  const { id, companyName } = JSON.parse(fs.readFileSync(MARKER_FILE, 'utf8')) as {
    id: string;
    companyName: string;
  };
  // … 이하 승인 시나리오 생략
});
```

이 조합은 환경변수 누락뿐 아니라 INSERT 실패로 marker가 만들어지지 않은 경우도 같은 skip으로 처리한다.

배포 복구도 같은 문제를 보인다. 롤백 함수 자체의 테스트 9개가 통과했지만 전체 배포에서 그 함수가 호출되지 않는 결함을 놓쳤다.

**개선 기준:** 핵심 업무 E2E를 준비 데이터 생성부터 필수 CI로 연결하고, 준비 실패를 명시적으로 실패 처리해야 한다. 전체·선택 배포 진입점에서 실패를 주입하여 최종 서비스 상태와 이전 이미지 복구를 확인해야 한다.

### 4.8 SQL 단언과 동시성 검증의 빈틈

일부 환불 SQL 테스트는 응답 금액을 읽은 뒤 다음 방식으로 검사한다.

    금액이 20,000과 다르면 실패

실제 단언은 다음과 같다.

```sql
-- supabase/tests/refund_request_orchestration_regression.sql
v_r := refund_request_open(v_ord, v_t[1:2], 'key-A', '고객 요청');
if (v_r->>'ok')::boolean is not true then
  raise exception 'FAIL(1): 선점 실패 %', v_r::text;
end if;

v_id := (v_r->>'request_id')::uuid;
v_amt := (v_r->>'amount')::int;

if v_amt <> 20000 then
  raise exception 'FAIL(1b): 금액=% (기대 20000)', v_amt;
end if;

v_r2 := refund_request_open(v_ord, v_t[1:2], 'key-A', '고객 요청');
if (v_r2->>'request_id')::uuid <> v_id then
  raise exception 'FAIL(2b): 다른 요청이 생겼다';
end if;
```

`amount` 또는 `request_id`가 응답에서 빠지면 추출 결과가 NULL이다. PostgreSQL에서 `NULL <> 값`은 true가 아니라 NULL이므로 `IF`가 실행되지 않는다. 예를 들어 금액 단언은 다음 형태여야 누락도 실패시킬 수 있다.

```sql
if v_amt is distinct from 20000 then
  raise exception 'FAIL(1b): 금액=% (기대 20000)', v_amt;
end if;
```

SQL에서 금액 필드가 누락되면 값이 NULL이고, NULL과 20,000의 부등 비교도 NULL이다. IF 조건이 참이 아니므로 해당 단언이 실패하지 않는다. 요청 ID 비교에도 같은 형태가 있다.

필수 필드는 존재를 검사하거나 NULL에도 안전한 IS DISTINCT FROM 비교를 사용해야 한다. 다른 후속 원장 단언까지 전부 무의미하다는 뜻은 아니며, 특정 응답 필드의 검증 구멍이다.

또한 POS 집계의 동시성 테스트는 함수 본문에 advisory lock 관련 문자열이 있는지 검사하고, 데이터 없는 집계를 같은 세션에서 두 번 순차 실행한다.

```sql
-- supabase/tests/pos_rollup_concurrency_regression.sql
v_definition := lower(pg_get_functiondef(
  'public.pos_rollup_stats(uuid,uuid,date)'::regprocedure
));

if position('pg_advisory_xact_lock' in v_definition) = 0
   or position('p_partner::text' in v_definition) = 0
   or position('v_date::text' in v_definition) = 0 then
  raise exception 'pos_rollup_stats does not serialize partner-day rebuilds';
end if;

select public.pos_rollup_stats(v_partner, v_event, v_date) into v_result;
select public.pos_rollup_stats(v_partner, v_event, v_date) into v_result;
```

두 호출은 한 DO 블록의 같은 DB 세션에서 순서대로 실행된다. 별도 연결의 실제 경쟁은 만들지 않는다.

이는 잠금 코드 삭제를 잡는 구조 검사와 빈 집계 스모크로는 가치가 있지만, 실제 두 DB 세션이 동시에 집계할 때 충돌이나 합계 손실이 없는지는 확인하지 못한다.

**개선 기준:** 중요한 경쟁 조건은 두 연결과 실제 데이터를 사용해야 한다. 필요한 잠금이 작동하는지뿐 아니라 충돌 후 최종 원장·재고·집계가 정확한지를 확인해야 한다.

### 4.9 유지·확대할 가치가 있는 테스트

| 사례 | 실제로 검증하는 내용 | 의미 |
|---|---|---|
| 페이지네이션 | 서버가 1,000행 또는 더 적은 수로 응답을 잘라도 끝까지 읽음. 다음 페이지 오류를 숨기지 않음 | 매출·수신자 집계의 조용한 누락 방지 |
| 캐시 동시 요청 | 50개 요청을 동시에 실행하고 실제 loader 호출 1회 확인. 실패 후 재시도 확인 | 중복 부하와 실패 캐시 전파 방지 |
| 환불 알림 구독 | 실제 장애를 흉내 낸 채널 객체로 중복 구독·해제·재구독을 확인. 과거 구현이 가짜 객체에서도 실패하는지 확인 | 가짜 객체가 필요한 위험을 유지하는 좋은 사례 |
| 재고 SQL | 실제 주문 2,005개, 연락처 중복, 만료된 홀드, 취소 주문으로 재고와 개인 구매량 확인 | 실제 DB 집계와 경계조건 검증 |
| 파트너 권한 SQL | 자기 데이터 조회, 타 파트너 거절, 관리자 허용을 실제 역할로 확인 | 민감 RPC에 확대할 수 있는 인가 검증 |
| 주문 계산 | 수수료, 오픈 시각 직전·정각, 판매 종료일, 형제 권종의 합산 한도 확인 | 구현 형태와 무관한 사업 규칙 검증 |
| 디바이스 취소 권한 | 타 파트너 주문 취소가 거절되고 취소 RPC가 호출되지 않았는지 확인 | 오류 응답과 부작용 차단을 함께 검증 |
| 배포 변경 감지 | API 변경과 Storefront 수동 선택을 함께 반영하고 migration이 빠지지 않는지 실제 CLI로 확인 | 실제 배포 누락 회귀 방지 |
| 운영 환경 키 복구 | 다른 결제 계정 키 충돌 시 거절하고 기존 값을 잘못 덮지 않는지 확인 | 결제 환경 오염 방지 |

예를 들어 캐시 테스트는 소스 문자열이나 복제한 알고리즘을 검사하지 않는다. 실제 `cachedForMs`를 가져와 동시에 50번 호출한 뒤 loader 호출 횟수와 모든 반환값을 확인한다. 이 테스트는 단일비행 구현이 사라지면 관찰 가능한 결과가 바뀌어 실패한다.

```js
// apps/storefront/tests/unit/short-cache.test.mjs
import { cachedForMs } from '../../lib/short-cache.ts'

test('같은 키의 동시 요청은 loader 를 한 번만 부른다(단일비행)', async () => {
  let calls = 0
  const load = async () => {
    calls += 1
    await new Promise((resolve) => setTimeout(resolve, 10))
    return calls
  }

  // 오픈 순간에 캐시가 빈 채로 요청이 한꺼번에 들어오는 상황이 정확히 이것이다.
  const results = await Promise.all(
    Array.from({ length: 50 }, () => cachedForMs('flight', 5_000, load)),
  )

  assert.equal(calls, 1)
  assert.deepEqual(new Set(results), new Set([1]))
})
```

이 테스트들은 코드 내부를 정리해도 관찰 가능한 결과와 사업 규칙이 유지되면 통과하고, 그 결과가 깨지면 실패하도록 설계되어 있다. 테스트 개선의 기준으로 삼을 만하다.

## 5. 검증 결과와 해석

### 5.1 앞선 검토에서 실행한 결과

| 검사 | 결과 | 해석상 한계 |
|---|---|---|
| 전체 앱 타입 검사 | 통과 | 런타임 상태·DB 인가·동시성 보장 아님 |
| Partner 단위 테스트 | 818개 통과 | 동작 테스트와 정적 문자열 검사가 함께 포함됨 |
| Admin 단위 테스트 | 291개 통과 | 일부 서버 권한 검사는 실제 호출 없이 소스를 검사 |
| Storefront 단위 테스트 | 219개 통과 | 일부 제품 로직 대신 테스트 속 복사본 검사 |
| 기본 단위 테스트 합계 | 1,328개 통과 | 테스트 수가 중요한 경로의 검증 완성을 의미하지 않음 |
| API 계약 테스트 | 301개 중 300개 통과, 1개 건너뜀 | 수동 실행 목록에서 디바이스 파일 하나 제외 |
| 별도 디바이스 파일 | 11개 중 8개 통과, 3개 실패 | 실패 3개는 오래된 판매 fixture 문제 |
| 격리 DB 마이그레이션 | 123개 적용 성공 | 운영 데이터 크기·운영 릴리스와의 동시 호환성까지 증명하지 않음 |
| 격리 DB SQL 회귀 | 파일 51개 통과, 예외 등록 5개 실제 실패 | 5개를 정상 통과로 해석하면 안 됨 |
| 마이그레이션 린트 | 오류 0, 경고 42, 명시 허용 1 | 경고 자체가 모두 새 결함이나 즉시 배포 차단을 뜻하지 않음 |
| 특권 클라이언트 증가 검사 | 신규 파일 2개로 실패 | 코드 구조 기준선 위반 |
| 파일 크기 검사 | 기존 3개 증가, 신규 큰 파일 6개로 실패 | 크기 자체가 기능 결함은 아니며 현행 CI에 실제 검사 미연결 |
| 그 외 선택 정적 검사 | 서버 액션 export, 공개 빌드 인자, 요청 origin, 위험 테이블 권한 검사 통과 | 특히 테이블 권한 검사는 SECURITY DEFINER 함수 인가까지 검사하지 않음 |
| 기존 롤백 회귀 | 9개 통과 | 전체 배포 실패 시 롤백 호출 누락을 놓침 |

SQL 재현은 네트워크가 분리된 임시 PostgreSQL 컨테이너에서 수행하고 종료 후 삭제했다. 기존 로컬 DB와 운영 DB는 사용하지 않았다.

### 5.2 테스트 통과와 함께 확인된 결함

다음 사실을 함께 해석해야 한다.

- 전체 SQL 회귀의 비예외 파일이 통과해도, 일반 로그인 역할의 타 파트너 매출 조회·마감 생성이 성공했다.
- 인증 단위 테스트가 통과해도, 실제 SDK의 로그인 이후 익명 세션 오염이 재현됐다.
- PG 테스트가 통과해도, 완료 결제가 늦은 실패 요청으로 덮이는 경합이 재현됐다.
- 롤백 테스트가 통과해도, 전체 배포 기동 실패 경로는 롤백을 호출하지 않았다.
- 일부 권한·좌석 해제·전화번호 검증을 임시 복사본에서 끊어도 관련 테스트는 통과했다.

따라서 '테스트가 많다' 또는 '기본 명령이 통과한다'만으로 위험이 충분히 관리된다고 평가할 수 없다. 반대로 전체 테스트가 무의미하다는 평가도 맞지 않는다. 핵심은 중요한 업무 경로의 검증 범위와 실패 검출력을 바로잡는 것이다.

## 6. 개선 우선순위와 완료 판정

아래는 후속 작업의 우선순위다. 구현·배포가 완료됐다는 기록이 아니다.

### 6.1 우선 차단할 문제

| 대상 | 필요한 결과 | 완료를 확인할 방법 |
|---|---|---|
| POS DB 함수 | 타 파트너 조회·마감 거절 | 실제 DB 역할별 호출과 조회·변경 부작용 확인 |
| 인증 클라이언트 | 로그인과 공개 조회의 세션 격리 | 실제 SDK로 로그인 전후 익명 요청 토큰 비교 |
| 발권 실패 복구 | 취소 미확인 상태를 환불 완료로 표시하지 않고 추적 유지 | PG 성공 후 발권 실패·취소 실패·응답 유실 주입 |
| 결제 상태 경합 | 완료 결제가 실패 요청으로 덮이지 않음 | 승인·실패·취소 순서 변경과 중복 요청 후 최종 원장 확인 |
| 앱·웹 정책 | 같은 상품·조건에 일관된 판매 판정 | 채널별 동일 입력의 가격·기간·정원·구매 한도 비교 |

### 6.2 운영 복구와 검증 연결

- 전체·선택 배포에서 새 서비스 기동 실패를 주입하고, 이전 이미지 복구 또는 명확한 복구 실패 보고를 확인한다.
- 스테이징 갱신을 현행 백업 형식과 공통 배포 경로에 맞춘다. 앱 중단부터 감사 후 재시작까지 순서를 검증한다.
- 백업을 실제 별도 DB·Storage에 복원해 데이터·앱 동작을 확인한다. 지속 업로드와 용량 부족 상황도 검증한다.
- 핵심 구매·환불·정산·권한 E2E를 CI 필수 검사에 연결한다. 준비 데이터 생성 실패는 필수 검사에서 실패로 처리한다.
- 배포 조건은 특정 문자열 존재뿐 아니라 필수 검사가 failure, skipped, cancelled일 때 배포가 실제로 차단되는지 검증한다.

### 6.3 테스트 신뢰성 개선

1. API 테스트를 자동 발견하도록 연결하고 누락 파일의 오래된 입력을 수정한다.
2. 정산 인증 fixture를 바로잡고 핵심 정산 테스트를 실패 예외에서 제거한다.
3. 권한·금전·재고 관련 문자열 검사를 실제 함수·서비스·DB 결과 검사로 보완한다.
4. 테스트 안에 복사한 검증 로직을 실제 제품 함수 호출로 바꾼다.
5. 중요한 경쟁 조건에는 실제 동시 실행과 최종 상태 검사를 둔다.
6. 필수 SQL 응답 필드를 NULL에 안전하게 검사한다.
7. 중요한 테스트는 의도적으로 권한 검사·상태 조건·재시도 처리를 망가뜨렸을 때 실패하는지 확인한다.

### 6.4 지속적인 개발 기준

현재 스택을 유지하면서 공통 인가와 주문·발권·환불 경로를 점진적으로 정리한다. 한 기능을 변경할 때 영향을 받는 앱·웹·디바이스·DB 경로와 실행 가능한 검증을 함께 갱신해야 한다.

새 기능의 완료 기준은 테스트를 추가하고 통과시켰다는 사실만으로 끝내지 않는다. **실제 기능이 잘못 동작하도록 바꾸면 자동 검사가 실패하고, 그 실패가 배포를 막는지**까지 확인해야 한다.
